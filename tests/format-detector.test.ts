import { describe, it, expect } from 'vitest';
import { FormatDetector } from '../src/main/extraction/format-detector';

describe('FormatDetector (Signature & Magic Bytes)', () => {
  it('detects standard ZIP archive by signature (PK\\x03\\x04)', () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(FormatDetector.detectFromBuffer(buf, 'archive.dat')).toBe('ZIP');
  });

  it('detects empty ZIP archive by signature (PK\\x05\\x06)', () => {
    const buf = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0x00, 0x00]);
    expect(FormatDetector.detectFromBuffer(buf, 'empty.dat')).toBe('ZIP');
  });

  it('detects 7-Zip archive by signature (37 7A BC AF 27 1C)', () => {
    const buf = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00]);
    expect(FormatDetector.detectFromBuffer(buf, 'backup.dat')).toBe('7Z');
  });

  it('detects RAR4 and RAR5 archives by signature', () => {
    const rar4 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00]);
    expect(FormatDetector.detectFromBuffer(rar4, 'file.dat')).toBe('RAR');

    const rar5 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]);
    expect(FormatDetector.detectFromBuffer(rar5, 'file.dat')).toBe('RAR');
  });

  it('detects GZIP, TGZ, and TAR.GZ', () => {
    const gz = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
    expect(FormatDetector.detectFromBuffer(gz, 'data.gz')).toBe('GZ');
    expect(FormatDetector.detectFromBuffer(gz, 'bundle.tar.gz')).toBe('TAR.GZ');
    expect(FormatDetector.detectFromBuffer(gz, 'archive.tgz')).toBe('TGZ');
  });

  it('detects BZIP2 (BZh)', () => {
    const bz2 = Buffer.from([0x42, 0x5a, 0x68, 0x39]);
    expect(FormatDetector.detectFromBuffer(bz2, 'file.bz2')).toBe('BZ2');
  });

  it('detects XZ (\\xfd7zXZ\\x00)', () => {
    const xz = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);
    expect(FormatDetector.detectFromBuffer(xz, 'file.xz')).toBe('XZ');
  });

  it('detects Zstandard (28 B5 2F FD)', () => {
    const zst = Buffer.from([0x28, 0xb5, 0x2f, 0xfd, 0x00]);
    expect(FormatDetector.detectFromBuffer(zst, 'file.zst')).toBe('ZST');
  });

  it('detects Microsoft Cabinet CAB (MSCF)', () => {
    const cab = Buffer.from([0x4d, 0x53, 0x43, 0x46, 0x00]);
    expect(FormatDetector.detectFromBuffer(cab, 'setup.cab')).toBe('CAB');
  });

  it('detects Windows Imaging Format WIM (MSWIM\\0\\0\\0)', () => {
    const wim = Buffer.from([0x4d, 0x53, 0x57, 0x49, 0x4d, 0x00, 0x00, 0x00]);
    expect(FormatDetector.detectFromBuffer(wim, 'install.wim')).toBe('WIM');
  });

  it('detects multi-part archive volumes correctly', () => {
    expect(FormatDetector.isMultiPartArchive('Project.part1.rar')).toEqual({
      isMultiPart: true,
      partIndex: 1,
    });
    expect(FormatDetector.isMultiPartArchive('Project.part02.rar')).toEqual({
      isMultiPart: true,
      partIndex: 2,
    });
    expect(FormatDetector.isMultiPartArchive('Backup.7z.001')).toEqual({
      isMultiPart: true,
      partIndex: 1,
    });
    expect(FormatDetector.isMultiPartArchive('SingleArchive.zip')).toEqual({
      isMultiPart: false,
    });
  });
});
