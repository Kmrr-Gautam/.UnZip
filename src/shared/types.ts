export type ArchiveFormat =
  | 'ZIP'
  | 'RAR'
  | '7Z'
  | 'TAR'
  | 'TAR.GZ'
  | 'TGZ'
  | 'GZ'
  | 'BZ2'
  | 'XZ'
  | 'ISO'
  | 'CAB'
  | 'ARJ'
  | 'LZH'
  | 'WIM'
  | 'Z'
  | 'ZST'
  | 'UNKNOWN';

export type TaskStatus =
  | 'idle'
  | 'queued'
  | 'extracting'
  | 'verifying'
  | 'deleting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

export type DestinationMode =
  | 'archive_folder'
  | 'same_folder'
  | 'custom'
  | 'ask';

export type ConflictResolution =
  | 'merge'
  | 'rename_numbered'
  | 'custom'
  | 'cancel';

export type AutoDeleteSetting =
  | 'always'
  | 'ask'
  | 'never';

export interface ArchiveMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  format: ArchiveFormat;
  detectedBy: 'signature' | 'extension';
  isPasswordProtected?: boolean;
  entryCount?: number;
  totalUncompressedSize?: number;
  isMultiPart?: boolean;
  partIndex?: number;
}

export interface ExtractionTask {
  id: string;
  archivePath: string;
  archiveName: string;
  format: ArchiveFormat;
  archiveSize: number;
  destinationDir: string;
  status: TaskStatus;
  progress: number; // 0 - 100
  extractedBytes: number;
  totalBytes: number;
  currentFile?: string;
  extractedFileCount: number;
  totalFileCount?: number;
  speedBytesPerSec: number;
  estimatedSecondsRemaining?: number;
  startTime: number;
  endTime?: number;
  errorMessage?: string;
  deletedOriginal?: boolean;
  isPasswordProtected?: boolean;
  password?: string;
}

export interface ExtractionOptions {
  destinationDir?: string;
  destinationMode?: DestinationMode;
  conflictResolution?: ConflictResolution;
  password?: string;
  autoDelete?: AutoDeleteSetting;
}

export interface HistoryItem {
  id: string;
  archiveName: string;
  archivePath: string;
  format: ArchiveFormat;
  originalSize: number;
  extractedSize: number;
  destination: string;
  timestamp: number;
  durationMs: number;
  status: 'completed' | 'failed' | 'cancelled';
  storageSavedBytes: number;
  deletedOriginal: boolean;
  errorMessage?: string;
}

export interface AppSettings {
  general: {
    startOnStartup: boolean;
    minimizeToTray: boolean;
    defaultExtractDir: string;
    defaultDestinationMode: DestinationMode;
  };
  storage: {
    autoDeleteArchives: AutoDeleteSetting;
  };
  performance: {
    maxConcurrentExtractions: number;
    bufferSizeKb: number;
    lowResourceMode: boolean;
  };
  appearance: {
    theme: 'system' | 'light' | 'dark';
    reducedMotion: boolean;
  };
  notifications: {
    onCompleted: boolean;
    onFailed: boolean;
    onArchiveDeleted: boolean;
    onBatchCompleted: boolean;
  };
  advanced: {
    tempExtractDir?: string;
    loggingEnabled: boolean;
  };
}

export interface StorageStats {
  totalArchivesExtracted: number;
  totalStorageSavedBytes: number;
  totalOriginalBytes: number;
  totalExtractedBytes: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    startOnStartup: false,
    minimizeToTray: false,
    defaultExtractDir: '',
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


export interface FolderConflict {
  taskId: string;
  archivePath: string;
  targetDir: string;
  suggestedNumberedDir: string;
}

export interface PasswordPrompt {
  taskId: string;
  archivePath: string;
  archiveName: string;
}

export interface DeleteConfirmPrompt {
  taskId: string;
  archivePath: string;
  archiveName: string;
  savedBytes: number;
}
