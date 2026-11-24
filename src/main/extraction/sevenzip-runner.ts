import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../logger';

export interface ArchiveEntryInfo {
  path: string;
  size: number;
  packedSize?: number;
  isFolder: boolean;
  crc?: string;
  isEncrypted: boolean;
}

export interface ArchiveListing {
  entries: ArchiveEntryInfo[];
  entryCount: number;
  totalSize: number;
  isPasswordProtected: boolean;
  format?: string;
}

export interface ProgressUpdate {
  progress: number; // 0 - 100
  extractedBytes: number;
  totalBytes: number;
  extractedFileCount: number;
  totalFileCount?: number;
  currentFile?: string;
  speedBytesPerSec: number;
  estimatedSecondsRemaining?: number;
}

export interface ExtractRunOptions {
  archivePath: string;
  destinationDir: string;
  password?: string;
  totalSize?: number;
  totalFileCount?: number;
  onProgress?: (update: ProgressUpdate) => void;
  onFileExtracted?: (fileRelPath: string) => void;
}

export class SevenZipRunner {
  private static binaryPath: string | null = null;

  public static getBinaryPath(): string {
    if (this.binaryPath) return this.binaryPath;

    let p: string = '';
    try {
      p = require('7zip-bin').path7za;
      // Handle packaged electron asar unpacking
      const unpacked = p.replace('app.asar', 'app.asar.unpacked');
      if (fs.existsSync(unpacked)) {
        p = unpacked;
      }
    } catch (err) {
      logger.warn('Failed to resolve 7zip-bin package:', err);
    }

    if (!p || !fs.existsSync(p)) {
      // Check resources folder
      const fallback = path.join(process.resourcesPath || __dirname, 'resources', '7z', '7za.exe');
      if (fs.existsSync(fallback)) {
        p = fallback;
      } else {
        p = '7za';
      }
    }

    this.binaryPath = p;
    logger.info(`Resolved 7za binary at: ${this.binaryPath}`);
    return this.binaryPath;
  }

  /**
   * Lists archive contents without extracting, querying sizes, files, and encryption status.
   */
  public static async listArchive(archivePath: string, password?: string): Promise<ArchiveListing> {
    const bin = this.getBinaryPath();
    const args = ['l', '-slt'];
    if (password) {
      args.push(`-p${password}`);
    } else {
      args.push('-p-'); // do not prompt on stdin
    }
    args.push('--', archivePath);

    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { windowsHide: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += d.toString('utf-8');
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString('utf-8');
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to execute 7za: ${err.message}`));
      });

      child.on('close', (code) => {
        if (stderr.includes('Wrong password') || stdout.includes('Wrong password') || stdout.includes('Cannot open encrypted archive')) {
          return resolve({
            entries: [],
            entryCount: 0,
            totalSize: 0,
            isPasswordProtected: true,
          });
        }

        if (code !== 0 && code !== 1) {
          // Check specific error messages
          if (stdout.includes('Cannot open the file as archive') || stderr.includes('Cannot open the file as archive')) {
            return reject(new Error('Corrupted or unsupported archive format.'));
          }
          if (stdout.includes('Wrong password') || stderr.includes('Wrong password')) {
            return resolve({
              entries: [],
              entryCount: 0,
              totalSize: 0,
              isPasswordProtected: true,
            });
          }
          return reject(new Error(`Archive listing failed with exit code ${code}: ${stderr || stdout}`));
        }

        const listing = this.parseSltOutput(stdout);
        resolve(listing);
      });
    });
  }

  private static parseSltOutput(output: string): ArchiveListing {
    const lines = output.split(/\r?\n/);
    const entries: ArchiveEntryInfo[] = [];
    let current: Partial<ArchiveEntryInfo> = {};
    let isPasswordProtected = false;
    let format = '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (current.path !== undefined) {
          entries.push({
            path: current.path,
            size: current.size || 0,
            packedSize: current.packedSize,
            isFolder: current.isFolder || false,
            crc: current.crc,
            isEncrypted: current.isEncrypted || false,
          });
          current = {};
        }
        continue;
      }

      const eqIdx = line.indexOf(' = ');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 3).trim();

      if (key === 'Type') {
        format = val;
      } else if (key === 'Path') {
        current.path = val;
      } else if (key === 'Folder') {
        current.isFolder = val === '+';
      } else if (key === 'Size') {
        current.size = parseInt(val, 10) || 0;
      } else if (key === 'Packed Size') {
        current.packedSize = parseInt(val, 10) || 0;
      } else if (key === 'CRC') {
        current.crc = val;
      } else if (key === 'Encrypted') {
        const enc = val === '+';
        current.isEncrypted = enc;
        if (enc) isPasswordProtected = true;
      }
    }

    if (current.path !== undefined) {
      entries.push({
        path: current.path,
        size: current.size || 0,
        packedSize: current.packedSize,
        isFolder: current.isFolder || false,
        crc: current.crc,
        isEncrypted: current.isEncrypted || false,
      });
    }

    // Filter out top archive entry itself
    const fileEntries = entries.filter((e) => !e.isFolder);
    const totalSize = fileEntries.reduce((sum, e) => sum + e.size, 0);

    return {
      entries,
      entryCount: fileEntries.length,
      totalSize,
      isPasswordProtected,
      format,
    };
  }

  /**
   * Runs the extraction operation with real-time progress callbacks and cancellation support.
   */
  public static runExtraction(options: ExtractRunOptions): {
    promise: Promise<void>;
    cancel: () => void;
    pause: () => void;
    resume: () => void;
  } {
    const bin = this.getBinaryPath();
    const args = [
      'x',
      '-y',       // Assume Yes on queries
      '-bsp1',    // Send extraction progress indicator
      '-bb1',     // Log extracted file paths
      `-o${options.destinationDir}`,
    ];

    if (options.password) {
      args.push(`-p${options.password}`);
    } else {
      args.push('-p-'); // Do not prompt on stdin
    }

    args.push('--', options.archivePath);

    let child: ChildProcess | null = null;
    let isCancelled = false;
    let isPaused = false;

    const startTime = Date.now();
    let lastProgressTime = startTime;
    let lastBytes = 0;
    let currentSpeed = 0;
    let lastFileCount = 0;

    const totalExpectedSize = options.totalSize || 0;
    const totalExpectedFiles = options.totalFileCount || 0;

    const promise = new Promise<void>((resolve, reject) => {
      child = spawn(bin, args, { windowsHide: true });

      let stderr = '';
      let stdoutBuffer = '';

      child.stdout?.on('data', (data: Buffer) => {
        if (isCancelled) return;
        const text = data.toString('utf-8');
        stdoutBuffer += text;

        // 7za progress line parsing:
        // Example: "  12% 4/25 U folder\file.txt" or " 100%"
        const progressMatches = [...text.matchAll(/(\d+)%\s*(?:(\d+)\/(\d+))?\s*(?:U\s+([^\r\n]+)|-\s+([^\r\n]+))?/g)];
        if (progressMatches.length > 0) {
          const lastMatch = progressMatches[progressMatches.length - 1];
          const pct = Math.min(100, Math.max(0, parseInt(lastMatch[1], 10)));
          const extractedFiles = lastMatch[2] ? parseInt(lastMatch[2], 10) : lastFileCount;
          const currentFile = lastMatch[4] || lastMatch[5] || undefined;

          lastFileCount = extractedFiles;
          const now = Date.now();
          const elapsedSec = (now - startTime) / 1000;
          const extractedBytes = totalExpectedSize > 0 ? Math.round((pct / 100) * totalExpectedSize) : 0;

          // Compute moving average speed
          if (now - lastProgressTime >= 400) {
            const timeDelta = (now - lastProgressTime) / 1000;
            const bytesDelta = extractedBytes - lastBytes;
            if (timeDelta > 0 && bytesDelta >= 0) {
              currentSpeed = Math.round(bytesDelta / timeDelta);
            }
            lastProgressTime = now;
            lastBytes = extractedBytes;
          }

          let etaSeconds: number | undefined = undefined;
          if (pct > 0 && pct < 100 && currentSpeed > 0 && totalExpectedSize > 0) {
            etaSeconds = Math.max(0, Math.round((totalExpectedSize - extractedBytes) / currentSpeed));
          } else if (pct > 0 && pct < 100 && elapsedSec > 1) {
            const totalEstSec = (elapsedSec / pct) * 100;
            etaSeconds = Math.max(0, Math.round(totalEstSec - elapsedSec));
          }

          if (options.onProgress) {
            options.onProgress({
              progress: pct,
              extractedBytes,
              totalBytes: totalExpectedSize,
              extractedFileCount: extractedFiles,
              totalFileCount: totalExpectedFiles || (lastMatch[3] ? parseInt(lastMatch[3], 10) : undefined),
              currentFile,
              speedBytesPerSec: currentSpeed,
              estimatedSecondsRemaining: etaSeconds,
            });
          }

          if (currentFile && options.onFileExtracted) {
            options.onFileExtracted(currentFile);
          }
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      child.on('error', (err) => {
        if (isCancelled) {
          return resolve();
        }
        reject(new Error(`Failed to start extraction process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (isCancelled) {
          return reject(new Error('Extraction cancelled by user.'));
        }

        if (code === 0 || code === 1) {
          // Check for warnings or non-fatal output
          if (options.onProgress) {
            options.onProgress({
              progress: 100,
              extractedBytes: totalExpectedSize,
              totalBytes: totalExpectedSize,
              extractedFileCount: totalExpectedFiles || lastFileCount,
              totalFileCount: totalExpectedFiles || lastFileCount,
              speedBytesPerSec: 0,
              estimatedSecondsRemaining: 0,
            });
          }
          resolve();
        } else {
          // Detect human-readable reason
          let friendlyError = `Extraction failed (code ${code})`;
          const combined = stdoutBuffer + '\n' + stderr;

          if (combined.includes('Wrong password') || combined.includes('Cannot open encrypted archive')) {
            friendlyError = 'Incorrect password. Archive could not be decrypted.';
          } else if (combined.includes('Cannot open the file as archive') || combined.includes('Headers Error')) {
            friendlyError = 'Corrupted archive or unsupported format.';
          } else if (combined.includes('Data Error') || combined.includes('CRC Failed')) {
            friendlyError = 'Corrupted archive data: CRC verification failed.';
          } else if (combined.includes('Missing volume') || combined.includes('Cannot find volume')) {
            friendlyError = 'Missing multi-part archive volume. Please ensure all parts are in the same folder.';
          } else if (combined.includes('There is not enough space on the disk')) {
            friendlyError = 'Insufficient disk space on destination drive.';
          } else if (combined.includes('Access is denied') || combined.includes('Permission denied')) {
            friendlyError = 'Permission denied: Cannot write to destination directory.';
          } else if (stderr.trim()) {
            friendlyError = stderr.trim();
          }

          reject(new Error(friendlyError));
        }
      });
    });

    const cancel = () => {
      isCancelled = true;
      if (child && !child.killed && child.pid) {
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/F', '/T', '/PID', child.pid.toString()]);
          } else {
            child.kill('SIGTERM');
          }
        } catch (err) {
          logger.warn(`Error terminating extraction process ${child.pid}:`, err);
        }
      }
    };

    const pause = () => {
      if (child && child.pid && !isPaused) {
        try {
          if (process.platform === 'win32') {
            // Windows process suspend via PowerShell
            spawn('powershell', ['-Command', `(Get-Process -Id ${child.pid}).Suspend()`]);
          } else {
            child.kill('SIGSTOP');
          }
          isPaused = true;
        } catch (err) {
          logger.warn('Failed to pause extraction process:', err);
        }
      }
    };

    const resume = () => {
      if (child && child.pid && isPaused) {
        try {
          if (process.platform === 'win32') {
            // Windows process resume via PowerShell
            spawn('powershell', ['-Command', `(Get-Process -Id ${child.pid}).Resume()`]);
          } else {
            child.kill('SIGCONT');
          }
          isPaused = false;
        } catch (err) {
          logger.warn('Failed to resume extraction process:', err);
        }
      }
    };

    return { promise, cancel, pause, resume };
  }
}
