import React from 'react';
import { Folder, ArrowUpRight, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { HistoryItem } from '../../../shared/types';
import { formatBytes, formatTimestamp, getFormatColor } from '../../utils/format';

interface RecentListProps {
  recentItems: HistoryItem[];
  onOpenFolder: (path: string) => void;
  onViewAll: () => void;
}

export const RecentList: React.FC<RecentListProps> = ({ recentItems, onOpenFolder, onViewAll }) => {
  if (recentItems.length === 0) {
    return (
      <div className="rounded-2xl p-8 bg-slate-900/40 border border-slate-800/80 text-center">
        <p className="text-sm text-slate-400">No archives extracted yet. Select or drop a file to start.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Recently Extracted Files</h3>
        <button
          onClick={onViewAll}
          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          <span>View All History</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="divide-y divide-slate-800/50">
        {recentItems.slice(0, 5).map((item) => {
          const color = getFormatColor(item.format);
          return (
            <div
              key={item.id}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}
                >
                  {item.format}
                </span>

                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{item.archiveName}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {formatTimestamp(item.timestamp)} &bull; {formatBytes(item.extractedSize)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {item.deletedOriginal && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Cleaned
                  </span>
                )}

                <button
                  onClick={() => onOpenFolder(item.destination)}
                  title="Open folder in File Explorer"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
                >
                  <Folder className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
