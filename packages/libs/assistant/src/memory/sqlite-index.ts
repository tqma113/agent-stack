/**
 * @ai-stack/assistant - SQLite Index
 *
 * Derived index from Markdown files for fast search.
 * Uses FTS5 for full-text search with incremental indexing support.
 */

import type { FactItem, TodoItem, DailyLogEntry, MemorySearchResult, MemoryQueryOptions } from './types.js';
import type { FileMetadata } from './hash-utils.js';

/**
 * Memory index entry types
 */
type EntryType = 'fact' | 'todo' | 'log' | 'note';

/**
 * Raw index entry
 */
interface IndexEntry {
  id: string;
  type: EntryType;
  content: string;
  source: string;
  timestamp: number;
  metadata?: string; // JSON
}

/**
 * Stored file metadata record
 */
export interface StoredFileMetadata {
  path: string;
  hash: string;
  size: number;
  mtime: number;
  indexedAt: number;
}

/**
 * SQLite Index Instance
 */
export interface SqliteIndexInstance {
  /** Initialize the index */
  initialize(): Promise<void>;
  /** Close the index */
  close(): Promise<void>;
  /** Clear all data */
  clear(): Promise<void>;

  /** Index a fact */
  indexFact(fact: FactItem, source: string): Promise<void>;
  /** Index a todo */
  indexTodo(todo: TodoItem, source: string): Promise<void>;
  /** Index a log entry */
  indexLogEntry(entry: DailyLogEntry, date: string, source: string): Promise<void>;
  /** Index a note */
  indexNote(content: string, source: string): Promise<void>;

  /** Search the index */
  search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]>;
  /** Get entry count */
  getCount(): Promise<number>;
  /** Get all entries by type */
  getByType(type: EntryType): Promise<MemorySearchResult[]>;

  // Incremental indexing support
  /** Get stored file metadata */
  getFileMetadata(path: string): Promise<StoredFileMetadata | null>;
  /** Update file metadata after indexing */
  updateFileMetadata(metadata: FileMetadata): Promise<void>;
  /** Delete file metadata and associated entries */
  deleteFileEntries(source: string): Promise<void>;
  /** Get all tracked file paths */
  getTrackedFiles(): Promise<string[]>;
  /** Check if file needs reindexing based on hash */
  needsReindex(path: string, currentHash: string): Promise<boolean>;
}

/**
 * Create a SQLite index instance
 */
export function createSqliteIndex(dbPath: string): SqliteIndexInstance {
  let db: ReturnType<typeof import('better-sqlite3')> | null = null;

  return {
    async initialize(): Promise<void> {
      // Dynamic import for better-sqlite3
      const Database = (await import('better-sqlite3')).default;
      db = new Database(dbPath);

      // Enable WAL mode for better concurrent access
      db.pragma('journal_mode = WAL');

      // Create tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_index (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          metadata TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
          content,
          id UNINDEXED,
          type UNINDEXED,
          content='memory_index',
          content_rowid='rowid'
        );

        CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_index BEGIN
          INSERT INTO memory_fts(rowid, content, id, type)
          VALUES (new.rowid, new.content, new.id, new.type);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_index BEGIN
          INSERT INTO memory_fts(memory_fts, rowid, content, id, type)
          VALUES ('delete', old.rowid, old.content, old.id, old.type);
        END;

        CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_index BEGIN
          INSERT INTO memory_fts(memory_fts, rowid, content, id, type)
          VALUES ('delete', old.rowid, old.content, old.id, old.type);
          INSERT INTO memory_fts(rowid, content, id, type)
          VALUES (new.rowid, new.content, new.id, new.type);
        END;

        CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_index(type);
        CREATE INDEX IF NOT EXISTS idx_memory_timestamp ON memory_index(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_memory_source ON memory_index(source);

        -- File metadata table for incremental indexing
        CREATE TABLE IF NOT EXISTS file_metadata (
          path TEXT PRIMARY KEY,
          hash TEXT NOT NULL,
          size INTEGER NOT NULL,
          mtime INTEGER NOT NULL,
          indexed_at INTEGER NOT NULL
        );
      `);
    },

    async close(): Promise<void> {
      if (db) {
        db.close();
        db = null;
      }
    },

    async clear(): Promise<void> {
      if (!db) throw new Error('Index not initialized');
      db.exec('DELETE FROM memory_index');
    },

    async indexFact(fact: FactItem, source: string): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO memory_index (id, type, content, source, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        fact.id,
        'fact',
        fact.content,
        source,
        fact.createdAt?.getTime() || Date.now(),
        JSON.stringify({ confidence: fact.confidence, source: fact.source })
      );
    },

    async indexTodo(todo: TodoItem, source: string): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO memory_index (id, type, content, source, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        todo.id,
        'todo',
        todo.content,
        source,
        todo.createdAt?.getTime() || Date.now(),
        JSON.stringify({ completed: todo.completed, priority: todo.priority, dueDate: todo.dueDate })
      );
    },

    async indexLogEntry(entry: DailyLogEntry, date: string, source: string): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      const id = `log-${date}-${entry.timestamp.getTime()}`;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO memory_index (id, type, content, source, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        'log',
        entry.content,
        source,
        entry.timestamp.getTime(),
        JSON.stringify({ type: entry.type, date, ...entry.metadata })
      );
    },

    async indexNote(content: string, source: string): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      const id = `note-${Date.now()}`;

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO memory_index (id, type, content, source, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, 'note', content, source, Date.now(), null);
    },

    async search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]> {
      if (!db) throw new Error('Index not initialized');

      const limit = options?.limit || 20;
      const types = options?.types;
      const minScore = options?.minScore || 0;

      // Build type filter
      let typeFilter = '';
      if (types && types.length > 0) {
        const typePlaceholders = types.map(() => '?').join(', ');
        typeFilter = `AND type IN (${typePlaceholders})`;
      }

      // Build date filter
      let dateFilter = '';
      const dateParams: number[] = [];
      if (options?.dateRange?.from) {
        dateFilter += ' AND timestamp >= ?';
        dateParams.push(options.dateRange.from.getTime());
      }
      if (options?.dateRange?.to) {
        dateFilter += ' AND timestamp <= ?';
        dateParams.push(options.dateRange.to.getTime());
      }

      // FTS5 search with BM25 ranking
      const sql = `
        SELECT
          m.id,
          m.type,
          m.content,
          m.source,
          m.timestamp,
          m.metadata,
          bm25(memory_fts) as score
        FROM memory_fts f
        JOIN memory_index m ON f.rowid = m.rowid
        WHERE memory_fts MATCH ?
        ${typeFilter}
        ${dateFilter}
        ORDER BY score
        LIMIT ?
      `;

      const params: (string | number)[] = [query];
      if (types) params.push(...types);
      params.push(...dateParams);
      params.push(limit);

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as Array<IndexEntry & { score: number }>;

      return rows
        .filter((row) => Math.abs(row.score) >= minScore) // BM25 returns negative scores
        .map((row) => ({
          type: row.type as 'fact' | 'todo' | 'log' | 'note',
          content: row.content,
          score: Math.abs(row.score),
          source: row.source,
          timestamp: new Date(row.timestamp),
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));
    },

    async getCount(): Promise<number> {
      if (!db) throw new Error('Index not initialized');
      const row = db.prepare('SELECT COUNT(*) as count FROM memory_index').get() as { count: number };
      return row.count;
    },

    async getByType(type: EntryType): Promise<MemorySearchResult[]> {
      if (!db) throw new Error('Index not initialized');

      const rows = db.prepare(`
        SELECT id, type, content, source, timestamp, metadata
        FROM memory_index
        WHERE type = ?
        ORDER BY timestamp DESC
      `).all(type) as IndexEntry[];

      return rows.map((row) => ({
        type: row.type as 'fact' | 'todo' | 'log' | 'note',
        content: row.content,
        score: 1,
        source: row.source,
        timestamp: new Date(row.timestamp),
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    },

    // Incremental indexing methods

    async getFileMetadata(path: string): Promise<StoredFileMetadata | null> {
      if (!db) throw new Error('Index not initialized');

      const row = db.prepare(`
        SELECT path, hash, size, mtime, indexed_at
        FROM file_metadata
        WHERE path = ?
      `).get(path) as { path: string; hash: string; size: number; mtime: number; indexed_at: number } | undefined;

      if (!row) return null;

      return {
        path: row.path,
        hash: row.hash,
        size: row.size,
        mtime: row.mtime,
        indexedAt: row.indexed_at,
      };
    },

    async updateFileMetadata(metadata: FileMetadata): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO file_metadata (path, hash, size, mtime, indexed_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(metadata.path, metadata.hash, metadata.size, metadata.mtime, Date.now());
    },

    async deleteFileEntries(source: string): Promise<void> {
      if (!db) throw new Error('Index not initialized');

      // Delete entries from memory_index (triggers will update FTS)
      db.prepare('DELETE FROM memory_index WHERE source = ?').run(source);

      // Delete file metadata
      db.prepare('DELETE FROM file_metadata WHERE path = ?').run(source);
    },

    async getTrackedFiles(): Promise<string[]> {
      if (!db) throw new Error('Index not initialized');

      const rows = db.prepare('SELECT path FROM file_metadata').all() as { path: string }[];
      return rows.map((row) => row.path);
    },

    async needsReindex(path: string, currentHash: string): Promise<boolean> {
      if (!db) throw new Error('Index not initialized');

      const stored = await this.getFileMetadata(path);

      // File not tracked yet - needs indexing
      if (!stored) return true;

      // Hash changed - needs reindexing
      return stored.hash !== currentHash;
    },
  };
}
