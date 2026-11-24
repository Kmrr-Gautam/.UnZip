import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HistoryDatabase } from '../src/main/database/history-db';
import { HistoryItem } from '../src/shared/types';

describe('HistoryDatabase (SQLite Persistence)', () => {
  let tempDir: string;
  let testDb: HistoryDatabase;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'unzip_db_'));
    // Point internal db path to temp dir
    testDb = new HistoryDatabase();
    (testDb as any).dbPath = path.join(tempDir, 'test_history.sqlite');
    await testDb.initialize();
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('records extraction history and computes storage statistics', async () => {
    const item1: HistoryItem = {
      id: 'task_1',
      archiveName: 'ArchiveA.zip',
      archivePath: 'C:/Downloads/ArchiveA.zip',
      format: 'ZIP',
      originalSize: 1048576, // 1 MB
      extractedSize: 3145728, // 3 MB
      destination: 'C:/Downloads/ArchiveA',
      timestamp: Date.now() - 10000,
      durationMs: 1200,
      status: 'completed',
      storageSavedBytes: 1048576,
      deletedOriginal: true,
    };

    const item2: HistoryItem = {
      id: 'task_2',
      archiveName: 'ArchiveB.7z',
      archivePath: 'C:/Downloads/ArchiveB.7z',
      format: '7Z',
      originalSize: 2097152, // 2 MB
      extractedSize: 8388608, // 8 MB
      destination: 'C:/Downloads/ArchiveB',
      timestamp: Date.now(),
      durationMs: 2500,
      status: 'completed',
      storageSavedBytes: 0,
      deletedOriginal: false,
    };

    await testDb.addHistory(item1);
    await testDb.addHistory(item2);

    const history = await testDb.getHistory();
    expect(history.length).toBe(2);

    const stats = await testDb.getStorageStats();
    expect(stats.totalArchivesExtracted).toBe(2);
    expect(stats.totalStorageSavedBytes).toBe(1048576); // Only ArchiveA was deleted
  });

  it('survives application restarts by reloading SQLite database file from disk', async () => {
    const item: HistoryItem = {
      id: 'persistent_task',
      archiveName: 'Important.rar',
      archivePath: 'C:/Downloads/Important.rar',
      format: 'RAR',
      originalSize: 500000,
      extractedSize: 1500000,
      destination: 'C:/Downloads/Important',
      timestamp: Date.now(),
      durationMs: 800,
      status: 'completed',
      storageSavedBytes: 500000,
      deletedOriginal: true,
    };

    await testDb.addHistory(item);

    // Simulate application restart by creating a new database instance pointing to same file
    const restartedDb = new HistoryDatabase();
    (restartedDb as any).dbPath = (testDb as any).dbPath;
    await restartedDb.initialize();

    const reloadedHistory = await restartedDb.getHistory();
    expect(reloadedHistory.length).toBe(1);
    expect(reloadedHistory[0].archiveName).toBe('Important.rar');
    expect(reloadedHistory[0].deletedOriginal).toBe(true);
  });
});
