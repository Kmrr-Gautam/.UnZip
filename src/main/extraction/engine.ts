import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import {
  ArchiveMetadata,
  ConflictResolution,
  DestinationMode,
  ExtractionOptions,
  ExtractionTask,
  TaskStatus,
} from '../../shared/types';
import { logger } from '../logger';
import { FormatDetector } from './format-detector';
import { SecurityGuard } from './security';
import { DiskSpaceChecker } from './disk-space';
import { SevenZipRunner } from './sevenzip-runner';
import { VerificationEngine } from './verification';
import { AutoDeleteSystem } from './auto-delete';
import { historyDb } from '../database/history-db';
import { settingsStore } from '../settings/settings-store';

export interface ActiveExecution {
  task: ExtractionTask;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  options: ExtractionOptions;
  archiveMetadata?: ArchiveMetadata;
}

export class ExtractionEngine extends EventEmitter {
  private queue: ExtractionTask[] = [];
  private activeExecutions = new Map<string, ActiveExecution>();

  constructor() {
    super();
  }

  /**
   * Adds one or more archive files to the extraction queue.
   */
  public async queueArchives(filePaths: string[], options?: ExtractionOptions): Promise<ExtractionTask[]> {
    const tasks: ExtractionTask[] = [];

    for (const filePath of filePaths) {
      try {
        const stats = await fs.promises.stat(filePath);
        const fileName = path.basename(filePath);
        const metadata = await FormatDetector.detect(filePath);

        const id = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        const task: ExtractionTask = {
          id,
          archivePath: filePath,
          archiveName: fileName,
          format: metadata.format,
          archiveSize: stats.size,
          destinationDir: '',
          status: 'queued',
          progress: 0,
          extractedBytes: 0,
          totalBytes: 0,
          extractedFileCount: 0,
          speedBytesPerSec: 0,
          startTime: Date.now(),
          isPasswordProtected: false,
        };

        tasks.push(task);
        this.queue.push(task);
        this.emit('taskQueued', task);

        // Store options
        this.activeExecutions.set(id, {
          task,
          cancel: () => {},
          pause: () => {},
          resume: () => {},
          options: options || {},
          archiveMetadata: metadata,
        });
      } catch (err) {
        logger.error(`Failed to inspect archive for queue: ${filePath}`, err);
      }
    }

    this.processQueue();
    return tasks;
  }

  /**
   * Determines default destination path for an archive according to configured mode.
   */
  public determineDestinationPath(
    archivePath: string,
    mode: DestinationMode,
    customDir?: string
  ): string {
    const parentDir = path.dirname(archivePath);
    const fileName = path.basename(archivePath);

    // Strip common archive extensions: .tar.gz, .tgz, .zip, .rar, etc.
    let baseName = fileName.replace(/\.(tar\.gz|tgz|tar\.bz2|tbz2|tar\.xz|txz|7z\.\d{3}|\.part\d+\.rar)$/i, '');
    if (baseName === fileName) {
      baseName = path.parse(fileName).name;
    }

    switch (mode) {
      case 'same_folder':
        return parentDir;
      case 'custom':
        return customDir ? path.resolve(customDir) : path.join(parentDir, baseName);
      case 'archive_folder':
      default:
        return path.join(parentDir, baseName);
    }
  }

  /**
   * Checks if destination already exists and generates numbered alternative if needed.
   */
  public checkFolderConflict(targetDir: string): { hasConflict: boolean; suggestedNumberedDir: string } {
    if (!fs.existsSync(targetDir)) {
      return { hasConflict: false, suggestedNumberedDir: targetDir };
    }

    // Check if directory has existing contents
    try {
      const items = fs.readdirSync(targetDir);
      if (items.length === 0) {
        return { hasConflict: false, suggestedNumberedDir: targetDir };
      }
    } catch {
      return { hasConflict: false, suggestedNumberedDir: targetDir };
    }

    // Generate numbered folder name: Project (1), Project (2), etc.
    const parent = path.dirname(targetDir);
    const base = path.basename(targetDir);
    let counter = 1;
    let suggested = path.join(parent, `${base} (${counter})`);
    while (fs.existsSync(suggested)) {
      counter++;
      suggested = path.join(parent, `${base} (${counter})`);
    }

    return { hasConflict: true, suggestedNumberedDir: suggested };
  }

  /**
   * Main Queue Processor that enforces max concurrent extractions.
   */
  public async processQueue() {
    const settings = settingsStore.getSettings();
    const maxConcurrent = settings.performance.maxConcurrentExtractions || 2;

    const runningCount = Array.from(this.activeExecutions.values()).filter(
      (e) => e.task.status === 'extracting' || e.task.status === 'verifying'
    ).length;

    if (runningCount >= maxConcurrent) {
      return;
    }

    const nextTask = this.queue.find((t) => t.status === 'queued');
    if (!nextTask) {
      return;
    }

    // Start extraction for next task
    this.executeTask(nextTask.id);
  }

  /**
   * Executes a single extraction task with full verification and auto-deletion pipeline.
   */
  public async executeTask(taskId: string, overridePassword?: string, overrideDest?: string) {
    const execution = this.activeExecutions.get(taskId);
    if (!execution) return;

    const { task, options } = execution;
    const settings = settingsStore.getSettings();

    // Acquire lock on original archive
    const lockAcquired = AutoDeleteSystem.acquireLock(task.archivePath);
    if (!lockAcquired) {
      task.status = 'failed';
      task.errorMessage = 'Archive is currently locked by another extraction task.';
      this.emit('taskUpdated', task);
      return;
    }

    try {
      task.status = 'extracting';
      task.startTime = Date.now();
      this.emit('taskUpdated', task);

      // 1. Determine destination directory
      const destMode = options.destinationMode || settings.general.defaultDestinationMode || 'archive_folder';
      let destDir = overrideDest || options.destinationDir || this.determineDestinationPath(task.archivePath, destMode, settings.general.defaultExtractDir);

      // Conflict handling
      const conflict = this.checkFolderConflict(destDir);
      if (conflict.hasConflict) {
        const resolution: ConflictResolution = options.conflictResolution || 'rename_numbered';
        if (resolution === 'rename_numbered') {
          destDir = conflict.suggestedNumberedDir;
        } else if (resolution === 'cancel') {
          task.status = 'cancelled';
          task.errorMessage = 'Extraction cancelled due to existing folder conflict.';
          this.emit('taskUpdated', task);
          AutoDeleteSystem.releaseLock(task.archivePath);
          return;
        }
      }

      task.destinationDir = destDir;
      this.emit('taskUpdated', task);

      // 2. Validate destination permissions & create directory
      await SecurityGuard.verifyDestinationWritable(destDir);

      // 3. Inspect archive listing and password protection
      let password = overridePassword || options.password;
      let listing = await SevenZipRunner.listArchive(task.archivePath, password);

      if (listing.isPasswordProtected && !password) {
        task.isPasswordProtected = true;
        task.status = 'idle';
        this.emit('taskUpdated', task);
        this.emit('passwordRequired', {
          taskId: task.id,
          archivePath: task.archivePath,
          archiveName: task.archiveName,
        });
        AutoDeleteSystem.releaseLock(task.archivePath);
        return;
      }

      task.totalBytes = listing.totalSize || task.archiveSize;
      task.totalFileCount = listing.entryCount;
      this.emit('taskUpdated', task);

      // 4. Security Checks: Decompression bomb check
      SecurityGuard.checkDecompressionBomb(task.archiveSize, listing.totalSize);

      // 5. Pre-extraction disk space validation
      await DiskSpaceChecker.checkSufficientSpace(destDir, listing.totalSize);

      // 6. Run Extraction with real progress tracking
      const runner = SevenZipRunner.runExtraction({
        archivePath: task.archivePath,
        destinationDir: destDir,
        password,
        totalSize: listing.totalSize,
        totalFileCount: listing.entryCount,
        onProgress: (p) => {
          task.progress = p.progress;
          task.extractedBytes = p.extractedBytes;
          task.totalBytes = p.totalBytes;
          task.extractedFileCount = p.extractedFileCount;
          task.totalFileCount = p.totalFileCount;
          task.currentFile = p.currentFile;
          task.speedBytesPerSec = p.speedBytesPerSec;
          task.estimatedSecondsRemaining = p.estimatedSecondsRemaining;
          this.emit('taskUpdated', task);
        },
      });

      // Assign cancellation and pause hooks
      execution.cancel = runner.cancel;
      execution.pause = runner.pause;
      execution.resume = runner.resume;

      // Await extraction completion
      await runner.promise;

      // 7. Verification Phase
      task.status = 'verifying';
      this.emit('taskUpdated', task);

      const verification = await VerificationEngine.verify(destDir, listing);
      if (!verification.success) {
        throw new Error(verification.reason || 'Integrity verification failed on extracted files.');
      }

      // 8. Auto-Deletion Phase (The Core Feature of .UnZip)
      task.status = 'deleting';
      this.emit('taskUpdated', task);

      const deleteSetting = options.autoDelete || settings.storage.autoDeleteArchives || 'always';

      if (deleteSetting === 'ask') {
        // Prompt user confirmation before deletion
        this.emit('deleteConfirmationRequired', {
          taskId: task.id,
          archivePath: task.archivePath,
          archiveName: task.archiveName,
          savedBytes: task.archiveSize,
        });
      } else if (deleteSetting === 'always') {
        const deleteResult = await AutoDeleteSystem.executeSafeDeletion(
          task.archivePath,
          verification,
          'always',
          false
        );
        task.deletedOriginal = deleteResult.deleted;
      } else {
        task.deletedOriginal = false;
      }

      // 9. Task Completed Successfully!
      task.status = 'completed';
      task.progress = 100;
      task.endTime = Date.now();
      const durationMs = task.endTime - task.startTime;
      this.emit('taskUpdated', task);
      this.emit('taskCompleted', task);

      // Record to SQLite history database
      await historyDb.addHistory({
        id: task.id,
        archiveName: task.archiveName,
        archivePath: task.archivePath,
        format: task.format,
        originalSize: task.archiveSize,
        extractedSize: verification.verifiedBytes || task.extractedBytes,
        destination: task.destinationDir,
        timestamp: task.startTime,
        durationMs,
        status: 'completed',
        storageSavedBytes: task.deletedOriginal ? task.archiveSize : 0,
        deletedOriginal: Boolean(task.deletedOriginal),
      });
    } catch (err: any) {
      logger.error(`Task ${taskId} failed:`, err);
      task.status = task.status === 'cancelled' ? 'cancelled' : 'failed';
      task.errorMessage = err.message || 'An unexpected error occurred during extraction.';
      task.endTime = Date.now();
      this.emit('taskUpdated', task);
      this.emit('taskFailed', task);

      // Record failure in SQLite
      await historyDb.addHistory({
        id: task.id,
        archiveName: task.archiveName,
        archivePath: task.archivePath,
        format: task.format,
        originalSize: task.archiveSize,
        extractedSize: task.extractedBytes || 0,
        destination: task.destinationDir || '',
        timestamp: task.startTime,
        durationMs: (task.endTime || Date.now()) - task.startTime,
        status: task.status === 'cancelled' ? 'cancelled' : 'failed',
        storageSavedBytes: 0,
        deletedOriginal: false,
        errorMessage: task.errorMessage,
      });
    } finally {
      // Release lock and remove from active execution queue
      AutoDeleteSystem.releaseLock(task.archivePath);
      this.processQueue();
    }
  }

  /**
   * Confirms deletion when user answers 'ask' prompt.
   */
  public async confirmDeletion(taskId: string, allowed: boolean): Promise<void> {
    const execution = this.activeExecutions.get(taskId);
    if (!execution) return;

    const { task } = execution;
    if (allowed && task.status === 'completed') {
      const deleteResult = await AutoDeleteSystem.executeSafeDeletion(
        task.archivePath,
        { success: true, verifiedFiles: 1, verifiedBytes: 1 },
        'always',
        false
      );
      task.deletedOriginal = deleteResult.deleted;
      this.emit('taskUpdated', task);
    }
  }

  public cancelTask(taskId: string) {
    const execution = this.activeExecutions.get(taskId);
    if (execution) {
      execution.task.status = 'cancelled';
      execution.task.errorMessage = 'Extraction cancelled by user.';
      execution.cancel();
      this.emit('taskUpdated', execution.task);
    }
  }

  public pauseTask(taskId: string) {
    const execution = this.activeExecutions.get(taskId);
    if (execution && execution.task.status === 'extracting') {
      execution.pause();
      execution.task.status = 'paused';
      this.emit('taskUpdated', execution.task);
    }
  }

  public resumeTask(taskId: string) {
    const execution = this.activeExecutions.get(taskId);
    if (execution && execution.task.status === 'paused') {
      execution.resume();
      execution.task.status = 'extracting';
      this.emit('taskUpdated', execution.task);
    }
  }

  public retryTask(taskId: string) {
    const execution = this.activeExecutions.get(taskId);
    if (execution) {
      execution.task.status = 'queued';
      execution.task.progress = 0;
      execution.task.extractedBytes = 0;
      execution.task.errorMessage = undefined;
      this.emit('taskUpdated', execution.task);
      this.processQueue();
    }
  }

  public getTasks(): ExtractionTask[] {
    return Array.from(this.activeExecutions.values()).map((e) => e.task);
  }
}

export const extractionEngine = new ExtractionEngine();
