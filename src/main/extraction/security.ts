import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../logger';

export class SecurityGuard {
  // Reserved DOS device names on Windows
  private static readonly RESERVED_NAMES = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ]);

  // Default max uncompressed size allowed (50 GB)
  public static readonly MAX_SAFE_UNCOMPRESSED_BYTES = 50 * 1024 * 1024 * 1024;

  // Maximum allowed compression ratio before flagging as a potential bomb (100:1)
  public static readonly MAX_COMPRESSION_RATIO = 100;

  /**
   * Validates that an archive entry relative path does NOT escape the destination directory.
   * Throws an error if a Zip Slip or path traversal is detected.
   */
  public static validateExtractionPath(destinationDir: string, relativePath: string): string {
    const resolvedDest = path.resolve(destinationDir);

    // Strip leading drive letters or absolute slashes (e.g., "C:\Windows" or "/etc/passwd")
    let cleanedRelative = relativePath.replace(/^[a-zA-Z]:[/\\]+/, '').replace(/^[/\\]+/, '');

    // Normalize separators to current OS
    const resolvedTarget = path.resolve(resolvedDest, cleanedRelative);

    // Verify target path starts with destination folder
    if (!resolvedTarget.startsWith(resolvedDest + path.sep) && resolvedTarget !== resolvedDest) {
      logger.error(`Path traversal attempt blocked: "${relativePath}" -> "${resolvedTarget}" outside "${resolvedDest}"`);
      throw new Error(`Security Exception: Path traversal attempt detected for file "${relativePath}". Extraction aborted.`);
    }

    // Check for reserved Windows filenames
    const baseName = path.basename(resolvedTarget).toUpperCase();
    const nameWithoutExt = baseName.split('.')[0];
    if (this.RESERVED_NAMES.has(nameWithoutExt)) {
      logger.warn(`Reserved device name found in archive: "${baseName}". Renaming safely.`);
      const safeName = '_' + path.basename(resolvedTarget);
      return path.join(path.dirname(resolvedTarget), safeName);
    }

    return resolvedTarget;
  }

  /**
   * Inspects potential decompression bombs based on compressed archive size and declared uncompressed size.
   */
  public static checkDecompressionBomb(archiveSize: number, uncompressedSize: number): void {
    if (uncompressedSize > this.MAX_SAFE_UNCOMPRESSED_BYTES) {
      throw new Error(
        `Security Exception: Uncompressed size (${(uncompressedSize / (1024 * 1024 * 1024)).toFixed(2)} GB) exceeds safety limit of ${(this.MAX_SAFE_UNCOMPRESSED_BYTES / (1024 * 1024 * 1024)).toFixed(0)} GB.`
      );
    }

    if (archiveSize > 0 && uncompressedSize > 10 * 1024 * 1024) { // Only check ratio if uncompressed is > 10MB
      const ratio = uncompressedSize / archiveSize;
      if (ratio > this.MAX_COMPRESSION_RATIO) {
        throw new Error(
          `Security Exception: Suspicious compression ratio detected (${ratio.toFixed(1)}:1). Potential decompression bomb.`
        );
      }
    }
  }

  /**
   * Verifies that the destination directory is writable and accessible.
   */
  public static async verifyDestinationWritable(destinationDir: string): Promise<void> {
    const resolvedDest = path.resolve(destinationDir);

    // Ensure directory exists
    if (!fs.existsSync(resolvedDest)) {
      await fs.promises.mkdir(resolvedDest, { recursive: true });
    }

    // Test write permission with a temp test file
    const testFile = path.join(resolvedDest, `.unzip_write_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    try {
      await fs.promises.writeFile(testFile, 'write_test', 'utf-8');
      await fs.promises.unlink(testFile);
    } catch (err: any) {
      logger.error(`Destination is not writable: ${resolvedDest}`, err);
      throw new Error(`Destination directory permission denied: Cannot write to "${resolvedDest}".`);
    }
  }

  /**
   * Safely checks symlinks to ensure they do not point outside the destination directory.
   */
  public static isSafeSymlink(destinationDir: string, linkTarget: string): boolean {
    const resolvedDest = path.resolve(destinationDir);
    const resolvedTarget = path.resolve(resolvedDest, linkTarget);
    return resolvedTarget.startsWith(resolvedDest + path.sep);
  }
}
