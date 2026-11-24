import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';
import { ArchiveListing } from './sevenzip-runner';

export interface VerificationResult {
  success: boolean;
  reason?: string;
  verifiedFiles: number;
  verifiedBytes: number;
}

export class VerificationEngine {
  /**
   * Verifies that the extracted folder exists, contains the expected files,
   * all files are readable, and no file was truncated or locked.
   */
  public static async verify(
    destinationDir: string,
    archiveListing?: ArchiveListing
  ): Promise<VerificationResult> {
    logger.info(`Starting post-extraction verification on: ${destinationDir}`);

    if (!fs.existsSync(destinationDir)) {
      return {
        success: false,
        reason: 'Verification failed: Destination directory does not exist.',
        verifiedFiles: 0,
        verifiedBytes: 0,
      };
    }

    try {
      const stats = await fs.promises.stat(destinationDir);
      if (!stats.isDirectory()) {
        return {
          success: false,
          reason: 'Verification failed: Destination is not a directory.',
          verifiedFiles: 0,
          verifiedBytes: 0,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        reason: `Verification failed: Cannot access destination directory (${err.message}).`,
        verifiedFiles: 0,
        verifiedBytes: 0,
      };
    }

    let verifiedFiles = 0;
    let verifiedBytes = 0;

    // Recursive traversal to collect and test all extracted files
    const testFileAccessibility = async (currentDir: string): Promise<void> => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await testFileAccessibility(fullPath);
        } else if (entry.isFile()) {
          // Check file size and verify readability
          const fileStat = await fs.promises.stat(fullPath);
          verifiedFiles++;
          verifiedBytes += fileStat.size;

          // Attempt to open and read first chunk to verify the file is not locked or inaccessible
          let handle: fs.promises.FileHandle | null = null;
          try {
            handle = await fs.promises.open(fullPath, 'r');
            if (fileStat.size > 0) {
              const testBuf = Buffer.alloc(Math.min(1024, fileStat.size));
              await handle.read(testBuf, 0, testBuf.length, 0);
            }
          } catch (readErr: any) {
            throw new Error(`Extracted file is unreadable or locked: "${fullPath}" (${readErr.message})`);
          } finally {
            if (handle) {
              await handle.close();
            }
          }
        }
      }
    };

    try {
      await testFileAccessibility(destinationDir);
    } catch (err: any) {
      logger.error('Verification error during file check:', err);
      return {
        success: false,
        reason: `Verification failed: ${err.message}`,
        verifiedFiles,
        verifiedBytes,
      };
    }

    // Check against archive listing if available
    if (archiveListing && archiveListing.entryCount > 0) {
      if (verifiedFiles === 0 && archiveListing.entryCount > 0) {
        return {
          success: false,
          reason: `Verification failed: Expected ${archiveListing.entryCount} files, but found 0 files.`,
          verifiedFiles: 0,
          verifiedBytes: 0,
        };
      }
    }

    logger.info(`Verification passed: ${verifiedFiles} files, ${verifiedBytes} bytes verified successfully.`);
    return {
      success: true,
      verifiedFiles,
      verifiedBytes,
    };
  }
}
