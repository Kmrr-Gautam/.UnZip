import * as fs from 'fs';
import * as path from 'path';
import { ArchiveFormat, ArchiveMetadata } from '../../shared/types';
import { logger } from '../logger';

export class FormatDetector {
  /**
   * Detects the archive format using signature magic bytes first,
   * falling back to file extension heuristics when signatures are inconclusive.
   */
  public static async detect(filePath: string): Promise<ArchiveMetadata> {
    const stats = await fs.promises.stat(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).toLowerCase();

    // Read header buffer (up to 65536 bytes to cover ISO & TAR headers)
    const buffer = Buffer.alloc(Math.min(65536, stats.size));
    let handle: fs.promises.FileHandle | null = null;
    try {
      handle = await fs.promises.open(filePath, 'r');
      await handle.read(buffer, 0, buffer.length, 0);
    } catch (err) {
      logger.error(`Failed to read header for signature detection: ${filePath}`, err);
    } finally {
      if (handle !== null) {
        try {
          await handle.close();
        } catch {
          // ignore close error
        }
      }
    }

    const signatureFormat = this.detectFromBuffer(buffer, fileName);
    const isMultiPart = this.isMultiPartArchive(fileName);

    if (signatureFormat !== 'UNKNOWN') {
      return {
        filePath,
        fileName,
        fileSize: stats.size,
        format: signatureFormat,
        detectedBy: 'signature',
        isMultiPart: isMultiPart.isMultiPart,
        partIndex: isMultiPart.partIndex,
      };
    }

    // Fallback: detect format by extension
    const extensionFormat = this.detectFromExtension(fileName);
    return {
      filePath,
      fileName,
      fileSize: stats.size,
      format: extensionFormat,
      detectedBy: 'extension',
      isMultiPart: isMultiPart.isMultiPart,
      partIndex: isMultiPart.partIndex,
    };
  }

  public static detectFromBuffer(buffer: Buffer, fileName: string): ArchiveFormat {
    if (buffer.length < 2) return 'UNKNOWN';

    // 1. 7Z: 37 7A BC AF 27 1C
    if (
      buffer.length >= 6 &&
      buffer[0] === 0x37 &&
      buffer[1] === 0x7a &&
      buffer[2] === 0xbc &&
      buffer[3] === 0xaf &&
      buffer[4] === 0x27 &&
      buffer[5] === 0x1c
    ) {
      return '7Z';
    }

    // 2. RAR: 52 61 72 21 1A 07 (v4: 00, v5: 01 00)
    if (
      buffer.length >= 7 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x61 &&
      buffer[2] === 0x72 &&
      buffer[3] === 0x21 &&
      buffer[4] === 0x1a &&
      buffer[5] === 0x07
    ) {
      return 'RAR';
    }

    // 3. ZIP: 50 4B 03 04, 50 4B 05 06, 50 4B 07 08
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    ) {
      return 'ZIP';
    }

    // 4. GZIP / TGZ / TAR.GZ: 1F 8B
    if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
      const lower = fileName.toLowerCase();
      if (lower.endsWith('.tar.gz')) return 'TAR.GZ';
      if (lower.endsWith('.tgz')) return 'TGZ';
      return 'GZ';
    }

    // 5. BZIP2: 42 5A 68 ('BZh')
    if (buffer.length >= 3 && buffer[0] === 0x42 && buffer[1] === 0x5a && buffer[2] === 0x68) {
      return 'BZ2';
    }

    // 6. XZ: FD 37 7A 58 5A 00
    if (
      buffer.length >= 6 &&
      buffer[0] === 0xfd &&
      buffer[1] === 0x37 &&
      buffer[2] === 0x7a &&
      buffer[3] === 0x58 &&
      buffer[4] === 0x5a &&
      buffer[5] === 0x00
    ) {
      return 'XZ';
    }

    // 7. ZST (Zstandard): 28 B5 2F FD
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x28 &&
      buffer[1] === 0xb5 &&
      buffer[2] === 0x2f &&
      buffer[3] === 0xfd
    ) {
      return 'ZST';
    }

    // 8. CAB: 4D 53 43 46 ('MSCF')
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x4d &&
      buffer[1] === 0x53 &&
      buffer[2] === 0x43 &&
      buffer[3] === 0x46
    ) {
      return 'CAB';
    }

    // 9. WIM: 4D 53 57 49 4D 00 00 00 ('MSWIM\0\0\0')
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x4d &&
      buffer[1] === 0x53 &&
      buffer[2] === 0x57 &&
      buffer[3] === 0x49 &&
      buffer[4] === 0x4d &&
      buffer[5] === 0x00
    ) {
      return 'WIM';
    }

    // 10. Unix compress (.Z): 1F 9D
    if (buffer[0] === 0x1f && buffer[1] === 0x9d) {
      return 'Z';
    }

    // 11. ARJ: 60 EA
    if (buffer[0] === 0x60 && buffer[1] === 0xea) {
      return 'ARJ';
    }

    // 12. LZH: bytes 2..7 have -lh or -lz
    if (buffer.length >= 7) {
      const lzhSig = buffer.subarray(2, 7).toString('ascii');
      if (
        lzhSig.startsWith('-lh') ||
        lzhSig.startsWith('-lz') ||
        lzhSig === '-lhd-'
      ) {
        return 'LZH';
      }
    }

    // 13. TAR: check POSIX ustar at offset 257 (0x101)
    if (buffer.length >= 265) {
      const ustar = buffer.subarray(257, 262).toString('ascii');
      if (ustar === 'ustar') {
        return 'TAR';
      }
    }

    // 14. ISO 9660: check volume descriptor at 0x8000 (32768)
    if (buffer.length >= 32774) {
      const isoTag = buffer.subarray(32769, 32774).toString('ascii');
      if (isoTag === 'CD001' || isoTag === 'BEA01') {
        return 'ISO';
      }
    }

    return 'UNKNOWN';
  }

  public static detectFromExtension(fileName: string): ArchiveFormat {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.zip')) return 'ZIP';
    if (lower.endsWith('.rar')) return 'RAR';
    if (lower.endsWith('.7z')) return '7Z';
    if (lower.endsWith('.tar.gz')) return 'TAR.GZ';
    if (lower.endsWith('.tgz')) return 'TGZ';
    if (lower.endsWith('.tar')) return 'TAR';
    if (lower.endsWith('.gz')) return 'GZ';
    if (lower.endsWith('.bz2') || lower.endsWith('.bzip2')) return 'BZ2';
    if (lower.endsWith('.xz')) return 'XZ';
    if (lower.endsWith('.iso')) return 'ISO';
    if (lower.endsWith('.cab')) return 'CAB';
    if (lower.endsWith('.arj')) return 'ARJ';
    if (lower.endsWith('.lzh') || lower.endsWith('.lha')) return 'LZH';
    if (lower.endsWith('.wim')) return 'WIM';
    if (lower.endsWith('.zst') || lower.endsWith('.zstandard')) return 'ZST';
    if (lower.endsWith('.z')) return 'Z';
    if (/\.(7z\.\d{3}|\.001|\.part\d+\.rar|\.r\d{2})$/i.test(lower)) {
      if (lower.includes('.7z.')) return '7Z';
      if (lower.includes('.rar') || /\.r\d{2}$/i.test(lower)) return 'RAR';
      return '7Z';
    }
    return 'UNKNOWN';
  }

  public static isMultiPartArchive(fileName: string): { isMultiPart: boolean; partIndex?: number } {
    const lower = fileName.toLowerCase();

    // Matches .part1.rar, .part01.rar, .part001.rar
    const partMatch = lower.match(/\.part(\d+)\.rar$/);
    if (partMatch) {
      return { isMultiPart: true, partIndex: parseInt(partMatch[1], 10) };
    }

    // Matches .7z.001, .zip.001, .001
    const numExtMatch = lower.match(/\.(\d{3})$/);
    if (numExtMatch) {
      return { isMultiPart: true, partIndex: parseInt(numExtMatch[1], 10) };
    }

    // Matches .r00, .r01
    const rMatch = lower.match(/\.r(\d{2})$/);
    if (rMatch) {
      return { isMultiPart: true, partIndex: parseInt(rMatch[1], 10) + 1 };
    }

    // Matches .z01, .z02
    const zMatch = lower.match(/\.z(\d{2})$/);
    if (zMatch) {
      return { isMultiPart: true, partIndex: parseInt(zMatch[1], 10) + 1 };
    }

    return { isMultiPart: false };
  }

  public static isSupported(format: ArchiveFormat): boolean {
    return format !== 'UNKNOWN';
  }
}
