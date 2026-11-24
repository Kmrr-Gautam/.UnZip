import React from 'react';
import {
  FolderArchive,
  Layers,
  History,
  Settings,
  Info,
  HardDriveDownload,
  CheckCircle2,
} from 'lucide-react';
import { formatBytes } from '../utils/format';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  activeTaskCount: number;
  storageSavedBytes: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  activeTaskCount,
  storageSavedBytes,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: FolderArchive },
    {
      id: 'tasks',
      label: 'Extract Files',
      icon: Layers,
      badge: activeTaskCount > 0 ? activeTaskCount : null,
    },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'about', label: 'About .UnZip', icon: Info },
  ];

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 select-none">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 skeuo-card">
            <FolderArchive className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white font-mono">.UnZip</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">Universal File Extractor</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Storage Stats Widget */}
      <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-2">
          <HardDriveDownload className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">Space Recovered</span>
        </div>
        <div className="text-lg font-bold text-white tracking-tight">
          {formatBytes(storageSavedBytes)}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Auto-cleaned after extract
        </p>
      </div>
    </aside>
  );
};
