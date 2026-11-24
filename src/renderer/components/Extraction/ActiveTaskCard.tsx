import React from 'react';
import {
  FolderArchive,
  FolderOpen,
  Pause,
  Play,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  ShieldCheck,
  HardDrive,
} from 'lucide-react';
import { ExtractionTask } from '../../../shared/types';
import {
  formatBytes,
  formatDuration,
  formatSpeed,
  getFormatColor,
} from '../../utils/format';

interface ActiveTaskCardProps {
  task: ExtractionTask;
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRetry: (taskId: string) => void;
  onOpenFolder: (destination: string) => void;
}

export const ActiveTaskCard: React.FC<ActiveTaskCardProps> = ({
  task,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onOpenFolder,
}) => {
  const color = getFormatColor(task.format);

  const getStatusBadge = () => {
    switch (task.status) {
      case 'extracting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
            Extracting ({task.progress}%)
          </span>
        );
      case 'verifying':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30 animate-pulse">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            Verifying Files...
          </span>
        );
      case 'deleting':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Trash2 className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            Removing Archive...
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            Failed
          </span>
        );
      case 'paused':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Pause className="w-3.5 h-3.5 text-amber-400" />
            Paused
          </span>
        );
      case 'cancelled':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300 border border-slate-600">
            Cancelled
          </span>
        );
      case 'queued':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Queued
          </span>
        );
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-sm transition-all">
      {/* Top row: Name, Format, Controls */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white truncate">{task.archiveName}</h4>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${color.bg} ${color.text} ${color.border}`}
              >
                {task.format}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              Size: {formatBytes(task.archiveSize)} &bull; Dest: {task.destinationDir || 'Auto-detect folder'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {getStatusBadge()}

          {/* Action buttons */}
          {task.status === 'extracting' && (
            <button
              onClick={() => onPause(task.id)}
              title="Pause Extraction"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}

          {task.status === 'paused' && (
            <button
              onClick={() => onResume(task.id)}
              title="Resume Extraction"
              className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
            >
              <Play className="w-4 h-4" />
            </button>
          )}

          {(task.status === 'extracting' || task.status === 'queued' || task.status === 'paused') && (
            <button
              onClick={() => onCancel(task.id)}
              title="Cancel Extraction"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {task.status === 'failed' && (
            <button
              onClick={() => onRetry(task.id)}
              title="Retry Extraction"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {task.status === 'completed' && task.destinationDir && (
            <button
              onClick={() => onOpenFolder(task.destinationDir)}
              title="Open Destination Folder"
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Open Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {(task.status === 'extracting' || task.status === 'verifying' || task.status === 'deleting' || task.status === 'paused') && (
        <div className="mt-4">
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                task.status === 'verifying'
                  ? 'bg-sky-400 animate-pulse'
                  : task.status === 'deleting'
                  ? 'bg-amber-400'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              }`}
              style={{ width: `${task.progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono">
              {formatBytes(task.extractedBytes)} / {formatBytes(task.totalBytes)} ({task.progress}%)
            </span>

            <div className="flex items-center gap-3">
              {task.speedBytesPerSec > 0 && (
                <span className="font-mono text-emerald-400">
                  {formatSpeed(task.speedBytesPerSec)}
                </span>
              )}
              {task.estimatedSecondsRemaining !== undefined && task.estimatedSecondsRemaining > 0 && (
                <span>ETA: {formatDuration(task.estimatedSecondsRemaining)}</span>
              )}
            </div>
          </div>

          {task.currentFile && (
            <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
              {task.currentFile}
            </p>
          )}
        </div>
      )}

      {/* Completion info */}
      {task.status === 'completed' && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Extracted {task.extractedFileCount || 'all'} files successfully</span>
          </div>

          {task.deletedOriginal ? (
            <div className="flex items-center gap-1 text-emerald-300 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Original deleted ({formatBytes(task.archiveSize)} saved)</span>
            </div>
          ) : (
            <span className="text-slate-500">Original archive retained</span>
          )}
        </div>
      )}

      {/* Failure reason */}
      {task.status === 'failed' && task.errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Extraction Failed</p>
            <p className="text-rose-300/80 mt-0.5">{task.errorMessage}</p>
            <p className="text-[11px] text-slate-400 mt-1">Original archive remains safe and untouched.</p>
          </div>
        </div>
      )}
    </div>
  );
};
