import React, { useState } from 'react';
import {
  History,
  Search,
  Trash2,
  FolderOpen,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  DownloadCloud,
} from 'lucide-react';
import { HistoryItem } from '../../../shared/types';
import {
  formatBytes,
  formatDuration,
  formatTimestamp,
  getFormatColor,
} from '../../utils/format';

interface HistoryViewProps {
  history: HistoryItem[];
  onOpenFolder: (path: string) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onOpenFolder,
  onClearHistory,
  onDeleteItem,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = history.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.archiveName.toLowerCase().includes(term) ||
      item.destination.toLowerCase().includes(term) ||
      item.format.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Extraction History</h2>
          <p className="text-xs text-slate-400">
            Audit log of all processed archives and storage recovered
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={onClearHistory}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 flex items-center gap-1.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by archive name, format, or destination..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 bg-slate-900/40 border border-slate-800 text-center">
          <History className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-300">No records found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {searchTerm ? 'Try a different search query' : 'Extracted archives will appear here'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Archive</th>
                  <th className="px-4 py-3.5">Format</th>
                  <th className="px-4 py-3.5">Sizes</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Storage Saved</th>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => {
                  const color = getFormatColor(item.format);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-white max-w-xs truncate">
                          {item.archiveName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {item.destination}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded border text-[10px] ${color.bg} ${color.text} ${color.border}`}
                        >
                          {item.format}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div>{formatBytes(item.extractedSize)}</div>
                        <div className="text-[11px] text-slate-500">
                          Orig: {formatBytes(item.originalSize)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {item.status}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        {item.deletedOriginal ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <HardDrive className="w-3 h-3 text-emerald-400" />
                            +{formatBytes(item.storageSavedBytes)}
                          </span>
                        ) : (
                          <span className="text-slate-500">Retained</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">
                        {formatTimestamp(item.timestamp)}
                        <span className="text-[10px] text-slate-500 ml-1.5">
                          ({formatDuration(Math.round(item.durationMs / 1000))})
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenFolder(item.destination)}
                            title="Open extracted folder"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            title="Delete entry from history"
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
