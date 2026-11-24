import { app, BrowserWindow, dialog, ipcMain, shell, Notification, Tray, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger';
import { extractionEngine } from './extraction/engine';
import { historyDb } from './database/history-db';
import { settingsStore } from './settings/settings-store';
import { ExtractionOptions, ExtractionTask } from '../shared/types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isAppQuitting = false;

const SUPPORTED_EXTENSIONS = [
  'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'iso', 'cab', 'arj', 'lzh', 'wim', 'z', 'zst'
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    title: '.UnZip - Universal File Extraction',
    backgroundColor: '#0F172A',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Production: load built index.html
    const possiblePaths = [
      path.join(__dirname, '..', '..', 'renderer', 'index.html'),
      path.join(__dirname, '..', 'renderer', 'index.html'),
      path.join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
    ];
    let loaded = false;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        mainWindow.loadFile(p);
        loaded = true;
        break;
      }
    }
    if (!loaded) {
      mainWindow.loadFile(possiblePaths[0]);
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    const settings = settingsStore.getSettings();
    if (settings.general.minimizeToTray && !isAppQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Setup extraction engine event propagation to renderer
  extractionEngine.on('taskUpdated', (task: ExtractionTask) => {
    mainWindow?.webContents.send('task:updated', task);
  });

  extractionEngine.on('taskCompleted', (task: ExtractionTask) => {
    mainWindow?.webContents.send('task:updated', task);

    const settings = settingsStore.getSettings();
    if (settings.notifications.onCompleted && Notification.isSupported()) {
      const deleteMsg = task.deletedOriginal ? ' (Original archive deleted)' : '';
      new Notification({
        title: '.UnZip Extraction Complete',
        body: `"${task.archiveName}" was extracted successfully.${deleteMsg}`,
      }).show();
    }
  });

  extractionEngine.on('taskFailed', (task: ExtractionTask) => {
    mainWindow?.webContents.send('task:updated', task);

    const settings = settingsStore.getSettings();
    if (settings.notifications.onFailed && Notification.isSupported()) {
      new Notification({
        title: '.UnZip Extraction Failed',
        body: `"${task.archiveName}": ${task.errorMessage || 'Extraction failed.'}`,
      }).show();
    }
  });

  extractionEngine.on('passwordRequired', (prompt) => {
    mainWindow?.webContents.send('task:passwordRequired', prompt);
  });

  extractionEngine.on('deleteConfirmationRequired', (prompt) => {
    mainWindow?.webContents.send('task:deleteConfirmRequired', prompt);
  });
}

// App lifecycle
app.on('before-quit', () => {
  isAppQuitting = true;
});

app.whenReady().then(async () => {
  logger.info('.UnZip application starting up...');
  await historyDb.initialize();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Register IPC handlers
ipcMain.handle('dialog:openFiles', async () => {
  if (!mainWindow) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Archives to Extract',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Supported Archives', extensions: SUPPORTED_EXTENSIONS },
      { name: 'ZIP Archives', extensions: ['zip'] },
      { name: 'RAR Archives', extensions: ['rar'] },
      { name: '7-Zip Archives', extensions: ['7z', '001'] },
      { name: 'TAR & GZ Archives', extensions: ['tar', 'gz', 'tgz', 'bz2', 'xz'] },
      { name: 'ISO Images', extensions: ['iso'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  return result.filePaths || [];
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Destination Folder',
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.filePaths && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:openPath', async (_, targetPath: string) => {
  if (!targetPath) return 'No path provided';
  try {
    return await shell.openPath(targetPath);
  } catch (err: any) {
    return err.message;
  }
});

// Extraction handlers
ipcMain.handle('extraction:queue', async (_, filePaths: string[], options?: ExtractionOptions) => {
  return await extractionEngine.queueArchives(filePaths, options);
});

ipcMain.handle('extraction:cancel', (_, taskId: string) => {
  extractionEngine.cancelTask(taskId);
});

ipcMain.handle('extraction:pause', (_, taskId: string) => {
  extractionEngine.pauseTask(taskId);
});

ipcMain.handle('extraction:resume', (_, taskId: string) => {
  extractionEngine.resumeTask(taskId);
});

ipcMain.handle('extraction:retry', (_, taskId: string) => {
  extractionEngine.retryTask(taskId);
});

ipcMain.handle('extraction:providePassword', (_, taskId: string, password: string) => {
  extractionEngine.executeTask(taskId, password);
});

ipcMain.handle('extraction:confirmDelete', (_, taskId: string, allowed: boolean) => {
  extractionEngine.confirmDeletion(taskId, allowed);
});

ipcMain.handle('extraction:getTasks', () => {
  return extractionEngine.getTasks();
});

// History handlers
ipcMain.handle('history:get', async (_, search?: string) => {
  return await historyDb.getHistory(search);
});

ipcMain.handle('history:clear', async () => {
  return await historyDb.clearHistory();
});

ipcMain.handle('history:deleteItem', async (_, id: string) => {
  return await historyDb.deleteHistoryItem(id);
});

ipcMain.handle('history:getStats', async () => {
  return await historyDb.getStorageStats();
});

// Settings handlers
ipcMain.handle('settings:get', () => {
  return settingsStore.getSettings();
});

ipcMain.handle('settings:update', (_, partial: Partial<any>) => {
  return settingsStore.updateSettings(partial);
});

ipcMain.handle('settings:reset', () => {
  return settingsStore.resetToDefaults();
});
