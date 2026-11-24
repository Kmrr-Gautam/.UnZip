import React, { useState, useRef } from 'react';
import { UploadCloud, FolderSearch, FileArchive, ArrowUpRight } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: string[]) => void;
  onBrowseFiles: () => void;
  onBrowseFolder: () => void;
}

const SUPPORTED_FORMATS = [
  'ZIP', 'RAR', '7Z', 'TAR', 'TAR.GZ', 'TGZ', 'GZ', 'BZ2', 'XZ', 'ISO', 'CAB', 'ARJ', 'LZH', 'WIM', 'Z', 'ZST'
];

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onBrowseFiles,
  onBrowseFolder,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const paths = files.map((f: any) => f.path).filter(Boolean);
      if (paths.length > 0) {
        onFilesSelected(paths);
      }
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative rounded-3xl p-10 text-center transition-all duration-300 border-2 border-dashed ${
        isDragOver
          ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01] shadow-2xl shadow-emerald-500/20'
          : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-900/70'
      }`}
    >
      {/* Decorative center icon */}
      <div className="mx-auto w-20 h-20 mb-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center shadow-inner">
        <UploadCloud
          className={`w-10 h-10 transition-transform duration-300 ${
            isDragOver ? 'scale-110 text-emerald-400 animate-bounce' : 'text-slate-400'
          }`}
        />
      </div>

      <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
        Drop your archives here
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto mb-8">
        Drag and drop single or multiple archive files to extract. Original archives are automatically cleaned after verification.
      </p>

      {/* Action Buttons */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={onBrowseFiles}
          className="skeuo-button-primary px-6 py-3 rounded-xl font-semibold text-slate-950 text-sm flex items-center gap-2"
        >
          <FileArchive className="w-4 h-4" />
          <span>Browse Files</span>
        </button>

        <button
          onClick={onBrowseFolder}
          className="skeuo-button px-5 py-3 rounded-xl font-medium text-slate-200 text-sm flex items-center gap-2 border border-slate-700/60"
        >
          <FolderSearch className="w-4 h-4 text-slate-400" />
          <span>Browse Folder</span>
        </button>
      </div>

      {/* Supported Formats Pills */}
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">
          Supported Archive Engines
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-2xl mx-auto">
          {SUPPORTED_FORMATS.map((fmt) => (
            <span
              key={fmt}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/60"
            >
              .{fmt.toLowerCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
