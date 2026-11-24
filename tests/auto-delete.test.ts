import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AutoDeleteSystem } from '../src/main/extraction/auto-delete';

describe('AutoDeleteSystem (Strict Safety Rules)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unzip_test_'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('permanently deletes archive when verification succeeds and setting is always', async () => {
    const archivePath = path.join(tempDir, 'Project.zip');
    await fs.promises.writeFile(archivePath, 'fake_zip_binary_content');

    const result = await AutoDeleteSystem.executeSafeDeletion(
      archivePath,
      { success: true, verifiedFiles: 3, verifiedBytes: 1024 },
      'always',
      false
    );

    expect(result.deleted).toBe(true);
    expect(fs.existsSync(archivePath)).toBe(false);
  });

  it('NEVER deletes archive if verification failed', async () => {
    const archivePath = path.join(tempDir, 'Corrupted.zip');
    await fs.promises.writeFile(archivePath, 'corrupted_content');

    const result = await AutoDeleteSystem.executeSafeDeletion(
      archivePath,
      { success: false, reason: 'CRC Check Failed', verifiedFiles: 0, verifiedBytes: 0 },
      'always',
      false
    );

    expect(result.deleted).toBe(false);
    expect(fs.existsSync(archivePath)).toBe(true); // Archive MUST remain safe
  });

  it('NEVER deletes archive when extraction was cancelled by user', async () => {
    const archivePath = path.join(tempDir, 'Cancelled.zip');
    await fs.promises.writeFile(archivePath, 'valid_archive_content');

    const result = await AutoDeleteSystem.executeSafeDeletion(
      archivePath,
      { success: true, verifiedFiles: 1, verifiedBytes: 100 },
      'always',
      true // isCancelled = true
    );

    expect(result.deleted).toBe(false);
    expect(fs.existsSync(archivePath)).toBe(true);
  });

  it('preserves archive when setting is set to never', async () => {
    const archivePath = path.join(tempDir, 'RetainMe.zip');
    await fs.promises.writeFile(archivePath, 'valid_archive_content');

    const result = await AutoDeleteSystem.executeSafeDeletion(
      archivePath,
      { success: true, verifiedFiles: 5, verifiedBytes: 5000 },
      'never',
      false
    );

    expect(result.deleted).toBe(false);
    expect(fs.existsSync(archivePath)).toBe(true);
  });

  it('deletes all sibling parts of a multi-part archive atomically', async () => {
    const part1 = path.join(tempDir, 'BigArchive.part1.rar');
    const part2 = path.join(tempDir, 'BigArchive.part2.rar');
    await fs.promises.writeFile(part1, 'part1_content');
    await fs.promises.writeFile(part2, 'part2_content');

    const result = await AutoDeleteSystem.executeSafeDeletion(
      part1,
      { success: true, verifiedFiles: 10, verifiedBytes: 20480 },
      'always',
      false
    );

    expect(result.deleted).toBe(true);
    expect(fs.existsSync(part1)).toBe(false);
    expect(fs.existsSync(part2)).toBe(false);
  });
});
