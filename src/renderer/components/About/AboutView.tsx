import React from 'react';
import {
  FolderArchive,
  ShieldCheck,
  Zap,
  HardDrive,
  Lock,
  FileCheck,
  CheckCircle2,
  Terminal,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  const formats = [
    { name: 'ZIP', engine: 'Standard & Zip64', desc: 'Universal compression with CRC32 verification' },
    { name: 'RAR / RAR5', engine: 'UnRAR Engine', desc: 'Multi-part and solid archive extraction' },
    { name: '7Z', engine: 'LZMA / LZMA2', desc: 'High-ratio open archive architecture' },
    { name: 'TAR & TAR.GZ', engine: 'POSIX Tar / Gzip', desc: 'Unix archives and source code bundles' },
    { name: 'BZ2 & XZ', engine: 'Bzip2 / XZ Lib', desc: 'High compression Linux / distribution packages' },
    { name: 'ISO', engine: 'ISO 9660 / UDF', desc: 'Optical disc image file unpacker' },
    { name: 'CAB & WIM', engine: 'MS Cabinet / Windows Imaging', desc: 'Microsoft installer packages and images' },
    { name: 'ZST', engine: 'Zstandard (RFC 8878)', desc: 'Real-time decompression algorithm' },
    { name: 'ARJ & LZH', engine: 'Legacy Engines', desc: 'Classic DOS & Amiga archive support' },
  ];

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      {/* Brand Hero */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 skeuo-card">
            <FolderArchive className="w-8 h-8 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white font-mono tracking-tight">.UnZip</h1>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v1.0.0 Production
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Universal File Extraction Desktop Software with Automatic Archive Cleanup
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
          .UnZip is built specifically for users who want to decompress archives instantly, verify their contents,
          and automatically reclaim disk space by safely removing redundant compressed source files.
        </p>
      </div>

      {/* Security Architecture Guarantees */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Security & Reliability Guarantees</h3>
            <p className="text-xs text-slate-400">Untrusted input defenses and strict safety rules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[
            {
              title: 'Zip Slip & Traversal Protection',
              desc: 'All output paths are canonicalized and strictly confined within the target extraction folder.',
            },
            {
              title: 'Fail-Safe Auto-Deletion',
              desc: 'Source archives are never deleted if extraction fails, verification fails, user cancels, or disk space runs out.',
            },
            {
              title: 'Decompression Bomb Guard',
              desc: 'Detects anomalous expansion ratios (>100:1) and caps maximum safe extracted sizes to prevent resource exhaustion.',
            },
            {
              title: '100% Local & Offline',
              desc: 'All operations execute locally on your device. No archives or file contents are ever sent over a network.',
            },
            {
              title: 'Multi-Part Volume Safety',
              desc: 'Multi-part archive volumes (.part01.rar, .001) are tracked and protected from partial deletion.',
            },
            {
              title: 'File Handle Release Check',
              desc: 'Child process pipes and OS handles are fully released before executing permanent deletion.',
            },
          ].map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <h4 className="text-xs font-bold text-slate-200">{item.title}</h4>
              </div>
              <p className="text-xs text-slate-400 pl-6 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supported Formats Matrix */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Supported Formats Matrix</h3>
            <p className="text-xs text-slate-400">Extensive native format support powered by 7-Zip & libarchive</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {formats.map((fmt, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-white">{fmt.name}</span>
                <span className="text-[10px] text-slate-400 font-medium">{fmt.engine}</span>
              </div>
              <p className="text-[11px] text-slate-400">{fmt.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
