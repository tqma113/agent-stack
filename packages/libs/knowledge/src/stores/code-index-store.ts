/**
 * @ai-stack/knowledge - Code Index Store
 *
 * Persistent store for code index status using SQLite.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { IndexStatus, IndexStatusSummary } from '../types.js';

/**
 * Extended index status with root directory
 */
export interface CodeIndexStatusRow {
  file_path: string;
  content_hash: string;
  indexed_at: number;
  chunk_count: number;
  status: string;
  error: string | null;
  root_dir: string;
  created_at: number;
  updated_at: number;
}

/**
 * Code index store instance interface
 */
export interface CodeIndexStoreInstance {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;

  /** Initialize the store (create tables) */
  initialize(): Promise<void>;

  /** Get index status for a file */
  get(filePath: string): IndexStatus | null;

  /** Set index status for a file */
  set(status: IndexStatus & { rootDir: string }): void;

  /** Delete index status for a file */
  delete(filePath: string): boolean;

  /** Get all statuses for a root directory */
  getByRootDir(rootDir: string): IndexStatus[];

  /** Get summary statistics */
  getSummary(rootDir?: string): IndexStatusSummary;

  /** Check if there are indexed files for a root directory */
  hasIndexedFiles(rootDir: string): boolean;

  /** Clear all statuses for a root directory */
  clearByRootDir(rootDir: string): number;

  /** Clear all statuses */
  clear(): Promise<void>;

  /** Close the store */
  close(): Promise<void>;
}

/**
 * Create a code index store
 */
export function createCodeIndexStore(): CodeIndexStoreInstance {
  let db: Database.Database | null = null;
  let initialized = false;

  function getDb(): Database.Database {
    if (!db) {
      throw new Error('Database not set for CodeIndexStore');
    }
    return db;
  }

  function rowToStatus(row: CodeIndexStatusRow): IndexStatus {
    return {
      filePath: row.file_path,
      contentHash: row.content_hash,
      indexedAt: row.indexed_at,
      chunkCount: row.chunk_count,
      status: row.status as 'indexed' | 'pending' | 'error',
      error: row.error || undefined,
    };
  }

  return {
    setDatabase(database: Database.Database): void {
      db = database;
    },

    async initialize(): Promise<void> {
      if (initialized) return;

      const database = getDb();

      database.exec(`
        CREATE TABLE IF NOT EXISTS code_index_status (
          file_path TEXT PRIMARY KEY,
          content_hash TEXT NOT NULL,
          indexed_at INTEGER NOT NULL,
          chunk_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL CHECK (status IN ('indexed', 'pending', 'error')),
          error TEXT,
          root_dir TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_code_index_status_root_dir ON code_index_status(root_dir);
        CREATE INDEX IF NOT EXISTS idx_code_index_status_status ON code_index_status(status);
      `);

      initialized = true;
    },

    get(filePath: string): IndexStatus | null {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM code_index_status WHERE file_path = ?');
      const row = stmt.get(filePath) as CodeIndexStatusRow | undefined;

      return row ? rowToStatus(row) : null;
    },

    set(status: IndexStatus & { rootDir: string }): void {
      const database = getDb();
      const now = Date.now();

      const stmt = database.prepare(`
        INSERT INTO code_index_status (
          file_path, content_hash, indexed_at, chunk_count, status, error, root_dir, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          content_hash = excluded.content_hash,
          indexed_at = excluded.indexed_at,
          chunk_count = excluded.chunk_count,
          status = excluded.status,
          error = excluded.error,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        status.filePath,
        status.contentHash,
        status.indexedAt,
        status.chunkCount,
        status.status,
        status.error || null,
        status.rootDir,
        now,
        now
      );
    },

    delete(filePath: string): boolean {
      const database = getDb();

      const stmt = database.prepare('DELETE FROM code_index_status WHERE file_path = ?');
      const result = stmt.run(filePath);

      return result.changes > 0;
    },

    getByRootDir(rootDir: string): IndexStatus[] {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM code_index_status WHERE root_dir = ?');
      const rows = stmt.all(rootDir) as CodeIndexStatusRow[];

      return rows.map(rowToStatus);
    },

    getSummary(rootDir?: string): IndexStatusSummary {
      const database = getDb();

      let query = `
        SELECT
          COUNT(*) as total_files,
          SUM(CASE WHEN status = 'indexed' THEN 1 ELSE 0 END) as indexed_files,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_files,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_files,
          SUM(chunk_count) as total_chunks,
          MAX(CASE WHEN status = 'indexed' THEN indexed_at ELSE NULL END) as last_indexed_at
        FROM code_index_status
      `;

      if (rootDir) {
        query += ' WHERE root_dir = ?';
      }

      const stmt = database.prepare(query);
      const row = (rootDir ? stmt.get(rootDir) : stmt.get()) as {
        total_files: number;
        indexed_files: number;
        pending_files: number;
        error_files: number;
        total_chunks: number;
        last_indexed_at: number | null;
      };

      return {
        totalFiles: row.total_files || 0,
        indexedFiles: row.indexed_files || 0,
        pendingFiles: row.pending_files || 0,
        errorFiles: row.error_files || 0,
        totalChunks: row.total_chunks || 0,
        lastIndexedAt: row.last_indexed_at || undefined,
      };
    },

    hasIndexedFiles(rootDir: string): boolean {
      const database = getDb();

      const stmt = database.prepare(`
        SELECT COUNT(*) as count FROM code_index_status
        WHERE root_dir = ? AND status = 'indexed'
      `);
      const row = stmt.get(rootDir) as { count: number };

      return row.count > 0;
    },

    clearByRootDir(rootDir: string): number {
      const database = getDb();

      const stmt = database.prepare('DELETE FROM code_index_status WHERE root_dir = ?');
      const result = stmt.run(rootDir);

      return result.changes;
    },

    async clear(): Promise<void> {
      const database = getDb();
      database.exec('DELETE FROM code_index_status');
    },

    async close(): Promise<void> {
      initialized = false;
      // Database is managed by the caller
    },
  };
}
