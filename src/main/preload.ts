import { contextBridge, ipcRenderer } from 'electron';
import {
  AppSettings,
  DeleteConfirmPrompt,
  ExtractionOptions,
  ExtractionTask,
  HistoryItem,
  PasswordPrompt,
  StorageStats,
} from '../shared/types';

export const API = {
  // File dialogs
  openFileDialog: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  openPathInExplorer: (targetPath: string): Promise<string> => ipcRenderer.invoke('dialog:openPath', targetPath),

  // Extraction
  queueArchives: (filePaths: string[], options?: ExtractionOptions): Promise<ExtractionTask[]> =>
    ipcRenderer.invoke('extraction:queue', filePaths, options),
  cancelTask: (taskId: string): Promise<void> => ipcRenderer.invoke('extraction:cancel', taskId),
  pauseTask: (taskId: string): Promise<void> => ipcRenderer.invoke('extraction:pause', taskId),
  resumeTask: (taskId: string): Promise<void> => ipcRenderer.invoke('extraction:resume', taskId),
  retryTask: (taskId: string): Promise<void> => ipcRenderer.invoke('extraction:retry', taskId),
  providePassword: (taskId: string, password: string): Promise<void> =>
    ipcRenderer.invoke('extraction:providePassword', taskId, password),
  confirmDelete: (taskId: string, allowed: boolean): Promise<void> =>
    ipcRenderer.invoke('extraction:confirmDelete', taskId, allowed),
  getTasks: (): Promise<ExtractionTask[]> => ipcRenderer.invoke('extraction:getTasks'),

  // History & Statistics
  getHistory: (search?: string): Promise<HistoryItem[]> => ipcRenderer.invoke('history:get', search),
  clearHistory: (): Promise<void> => ipcRenderer.invoke('history:clear'),
  deleteHistoryItem: (id: string): Promise<void> => ipcRenderer.invoke('history:deleteItem', id),
  getStorageStats: (): Promise<StorageStats> => ipcRenderer.invoke('history:getStats'),

  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),

  // Event Listeners from Main
  onTaskUpdated: (callback: (task: ExtractionTask) => void) => {
    const handler = (_: any, task: ExtractionTask) => callback(task);
    ipcRenderer.on('task:updated', handler);
    return () => ipcRenderer.removeListener('task:updated', handler);
  },
  onPasswordRequired: (callback: (prompt: PasswordPrompt) => void) => {
    const handler = (_: any, prompt: PasswordPrompt) => callback(prompt);
    ipcRenderer.on('task:passwordRequired', handler);
    return () => ipcRenderer.removeListener('task:passwordRequired', handler);
  },
  onDeleteConfirmRequired: (callback: (prompt: DeleteConfirmPrompt) => void) => {
    const handler = (_: any, prompt: DeleteConfirmPrompt) => callback(prompt);
    ipcRenderer.on('task:deleteConfirmRequired', handler);
    return () => ipcRenderer.removeListener('task:deleteConfirmRequired', handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', API);
