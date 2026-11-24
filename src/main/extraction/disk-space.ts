import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

export class DiskSpaceChecker {
  /**
   * Returns the available free space in bytes at the specified path.
   */
  public static async getAvailableBytes(targetPath: string): Promise<number> {
    try {
      const resolved = path.resolve(targetPath);
      // Ensure target directory exists for statfs
      let checkDir = resolved;
      while (!fs.existsSync(checkDir) && path.dirname(checkDir) !== checkDir) {
        checkDir = path.dirname(checkDir);
      }

      const stat = await fs.promises.statfs(checkDir);
      const freeBytes = stat.bsize * stat.bavail;
      return freeBytes;
    } catch (err) {
      logger.warn(`Failed to inspect disk space at ${targetPath}:`, err);
      // If statfs fails for any reason, return Infinity to allow extraction to attempt
      return Number.MAX_SAFE_INTEGER;
    }
  }

  /**
   * Checks whether the target destination has sufficient space for expected uncompressed size.
   * Throws an error if space is insufficient.
   */
  public static async checkSufficientSpace(targetPath: string, requiredBytes: number): Promise<void> {
    if (requiredBytes <= 0) return;

    const available = await this.getAvailableBytes(targetPath);
    // Add a 10MB safety margin
    const safetyBuffer = 10 * 1024 * 1024;
    if (available < requiredBytes + safetyBuffer) {
      const neededMB = (requiredBytes / (1024 * 1024)).toFixed(1);
      const availableMB = (available / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Insufficient disk space: Destination has ${availableMB} MB available, but ${neededMB} MB is required for extraction.`
      );
    }
  }
}
