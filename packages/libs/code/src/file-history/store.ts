/**
 * @ai-stack/code - File History Store (SQLite)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { FileChange, FileChangeType } from './types.js';
import type { HistoryConfig } from '../types.js';
import { HistoryError } from '../errors.js';

/**
 * File History Store configuration
 */
export interface FileHistoryStoreConfig {
  /** SQLite database path */
  dbPath: string;
  /** Maximum changes to keep */
  maxChanges: number;
}

/**
 * File History Store instance
 */
export interface FileHistoryStoreInstance {
  /** Initialize the store (create tables) */
  initialize(): void;
  /** Close the database connection */
  close(): void;

  /** Record a file change */
  recordChange(change: Omit<FileChange, 'id' | 'timestamp' | 'undone'>): string;
  /** Get a change by ID */
  getChange(id: string): FileChange | null;
  /** Get the last undoable change */
  getLastUndoableChange(): FileChange | null;
  /** Get the last redoable change */
  getLastRedoableChange(): FileChange | null;
  /** Mark a change as undone */
  markUndone(id: string): void;
  /** Mark a change as not undone (redone) */
  markRedone(id: string): void;

  /** Get recent changes */
  getRecentChanges(limit?: number): FileChange[];
  /** Get changes for a file */
  getChangesForFile(filePath: string, limit?: number): FileChange[];

  /** Create a checkpoint */
  createCheckpoint(name: string): void;
  /** Get changes since checkpoint */
  getChangesSinceCheckpoint(name: string): FileChange[];
  /** Delete old changes beyond maxChanges */
  cleanup(): number;
}

/**
 * Create a file history store
 */
export function createFileHistoryStore(config: FileHistoryStoreConfig): FileHistoryStoreInstance {
  const { dbPath, maxChanges } = config;
  let db: Database.Database | null = null;

  function getDb(): Database.Database {
    if (!db) {
      throw new HistoryError('Database not initialized');
    }
    return db;
  }

  const instance: FileHistoryStoreInstance = {
    initialize(): void {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');

      // Create file_changes table
      db.exec(`
        CREATE TABLE IF NOT EXISTS file_changes (
          id TEXT PRIMARY KEY,
          file_path TEXT NOT NULL,
          change_type TEXT NOT NULL,
          before_content TEXT,
          after_content TEXT,
          timestamp INTEGER NOT NULL,
          checkpoint TEXT,
          undone INTEGER NOT NULL DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_file_changes_timestamp ON file_changes(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_file_changes_file_path ON file_changes(file_path);
        CREATE INDEX IF NOT EXISTS idx_file_changes_undone ON file_changes(undone);
        CREATE INDEX IF NOT EXISTS idx_file_changes_checkpoint ON file_changes(checkpoint);
      `);
    },

    close(): void {
      if (db) {
        db.close();
        db = null;
      }
    },

    recordChange(change): string {
      const id = randomUUID();
      const timestamp = Date.now();

      const stmt = getDb().prepare(`
        INSERT INTO file_changes (id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `);

      stmt.run(
        id,
        change.filePath,
        change.changeType,
        change.beforeContent,
        change.afterContent,
        timestamp,
        change.checkpoint || null
      );

      // Cleanup old changes
      instance.cleanup();

      return id;
    },

    getChange(id): FileChange | null {
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        WHERE id = ?
      `);

      const row = stmt.get(id) as any;
      if (!row) return null;

      return {
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      };
    },

    getLastUndoableChange(): FileChange | null {
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        WHERE undone = 0
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const row = stmt.get() as any;
      if (!row) return null;

      return {
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      };
    },

    getLastRedoableChange(): FileChange | null {
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        WHERE undone = 1
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const row = stmt.get() as any;
      if (!row) return null;

      return {
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      };
    },

    markUndone(id): void {
      const stmt = getDb().prepare(`
        UPDATE file_changes SET undone = 1 WHERE id = ?
      `);
      stmt.run(id);
    },

    markRedone(id): void {
      const stmt = getDb().prepare(`
        UPDATE file_changes SET undone = 0 WHERE id = ?
      `);
      stmt.run(id);
    },

    getRecentChanges(limit = 50): FileChange[] {
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(limit) as any[];
      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      }));
    },

    getChangesForFile(filePath, limit = 50): FileChange[] {
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        WHERE file_path = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(filePath, limit) as any[];
      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      }));
    },

    createCheckpoint(name): void {
      // Mark a timestamp as a checkpoint by adding a dummy entry
      const id = randomUUID();
      const timestamp = Date.now();

      const stmt = getDb().prepare(`
        INSERT INTO file_changes (id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone)
        VALUES (?, '__checkpoint__', 'create', NULL, NULL, ?, ?, 0)
      `);

      stmt.run(id, timestamp, name);
    },

    getChangesSinceCheckpoint(name): FileChange[] {
      // Get the checkpoint timestamp
      const checkpointStmt = getDb().prepare(`
        SELECT timestamp FROM file_changes
        WHERE checkpoint = ? AND file_path = '__checkpoint__'
        ORDER BY timestamp DESC
        LIMIT 1
      `);

      const checkpoint = checkpointStmt.get(name) as any;
      if (!checkpoint) {
        throw new HistoryError(`Checkpoint not found: ${name}`);
      }

      // Get all changes since checkpoint (excluding the checkpoint entry itself)
      const stmt = getDb().prepare(`
        SELECT id, file_path, change_type, before_content, after_content, timestamp, checkpoint, undone
        FROM file_changes
        WHERE timestamp > ? AND file_path != '__checkpoint__'
        ORDER BY timestamp ASC
      `);

      const rows = stmt.all(checkpoint.timestamp) as any[];
      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        changeType: row.change_type as FileChangeType,
        beforeContent: row.before_content,
        afterContent: row.after_content,
        timestamp: row.timestamp,
        checkpoint: row.checkpoint || undefined,
        undone: !!row.undone,
      }));
    },

    cleanup(): number {
      // Count total changes
      const countStmt = getDb().prepare(`
        SELECT COUNT(*) as count FROM file_changes WHERE file_path != '__checkpoint__'
      `);
      const { count } = countStmt.get() as any;

      if (count <= maxChanges) {
        return 0;
      }

      // Delete oldest changes beyond maxChanges
      const toDelete = count - maxChanges;
      const deleteStmt = getDb().prepare(`
        DELETE FROM file_changes
        WHERE id IN (
          SELECT id FROM file_changes
          WHERE file_path != '__checkpoint__'
          ORDER BY timestamp ASC
          LIMIT ?
        )
      `);

      const result = deleteStmt.run(toDelete);
      return result.changes;
    },
  };

  return instance;
}

export type FileHistoryStore = FileHistoryStoreInstance;
