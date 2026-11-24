import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AppSettings } from '../../shared/types';
import { logger } from '../logger';

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    startOnStartup: false,
    minimizeToTray: false,
    defaultExtractDir: path.join(os.homedir(), 'Downloads'),
    defaultDestinationMode: 'archive_folder',
  },
  storage: {
    autoDeleteArchives: 'always',
  },
  performance: {
    maxConcurrentExtractions: 2,
    bufferSizeKb: 1024,
    lowResourceMode: false,
  },
  appearance: {
    theme: 'dark',
    reducedMotion: false,
  },
  notifications: {
    onCompleted: true,
    onFailed: true,
    onArchiveDeleted: true,
    onBatchCompleted: true,
  },
  advanced: {
    loggingEnabled: true,
  },
};

export class SettingsStore {
  private settingsFilePath: string;
  private currentSettings: AppSettings;

  constructor() {
    const appDir = path.join(os.homedir(), '.UnZip');
    if (!fs.existsSync(appDir)) {
      try {
        fs.mkdirSync(appDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.settingsFilePath = path.join(appDir, 'settings.json');
    this.currentSettings = this.load();
  }

  private load(): AppSettings {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const raw = fs.readFileSync(this.settingsFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        // Deep merge with defaults to handle new fields
        return {
          general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
          storage: { ...DEFAULT_SETTINGS.storage, ...(parsed.storage || {}) },
          performance: { ...DEFAULT_SETTINGS.performance, ...(parsed.performance || {}) },
          appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
          advanced: { ...DEFAULT_SETTINGS.advanced, ...(parsed.advanced || {}) },
        };
      }
    } catch (err) {
      logger.error('Failed to parse settings file, using defaults:', err);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  public getSettings(): AppSettings {
    return { ...this.currentSettings };
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    this.currentSettings = {
      general: { ...this.currentSettings.general, ...(partial.general || {}) },
      storage: { ...this.currentSettings.storage, ...(partial.storage || {}) },
      performance: { ...this.currentSettings.performance, ...(partial.performance || {}) },
      appearance: { ...this.currentSettings.appearance, ...(partial.appearance || {}) },
      notifications: { ...this.currentSettings.notifications, ...(partial.notifications || {}) },
      advanced: { ...this.currentSettings.advanced, ...(partial.advanced || {}) },
    };

    this.save();
    return this.getSettings();
  }

  public resetToDefaults(): AppSettings {
    this.currentSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.save();
    return this.getSettings();
  }

  private save() {
    try {
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
      logger.info('Settings saved successfully.');
    } catch (err) {
      logger.error('Failed to save settings:', err);
    }
  }
}

export const settingsStore = new SettingsStore();
