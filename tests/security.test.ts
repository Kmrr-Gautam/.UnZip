import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { SecurityGuard } from '../src/main/extraction/security';

describe('SecurityGuard (Zip Slip, Bomb & Path Traversal)', () => {
  const safeDest = path.resolve('C:/Users/User/ExtractedFolder');

  it('allows safe relative path within destination directory', () => {
    const safeRelative = 'subfolder/file.txt';
    const target = SecurityGuard.validateExtractionPath(safeDest, safeRelative);
    expect(target).toBe(path.join(safeDest, 'subfolder', 'file.txt'));
  });

  it('blocks Zip Slip / path traversal attempt with ../', () => {
    const maliciousRelative = '../../Windows/System32/evil.dll';
    expect(() => {
      SecurityGuard.validateExtractionPath(safeDest, maliciousRelative);
    }).toThrow(/Path traversal attempt detected/);
  });

  it('strips absolute drive letters and confines file to destination', () => {
    const absoluteAttempt = 'C:\\evil\\file.txt';
    const target = SecurityGuard.validateExtractionPath(safeDest, absoluteAttempt);
    expect(target.startsWith(safeDest)).toBe(true);
  });

  it('safely handles reserved Windows device names (CON, PRN, AUX, COM1)', () => {
    const conPath = 'docs/CON.txt';
    const target = SecurityGuard.validateExtractionPath(safeDest, conPath);
    expect(path.basename(target)).toBe('_CON.txt');
  });

  it('blocks potential decompression bombs with excessive compression ratio', () => {
    const smallArchiveBytes = 1024 * 1024; // 1 MB
    const hugeUncompressedBytes = 150 * 1024 * 1024; // 150 MB (ratio 150:1 > 100:1 limit)

    expect(() => {
      SecurityGuard.checkDecompressionBomb(smallArchiveBytes, hugeUncompressedBytes);
    }).toThrow(/Suspicious compression ratio/);
  });

  it('blocks archives exceeding maximum safe uncompressed size limit (50 GB)', () => {
    const archiveBytes = 10 * 1024 * 1024 * 1024;
    const oversizedUncompressed = 60 * 1024 * 1024 * 1024; // 60 GB > 50 GB

    expect(() => {
      SecurityGuard.checkDecompressionBomb(archiveBytes, oversizedUncompressed);
    }).toThrow(/exceeds safety limit/);
  });
});
