import React from 'react';
import { HardDrive, CheckCircle2, Clock, Layers } from 'lucide-react';
import { formatBytes } from '../../utils/format';
import { StorageStats } from '../../../shared/types';

interface StatsOverviewProps {
  stats: StorageStats;
  activeCount: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, activeCount }) => {
  const cards = [
    {
      label: 'Storage Space Saved',
      value: formatBytes(stats.totalStorageSavedBytes),
      subtext: 'Auto-cleaned after extraction',
      icon: HardDrive,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Archives Extracted',
      value: stats.totalArchivesExtracted.toLocaleString(),
      subtext: `${formatBytes(stats.totalExtractedBytes)} total unpacked data`,
      icon: CheckCircle2,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
    },
    {
      label: 'Active Extractions',
      value: activeCount.toString(),
      subtext: activeCount > 0 ? 'Currently processing in queue' : 'System idle & ready',
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-sm flex items-start justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">{card.label}</p>
              <h3 className="text-2xl font-bold text-white tracking-tight">{card.value}</h3>
              <p className="text-xs text-slate-500 mt-1">{card.subtext}</p>
            </div>
            <div className={`p-3 rounded-xl ${card.bg} ${card.border} border`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
