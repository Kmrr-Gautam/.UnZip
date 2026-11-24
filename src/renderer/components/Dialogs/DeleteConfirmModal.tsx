import React from 'react';
import { Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { DeleteConfirmPrompt } from '../../../shared/types';
import { formatBytes } from '../../utils/format';

interface DeleteConfirmModalProps {
  prompt: DeleteConfirmPrompt | null;
  onConfirm: (taskId: string, allowed: boolean) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ prompt, onConfirm }) => {
  if (!prompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Delete Original Archive?</h3>
            <p className="text-xs text-slate-400">Extraction and verification succeeded</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 mb-2">
          The archive <span className="font-semibold text-white">"{prompt.archiveName}"</span> has been extracted and all files were verified.
        </p>

        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-6 flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-300 font-medium">
            Deleting this archive will immediately recover {formatBytes(prompt.savedBytes)} of disk space.
          </span>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={() => onConfirm(prompt.taskId, false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Keep Original
          </button>
          <button
            onClick={() => onConfirm(prompt.taskId, true)}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Archive</span>
          </button>
        </div>
      </div>
    </div>
  );
};
