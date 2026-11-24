import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { HistoryItem, StorageStats } from '../../shared/types';
import { logger } from '../logger';

export class HistoryDatabase {
  private db: Database | null = null;
  private dbPath: string;
  private SQL: SqlJsStatic | null = null;
  private isInitialized = false;

  constructor() {
    const appDir = path.join(os.homedir(), '.UnZip');
    if (!fs.existsSync(appDir)) {
      try {
        fs.mkdirSync(appDir, { recursive: true });
      } catch {
        // ignore
      }
    }
    this.dbPath = path.join(appDir, 'unzip_history.sqlite');
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.SQL = await initSqlJs();
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = await fs.promises.readFile(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
        logger.info(`Loaded existing SQLite history database from ${this.dbPath}`);
      } else {
        this.db = new this.SQL.Database();
        logger.info(`Created new SQLite history database at ${this.dbPath}`);
      }

      this.createTables();
      this.isInitialized = true;
    } catch (err) {
      logger.error('Failed to initialize SQLite history database:', err);
      // Fallback: create in-memory database
      if (this.SQL) {
        this.db = new this.SQL.Database();
        this.createTables();
        this.isInitialized = true;
      }
    }
  }

  private createTables() {
    if (!this.db) return;

    this.db.run(`
      CREATE TABLE IF NOT EXISTS extraction_history (
        id TEXT PRIMARY KEY,
        archive_name TEXT NOT NULL,
        archive_path TEXT NOT NULL,
        format TEXT NOT NULL,
        original_size INTEGER NOT NULL,
        extracted_size INTEGER NOT NULL,
        destination TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        status TEXT NOT NULL,
        storage_saved_bytes INTEGER NOT NULL,
        deleted_original INTEGER NOT NULL,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_history_timestamp ON extraction_history(timestamp DESC);
    `);

    this.persist();
  }

  public async addHistory(item: HistoryItem): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    try {
      this.db.run(
        `INSERT OR REPLACE INTO extraction_history (
          id, archive_name, archive_path, format, original_size,
          extracted_size, destination, timestamp, duration_ms,
          status, storage_saved_bytes, deleted_original, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.archiveName,
          item.archivePath,
          item.format,
          item.originalSize,
          item.extractedSize,
          item.destination,
          item.timestamp,
          item.durationMs,
          item.status,
          item.storageSavedBytes,
          item.deletedOriginal ? 1 : 0,
          item.errorMessage || null,
        ]
      );

      this.persist();
      logger.info(`Recorded extraction history item: ${item.archiveName} (${item.status})`);
    } catch (err) {
      logger.error(`Error saving history item ${item.id}:`, err);
    }
  }

  public async getHistory(search?: string, limit: number = 100): Promise<HistoryItem[]> {
    await this.initialize();
    if (!this.db) return [];

    try {
      let query = 'SELECT * FROM extraction_history';
      const params: any[] = [];

      if (search && search.trim()) {
        query += ' WHERE archive_name LIKE ? OR destination LIKE ?';
        const wildcard = `%${search.trim()}%`;
        params.push(wildcard, wildcard);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      stmt.bind(params);

      const results: HistoryItem[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
          id: row.id as string,
          archiveName: row.archive_name as string,
          archivePath: row.archive_path as string,
          format: row.format as any,
          originalSize: row.original_size as number,
          extractedSize: row.extracted_size as number,
          destination: row.destination as string,
          timestamp: row.timestamp as number,
          durationMs: row.duration_ms as number,
          status: row.status as any,
          storageSavedBytes: row.storage_saved_bytes as number,
          deletedOriginal: Boolean(row.deleted_original),
          errorMessage: (row.error_message as string) || undefined,
        });
      }
      stmt.free();

      return results;
    } catch (err) {
      logger.error('Failed to query extraction history:', err);
      return [];
    }
  }

  public async getStorageStats(): Promise<StorageStats> {
    await this.initialize();
    if (!this.db) {
      return {
        totalArchivesExtracted: 0,
        totalStorageSavedBytes: 0,
        totalOriginalBytes: 0,
        totalExtractedBytes: 0,
      };
    }

    try {
      const res = this.db.exec(`
        SELECT
          COUNT(*) as total_count,
          TOTAL(CASE WHEN status = 'completed' AND deleted_original = 1 THEN storage_saved_bytes ELSE 0 END) as saved_bytes,
          TOTAL(original_size) as orig_bytes,
          TOTAL(extracted_size) as ext_bytes
        FROM extraction_history
        WHERE status = 'completed'
      `);

      if (res.length > 0 && res[0].values.length > 0) {
        const values = res[0].values[0];
        return {
          totalArchivesExtracted: (values[0] as number) || 0,
          totalStorageSavedBytes: (values[1] as number) || 0,
          totalOriginalBytes: (values[2] as number) || 0,
          totalExtractedBytes: (values[3] as number) || 0,
        };
      }
    } catch (err) {
      logger.error('Failed to compute storage statistics:', err);
    }

    return {
      totalArchivesExtracted: 0,
      totalStorageSavedBytes: 0,
      totalOriginalBytes: 0,
      totalExtractedBytes: 0,
    };
  }

  public async clearHistory(): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    try {
      this.db.run('DELETE FROM extraction_history');
      this.persist();
      logger.info('Extraction history cleared.');
    } catch (err) {
      logger.error('Failed to clear extraction history:', err);
    }
  }

  public async deleteHistoryItem(id: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    try {
      this.db.run('DELETE FROM extraction_history WHERE id = ?', [id]);
      this.persist();
      logger.info(`Deleted history entry: ${id}`);
    } catch (err) {
      logger.error(`Failed to delete history entry ${id}:`, err);
    }
  }

  private persist() {
    if (!this.db) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (err) {
      logger.warn('Failed to write SQLite database to disk:', err);
    }
  }
}

export const historyDb = new HistoryDatabase();
