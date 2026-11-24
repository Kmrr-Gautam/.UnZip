import React, { useState } from 'react';
import { KeyRound, Lock, X } from 'lucide-react';
import { PasswordPrompt } from '../../../shared/types';

interface PasswordModalProps {
  prompt: PasswordPrompt | null;
  onSubmit: (taskId: string, password: string) => void;
  onCancel: (taskId: string) => void;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ prompt, onSubmit, onCancel }) => {
  const [password, setPassword] = useState('');

  if (!prompt) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onSubmit(prompt.taskId, password);
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Password Required</h3>
              <p className="text-xs text-slate-400">Archive contents are encrypted</p>
            </div>
          </div>
          <button
            onClick={() => onCancel(prompt.taskId)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          Please enter the password to decrypt and extract{' '}
          <span className="font-semibold text-white">"{prompt.archiveName}"</span>.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-6">
            <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter archive password..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onCancel(prompt.taskId)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password}
              className="skeuo-button-primary px-5 py-2 rounded-xl text-sm font-semibold text-slate-950 disabled:opacity-50 transition-opacity"
            >
              Unlock & Extract
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
