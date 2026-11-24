import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DropZone } from './components/Dashboard/DropZone';
import { StatsOverview } from './components/Dashboard/StatsOverview';
import { RecentList } from './components/Dashboard/RecentList';
import { ActiveTaskCard } from './components/Extraction/ActiveTaskCard';
import { HistoryView } from './components/History/HistoryView';
import { SettingsView } from './components/Settings/SettingsView';
import { AboutView } from './components/About/AboutView';
import { PasswordModal } from './components/Dialogs/PasswordModal';
import { DeleteConfirmModal } from './components/Dialogs/DeleteConfirmModal';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  DeleteConfirmPrompt,
  ExtractionTask,
  HistoryItem,
  PasswordPrompt,
  StorageStats,
} from '../shared/types';
import { Layers, FolderArchive, ArrowLeft } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [tasks, setTasks] = useState<ExtractionTask[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState<StorageStats>({
    totalArchivesExtracted: 0,
    totalStorageSavedBytes: 0,
    totalOriginalBytes: 0,
    totalExtractedBytes: 0,
  });
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [passwordPrompt, setPasswordPrompt] = useState<PasswordPrompt | null>(null);
  const [deleteConfirmPrompt, setDeleteConfirmPrompt] = useState<DeleteConfirmPrompt | null>(null);

  // Initialize data and register listeners
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    // Load initial state
    window.electronAPI.getSettings().then(setSettings).catch(console.error);
    window.electronAPI.getStorageStats().then(setStats).catch(console.error);
    window.electronAPI.getHistory().then(setHistory).catch(console.error);
    window.electronAPI.getTasks().then(setTasks).catch(console.error);

    // Listen to real-time task updates
    const unbindTask = window.electronAPI.onTaskUpdated((updatedTask) => {
      setTasks((prev) => {
        const index = prev.findIndex((t) => t.id === updatedTask.id);
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = updatedTask;
          return clone;
        } else {
          return [updatedTask, ...prev];
        }
      });

      // Refresh history & stats if task completed or failed
      if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
        window.electronAPI.getStorageStats().then(setStats).catch(console.error);
        window.electronAPI.getHistory().then(setHistory).catch(console.error);
      }
    });

    const unbindPassword = window.electronAPI.onPasswordRequired((prompt) => {
      setPasswordPrompt(prompt);
    });

    const unbindDeleteConfirm = window.electronAPI.onDeleteConfirmRequired((prompt) => {
      setDeleteConfirmPrompt(prompt);
    });

    return () => {
      unbindTask();
      unbindPassword();
      unbindDeleteConfirm();
    };
  }, []);

  // Handlers
  const handleQueueFiles = async (filePaths: string[]) => {
    if (!filePaths || filePaths.length === 0) return;
    try {
      const queued = await window.electronAPI.queueArchives(filePaths);
      setTasks((prev) => [...queued, ...prev]);
      setCurrentTab('tasks');
    } catch (err) {
      console.error('Failed to queue files:', err);
    }
  };

  const handleBrowseFiles = async () => {
    try {
      const files = await window.electronAPI.openFileDialog();
      if (files && files.length > 0) {
        handleQueueFiles(files);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
    }
  };

  const handleBrowseFolder = async () => {
    try {
      const folder = await window.electronAPI.openFolderDialog();
      if (folder) {
        handleQueueFiles([folder]);
      }
    } catch (err) {
      console.error('Failed to open folder dialog:', err);
    }
  };

  const handleOpenPath = (targetPath: string) => {
    window.electronAPI.openPathInExplorer(targetPath);
  };

  const handlePauseTask = (taskId: string) => {
    window.electronAPI.pauseTask(taskId);
  };

  const handleResumeTask = (taskId: string) => {
    window.electronAPI.resumeTask(taskId);
  };

  const handleCancelTask = (taskId: string) => {
    window.electronAPI.cancelTask(taskId);
  };

  const handleRetryTask = (taskId: string) => {
    window.electronAPI.retryTask(taskId);
  };

  const handlePasswordSubmit = (taskId: string, password: string) => {
    window.electronAPI.providePassword(taskId, password);
    setPasswordPrompt(null);
  };

  const handleDeleteConfirm = (taskId: string, allowed: boolean) => {
    window.electronAPI.confirmDelete(taskId, allowed);
    setDeleteConfirmPrompt(null);
  };

  const handleClearHistory = async () => {
    await window.electronAPI.clearHistory();
    setHistory([]);
    const freshStats = await window.electronAPI.getStorageStats();
    setStats(freshStats);
  };

  const handleDeleteHistoryItem = async (id: string) => {
    await window.electronAPI.deleteHistoryItem(id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleSaveSettings = async (partial: Partial<AppSettings>) => {
    const updated = await window.electronAPI.updateSettings(partial);
    setSettings(updated);
  };

  const handleResetSettings = async () => {
    const fresh = await window.electronAPI.resetSettings();
    setSettings(fresh);
  };

  const activeTaskCount = tasks.filter(
    (t) => t.status === 'extracting' || t.status === 'verifying' || t.status === 'queued'
  ).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        activeTaskCount={activeTaskCount}
        storageSavedBytes={stats.totalStorageSavedBytes}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950/60">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-3">
            {currentTab !== 'dashboard' && (
              <button
                onClick={() => setCurrentTab('dashboard')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-sm font-bold text-white capitalize">
                {currentTab === 'tasks' ? 'Extract Files' : currentTab}
              </h1>
              <p className="text-[11px] text-slate-400">
                {currentTab === 'dashboard'
                  ? 'Universal File Extraction & Space Reclamation'
                  : currentTab === 'tasks'
                  ? 'Live Extraction Monitor & Queue Manager'
                  : currentTab === 'history'
                  ? 'Historical extraction records'
                  : currentTab === 'settings'
                  ? 'System configurations'
                  : 'About .UnZip Universal Extractor'}
              </p>
            </div>
          </div>

          {/* Quick Browse button in header if not on dashboard */}
          {currentTab !== 'dashboard' && (
            <button
              onClick={handleBrowseFiles}
              className="skeuo-button-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-950 flex items-center gap-1.5"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Extract More</span>
            </button>
          )}
        </header>

        {/* Scrollable View Container */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* TAB 1: DASHBOARD */}
          {currentTab === 'dashboard' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="text-left mb-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  What would you like to extract?
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select archives to decompress. Space is automatically recovered upon successful extraction.
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <DropZone
                onFilesSelected={handleQueueFiles}
                onBrowseFiles={handleBrowseFiles}
                onBrowseFolder={handleBrowseFolder}
              />

              {/* Stats Overview */}
              <StatsOverview stats={stats} activeCount={activeTaskCount} />

              {/* Active Tasks Quick View (if any active) */}
              {tasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Active Extraction Tasks</h3>
                    <button
                      onClick={() => setCurrentTab('tasks')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      View All ({tasks.length})
                    </button>
                  </div>
                  <div className="space-y-3">
                    {tasks.slice(0, 3).map((task) => (
                      <ActiveTaskCard
                        key={task.id}
                        task={task}
                        onPause={handlePauseTask}
                        onResume={handleResumeTask}
                        onCancel={handleCancelTask}
                        onRetry={handleRetryTask}
                        onOpenFolder={handleOpenPath}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Files */}
              <RecentList
                recentItems={history}
                onOpenFolder={handleOpenPath}
                onViewAll={() => setCurrentTab('history')}
              />
            </div>
          )}

          {/* TAB 2: ACTIVE TASKS & QUEUE */}
          {currentTab === 'tasks' && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Extraction Queue</h2>
                  <p className="text-xs text-slate-400">
                    Real-time progress, file rates, and automated verification status
                  </p>
                </div>

                <button
                  onClick={handleBrowseFiles}
                  className="skeuo-button-primary px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 flex items-center gap-1.5"
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>Add Archives</span>
                </button>
              </div>

              {tasks.length === 0 ? (
                <div className="rounded-2xl p-12 bg-slate-900/40 border border-slate-800 text-center">
                  <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-300">No active extraction tasks</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">
                    Drop or select an archive to start extraction
                  </p>
                  <button
                    onClick={handleBrowseFiles}
                    className="skeuo-button-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950"
                  >
                    Select Archive
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <ActiveTaskCard
                      key={task.id}
                      task={task}
                      onPause={handlePauseTask}
                      onResume={handleResumeTask}
                      onCancel={handleCancelTask}
                      onRetry={handleRetryTask}
                      onOpenFolder={handleOpenPath}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: HISTORY */}
          {currentTab === 'history' && (
            <div className="max-w-5xl mx-auto">
              <HistoryView
                history={history}
                onOpenFolder={handleOpenPath}
                onClearHistory={handleClearHistory}
                onDeleteItem={handleDeleteHistoryItem}
              />
            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {currentTab === 'settings' && (
            <div className="max-w-4xl mx-auto">
              <SettingsView
                settings={settings}
                onSave={handleSaveSettings}
                onReset={handleResetSettings}
                onSelectDir={window.electronAPI.openFolderDialog}
              />
            </div>
          )}

          {/* TAB 5: ABOUT */}
          {currentTab === 'about' && (
            <div className="max-w-4xl mx-auto">
              <AboutView />
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      <PasswordModal
        prompt={passwordPrompt}
        onSubmit={handlePasswordSubmit}
        onCancel={() => setPasswordPrompt(null)}
      />

      <DeleteConfirmModal
        prompt={deleteConfirmPrompt}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
