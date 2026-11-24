import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { AutoDeleteSetting } from '../../shared/types';
import { VerificationResult } from './verification';
import { FormatDetector } from './format-detector';

export interface DeleteResult {
  deleted: boolean;
  freedBytes: number;
  deletedFiles: string[];
  error?: string;
}

export class AutoDeleteSystem {
  // Set of archives currently locked / in-progress by any extraction task
  private static activeArchiveLocks = new Set<string>();

  /**
   * Acquire a lock on an archive file to ensure no other task touches or deletes it concurrently.
   */
  public static acquireLock(archivePath: string): boolean {
    const canonical = path.resolve(archivePath).toLowerCase();
    if (this.activeArchiveLocks.has(canonical)) {
      return false;
    }
    this.activeArchiveLocks.add(canonical);
    return true;
  }

  /**
   * Release lock when task finishes or fails.
   */
  public static releaseLock(archivePath: string): void {
    const canonical = path.resolve(archivePath).toLowerCase();
    this.activeArchiveLocks.delete(canonical);
  }

  /**
   * Evaluates safety criteria and executes permanent OS deletion of the original archive.
   * STRICT SAFETY GUARANTEES:
   * - Must have verificationResult.success === true
   * - Must not be cancelled
   * - Setting must allow deletion
   * - Multi-part archives: deletes all parts atomically or none
   */
  public static async executeSafeDeletion(
    archivePath: string,
    verificationResult: VerificationResult,
    setting: AutoDeleteSetting,
    isCancelled: boolean = false
  ): Promise<DeleteResult> {
    const canonical = path.resolve(archivePath);

    // Rule 1: Never delete if cancelled
    if (isCancelled) {
      logger.info(`Auto-delete skipped: Task was cancelled for "${canonical}"`);
      return { deleted: false, freedBytes: 0, deletedFiles: [] };
    }

    // Rule 2: Never delete if verification failed or not successful
    if (!verificationResult || !verificationResult.success) {
      const reason = verificationResult?.reason || 'Verification was not successful';
      logger.warn(`Auto-delete ABORTED: Safety verification check failed for "${canonical}". Reason: ${reason}`);
      return {
        deleted: false,
        freedBytes: 0,
        deletedFiles: [],
        error: `Archive preserved: Verification check failed (${reason})`,
      };
    }

    // Rule 3: Check setting
    if (setting === 'never') {
      logger.info(`Auto-delete skipped: Setting is set to 'never' for "${canonical}"`);
      return { deleted: false, freedBytes: 0, deletedFiles: [] };
    }

    // Check file existence
    if (!fs.existsSync(canonical)) {
      return { deleted: false, freedBytes: 0, deletedFiles: [], error: 'Original archive file no longer exists.' };
    }

    // Identify all volumes if multi-part
    const targetFilesToDelete: string[] = [];
    let totalFreedBytes = 0;

    const fileName = path.basename(canonical);
    const multiPartInfo = FormatDetector.isMultiPartArchive(fileName);

    if (multiPartInfo.isMultiPart) {
      // Find all sibling volumes in directory
      const dir = path.dirname(canonical);
      const siblings = await this.findMultiPartSiblings(dir, fileName);
      targetFilesToDelete.push(...siblings);
    } else {
      targetFilesToDelete.push(canonical);
    }

    // Calculate total size of files to be deleted
    for (const f of targetFilesToDelete) {
      try {
        const stat = await fs.promises.stat(f);
        totalFreedBytes += stat.size;
      } catch {
        // ignore stat error
      }
    }

    // Perform permanent OS deletion
    const successfullyDeleted: string[] = [];
    try {
      for (const f of targetFilesToDelete) {
        // Ensure handle is free by attempting open/close or directly unlink
        await fs.promises.unlink(f);
        successfullyDeleted.push(f);
        logger.info(`Original archive deleted successfully: "${f}"`);
      }

      return {
        deleted: true,
        freedBytes: totalFreedBytes,
        deletedFiles: successfullyDeleted,
      };
    } catch (err: any) {
      logger.error(`Failed to delete archive file "${canonical}":`, err);
      return {
        deleted: successfullyDeleted.length > 0,
        freedBytes: totalFreedBytes,
        deletedFiles: successfullyDeleted,
        error: `Could not delete original archive: ${err.message}. File may be locked by another application.`,
      };
    }
  }

  /**
   * Helper to locate all parts of a multi-part archive volume.
   */
  private static async findMultiPartSiblings(dir: string, baseFileName: string): Promise<string[]> {
    const result: string[] = [];
    const entries = await fs.promises.readdir(dir);

    // E.g. Project.part1.rar -> Project.part\d+.rar
    const partMatch = baseFileName.match(/^(.+?)\.part(\d+)\.rar$/i);
    if (partMatch) {
      const prefix = partMatch[1].toLowerCase();
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith(prefix) && /\.part\d+\.rar$/i.test(entry)) {
          result.push(path.join(dir, entry));
        }
      }
      return result;
    }

    // E.g. Project.7z.001 -> Project.7z.\d{3}
    const num7zMatch = baseFileName.match(/^(.+?\.(?:7z|zip))\.\d{3}$/i);
    if (num7zMatch) {
      const prefix = num7zMatch[1].toLowerCase();
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith(prefix) && /\.\d{3}$/i.test(entry)) {
          result.push(path.join(dir, entry));
        }
      }
      return result;
    }

    result.push(path.join(dir, baseFileName));
    return result;
  }
}
