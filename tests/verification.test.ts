import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VerificationEngine } from '../src/main/extraction/verification';

describe('VerificationEngine (Integrity & Accessibility)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unzip_verify_'));
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('passes verification when destination contains readable extracted files', async () => {
    const destDir = path.join(tempDir, 'ExtractedProject');
    await fs.promises.mkdir(destDir, { recursive: true });

    await fs.promises.writeFile(path.join(destDir, 'index.html'), '<html>Hello</html>');
    await fs.promises.writeFile(path.join(destDir, 'style.css'), 'body { color: red; }');

    const result = await VerificationEngine.verify(destDir, {
      entries: [],
      entryCount: 2,
      totalSize: 40,
      isPasswordProtected: false,
    });

    expect(result.success).toBe(true);
    expect(result.verifiedFiles).toBe(2);
    expect(result.verifiedBytes).toBeGreaterThan(0);
  });

  it('fails verification if destination directory does not exist', async () => {
    const nonExistent = path.join(tempDir, 'DoesNotExist');
    const result = await VerificationEngine.verify(nonExistent);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('does not exist');
  });

  it('fails verification if expected files were missing', async () => {
    const emptyDest = path.join(tempDir, 'EmptyFolder');
    await fs.promises.mkdir(emptyDest, { recursive: true });

    const result = await VerificationEngine.verify(emptyDest, {
      entries: [],
      entryCount: 5, // Expected 5 files
      totalSize: 500,
      isPasswordProtected: false,
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Expected 5 files, but found 0 files');
  });
});
