import React, { useState } from 'react';
import {
  Save,
  RotateCcw,
  HardDrive,
  Cpu,
  Palette,
  Bell,
  Sliders,
  Folder,
  ShieldAlert,
  Check,
} from 'lucide-react';
import { AppSettings, AutoDeleteSetting, DestinationMode } from '../../../shared/types';

interface SettingsViewProps {
  settings: AppSettings;
  onSave: (updated: Partial<AppSettings>) => void;
  onReset: () => void;
  onSelectDir: () => Promise<string | null>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSave,
  onReset,
  onSelectDir,
}) => {
  const [current, setCurrent] = useState<AppSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);

  const handleUpdate = (updater: (prev: AppSettings) => AppSettings) => {
    const next = updater(current);
    setCurrent(next);
    onSave(next);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleBrowseDefaultDir = async () => {
    const selected = await onSelectDir();
    if (selected) {
      handleUpdate((prev) => ({
        ...prev,
        general: { ...prev.general, defaultExtractDir: selected },
      }));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl pb-10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Application Settings</h2>
          <p className="text-xs text-slate-400">Configure extraction behavior, storage rules, and performance</p>
        </div>

        <div className="flex items-center gap-3">
          {savedToast && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium animate-fadeIn">
              <Check className="w-4 h-4" /> Changes saved
            </span>
          )}
          <button
            onClick={onReset}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* 1. Storage & Deletion Rule (Primary Feature) */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-emerald-500/30 shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Automatic Archive Deletion System</h3>
            <p className="text-xs text-slate-400">Permanently removes source archives only after verified extraction</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              value: 'always',
              label: 'Always delete archive after successful verification (Recommended)',
              desc: 'Original archive is automatically deleted as soon as all extracted files pass readability and integrity checks.',
            },
            {
              value: 'ask',
              label: 'Ask before deleting each archive',
              desc: 'Shows a quick confirmation dialog with storage space savings before removing original files.',
            },
            {
              value: 'never',
              label: 'Never delete archives automatically',
              desc: 'Preserves all original archives regardless of extraction success.',
            },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                current.storage.autoDeleteArchives === option.value
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800/60'
              }`}
            >
              <input
                type="radio"
                name="autoDelete"
                value={option.value}
                checked={current.storage.autoDeleteArchives === option.value}
                onChange={() =>
                  handleUpdate((prev) => ({
                    ...prev,
                    storage: { ...prev.storage, autoDeleteArchives: option.value as AutoDeleteSetting },
                  }))
                }
                className="mt-1 accent-emerald-500"
              />
              <div>
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{option.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 2. General Settings */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">General & Destination Handling</h3>
            <p className="text-xs text-slate-400">Configure where extracted folders are placed</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Default Destination Mode
            </label>
            <select
              value={current.general.defaultDestinationMode}
              onChange={(e) =>
                handleUpdate((prev) => ({
                  ...prev,
                  general: { ...prev.general, defaultDestinationMode: e.target.value as DestinationMode },
                }))
              }
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="archive_folder">Extract into a folder named after the archive (e.g. Project/)</option>
              <option value="same_folder">Extract directly into current archive directory</option>
              <option value="custom">Extract into custom folder</option>
              <option value="ask">Ask for destination on every extraction</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Default Destination Directory
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={current.general.defaultExtractDir}
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono"
              />
              <button
                onClick={handleBrowseDefaultDir}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <Folder className="w-4 h-4 text-slate-400" />
                <span>Browse</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">Minimize to System Tray</p>
              <p className="text-xs text-slate-400">Keep application running in background when window is closed</p>
            </div>
            <input
              type="checkbox"
              checked={current.general.minimizeToTray}
              onChange={(e) =>
                handleUpdate((prev) => ({
                  ...prev,
                  general: { ...prev.general, minimizeToTray: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 3. Performance Settings */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Performance & Concurrency</h3>
            <p className="text-xs text-slate-400">Control CPU and RAM utilization during batch extractions</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Maximum Simultaneous Extractions
              </label>
              <span className="text-xs font-bold text-emerald-400 font-mono">
                {current.performance.maxConcurrentExtractions} parallel tasks
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={current.performance.maxConcurrentExtractions}
              onChange={(e) =>
                handleUpdate((prev) => ({
                  ...prev,
                  performance: {
                    ...prev.performance,
                    maxConcurrentExtractions: parseInt(e.target.value, 10),
                  },
                }))
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Limits concurrent child processes to prevent system stuttering on large archives.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">Low-Resource Mode</p>
              <p className="text-xs text-slate-400">Reduces thread allocation and lowers background process priority</p>
            </div>
            <input
              type="checkbox"
              checked={current.performance.lowResourceMode}
              onChange={(e) =>
                handleUpdate((prev) => ({
                  ...prev,
                  performance: { ...prev.performance, lowResourceMode: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 4. Appearance & Accessibility */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Appearance & Motion</h3>
            <p className="text-xs text-slate-400">UI theme and accessibility preferences</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">Color Theme</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'dark', label: 'Dark Mode' },
                { id: 'light', label: 'Light Mode' },
                { id: 'system', label: 'System Default' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  onClick={() =>
                    handleUpdate((prev) => ({
                      ...prev,
                      appearance: { ...prev.appearance, theme: theme.id as any },
                    }))
                  }
                  className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                    current.appearance.theme === theme.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">Reduced Motion</p>
              <p className="text-xs text-slate-400">Disables UI transition animations for accessibility</p>
            </div>
            <input
              type="checkbox"
              checked={current.appearance.reducedMotion}
              onChange={(e) =>
                handleUpdate((prev) => ({
                  ...prev,
                  appearance: { ...prev.appearance, reducedMotion: e.target.checked },
                }))
              }
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* 5. Notifications */}
      <section className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Desktop Notifications</h3>
            <p className="text-xs text-slate-400">Configure native system alerts</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { key: 'onCompleted', label: 'Extraction completed successfully' },
            { key: 'onFailed', label: 'Extraction encountered an error' },
            { key: 'onArchiveDeleted', label: 'Original archive deleted confirmation' },
            { key: 'onBatchCompleted', label: 'Batch extraction queue finished' },
          ].map((notif) => (
            <div key={notif.key} className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-300">{notif.label}</span>
              <input
                type="checkbox"
                checked={(current.notifications as any)[notif.key]}
                onChange={(e) =>
                  handleUpdate((prev) => ({
                    ...prev,
                    notifications: { ...prev.notifications, [notif.key]: e.target.checked },
                  }))
                }
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
