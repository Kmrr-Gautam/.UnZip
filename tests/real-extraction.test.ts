import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import { SevenZipRunner } from '../src/main/extraction/sevenzip-runner';
import { VerificationEngine } from '../src/main/extraction/verification';
import { AutoDeleteSystem } from '../src/main/extraction/auto-delete';

describe('Real Extraction Engine & Auto-Delete End-to-End', () => {
  let tempDir: string;
  const bin = SevenZipRunner.getBinaryPath();

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unzip_e2e_'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function getFileHash(filePath: string): string {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  it('extracts real ZIP archive, verifies hash, and automatically deletes original ZIP', async () => {
    // 1. Create source files with Unicode & nested subdirectories
    const srcDir = path.join(tempDir, 'src');
    await fs.promises.mkdir(path.join(srcDir, 'sub'), { recursive: true });

    const file1Path = path.join(srcDir, 'hello_世界.txt');
    const file2Path = path.join(srcDir, 'sub', 'nested.json');

    const file1Content = 'Hello World with Unicode characters: こんにちは世界 🚀';
    const file2Content = JSON.stringify({ project: '.UnZip', status: 'verified' });

    await fs.promises.writeFile(file1Path, file1Content, 'utf-8');
    await fs.promises.writeFile(file2Path, file2Content, 'utf-8');

    const file1HashOriginal = getFileHash(file1Path);
    const file2HashOriginal = getFileHash(file2Path);

    // 2. Compress into ZIP using 7za
    const zipPath = path.join(tempDir, 'MyPackage.zip');
    const packRes = spawnSync(bin, ['a', '-tzip', zipPath, path.join(srcDir, '*')], {
      windowsHide: true,
    });
    expect(packRes.status).toBe(0);
    expect(fs.existsSync(zipPath)).toBe(true);

    // 3. Extract using SevenZipRunner
    const destDir = path.join(tempDir, 'MyPackage');
    await fs.promises.mkdir(destDir, { recursive: true });

    const listing = await SevenZipRunner.listArchive(zipPath);
    expect(listing.entryCount).toBeGreaterThan(0);

    const run = SevenZipRunner.runExtraction({
      archivePath: zipPath,
      destinationDir: destDir,
      totalSize: listing.totalSize,
      totalFileCount: listing.entryCount,
    });

    await run.promise;

    // 4. Verify extracted files
    const verification = await VerificationEngine.verify(destDir, listing);
    expect(verification.success).toBe(true);

    // 5. Validate hash matching
    const extractedFile1 = path.join(destDir, 'hello_世界.txt');
    expect(fs.existsSync(extractedFile1)).toBe(true);
    expect(getFileHash(extractedFile1)).toBe(file1HashOriginal);

    // 6. Test Automatic Archive Deletion
    const deleteResult = await AutoDeleteSystem.executeSafeDeletion(
      zipPath,
      verification,
      'always',
      false
    );

    expect(deleteResult.deleted).toBe(true);
    expect(fs.existsSync(zipPath)).toBe(false); // Original ZIP is deleted!
    expect(fs.existsSync(destDir)).toBe(true); // Output directory remains!
  });

  it('fails safely on corrupted archive and PRESERVES the original corrupted file', async () => {
    // 1. Create a corrupted archive
    const corruptPath = path.join(tempDir, 'Corrupt.zip');
    await fs.promises.writeFile(corruptPath, 'PK\x03\x04NOT_A_VALID_ZIP_ARCHIVE_DATA_TRUNCATED');

    const destDir = path.join(tempDir, 'CorruptOut');
    await fs.promises.mkdir(destDir, { recursive: true });

    const run = SevenZipRunner.runExtraction({
      archivePath: corruptPath,
      destinationDir: destDir,
    });

    let failed = false;
    try {
      await run.promise;
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);

    // 2. Perform safe deletion evaluation
    const deleteResult = await AutoDeleteSystem.executeSafeDeletion(
      corruptPath,
      { success: false, reason: 'Extraction failed', verifiedFiles: 0, verifiedBytes: 0 },
      'always',
      false
    );

    // Must NEVER delete the file on failure
    expect(deleteResult.deleted).toBe(false);
    expect(fs.existsSync(corruptPath)).toBe(true);
  });
});
