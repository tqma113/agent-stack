/**
 * @ai-stack/knowledge - Doc Registry Store
 *
 * Persistent store for document sources and pages using SQLite.
 */

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { DocSource, DocSourceInput, DocPage, UUID, CrawlOptions, DocSection } from '../types.js';

/**
 * Database row types
 */
interface DocSourceRow {
  id: string;
  name: string;
  type: string;
  url: string;
  tags: string;
  crawl_options: string | null;
  enabled: number;
  last_crawled_at: number | null;
  refresh_interval: number | null;
  created_at: number;
}

interface DocPageRow {
  id: string;
  source_id: string;
  url: string;
  title: string;
  content: string;
  sections: string | null;
  fetched_at: number;
  content_hash: string;
  metadata: string | null;
}

/**
 * Doc registry summary
 */
export interface DocRegistrySummary {
  totalSources: number;
  enabledSources: number;
  totalPages: number;
  totalChunks: number;
  lastCrawledAt?: number;
}

/**
 * Doc registry store instance interface
 */
export interface DocRegistryStoreInstance {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;

  /** Initialize the store (create tables) */
  initialize(): Promise<void>;

  // Source operations
  /** Add a source */
  addSource(input: DocSourceInput): DocSource;

  /** Get a source */
  getSource(id: UUID): DocSource | undefined;

  /** Get source by URL */
  getSourceByUrl(url: string): DocSource | undefined;

  /** Update a source */
  updateSource(id: UUID, update: Partial<DocSource>): DocSource | undefined;

  /** Remove a source */
  removeSource(id: UUID): boolean;

  /** List all sources */
  listSources(): DocSource[];

  /** Get enabled sources */
  getEnabledSources(): DocSource[];

  // Page operations
  /** Add a page */
  addPage(page: DocPage): void;

  /** Get a page */
  getPage(id: UUID): DocPage | undefined;

  /** Get page by URL */
  getPageByUrl(url: string): DocPage | undefined;

  /** Get pages by source */
  getPagesBySource(sourceId: UUID): DocPage[];

  /** Update a page */
  updatePage(id: UUID, update: Partial<DocPage>): DocPage | undefined;

  /** Remove a page */
  removePage(id: UUID): boolean;

  /** Remove pages by source */
  removePagesBySource(sourceId: UUID): number;

  /** List all pages */
  listPages(): DocPage[];

  // Utility
  /** Get summary statistics */
  getSummary(): DocRegistrySummary;

  /** Check if there are indexed sources */
  hasIndexedSources(): boolean;

  /** Clear all data */
  clear(): Promise<void>;

  /** Close the store */
  close(): Promise<void>;
}

/**
 * Create a doc registry store
 */
export function createDocRegistryStore(): DocRegistryStoreInstance {
  let db: Database.Database | null = null;
  let initialized = false;

  function getDb(): Database.Database {
    if (!db) {
      throw new Error('Database not set for DocRegistryStore');
    }
    return db;
  }

  function rowToSource(row: DocSourceRow): DocSource {
    return {
      id: row.id,
      name: row.name,
      type: row.type as DocSource['type'],
      url: row.url,
      tags: JSON.parse(row.tags) as string[],
      crawlOptions: row.crawl_options ? JSON.parse(row.crawl_options) as CrawlOptions : undefined,
      enabled: row.enabled === 1,
      lastCrawledAt: row.last_crawled_at || undefined,
      refreshInterval: row.refresh_interval || undefined,
      createdAt: row.created_at,
    };
  }

  function rowToPage(row: DocPageRow): DocPage {
    return {
      id: row.id,
      sourceId: row.source_id,
      url: row.url,
      title: row.title,
      content: row.content,
      sections: row.sections ? JSON.parse(row.sections) as DocSection[] : undefined,
      fetchedAt: row.fetched_at,
      contentHash: row.content_hash,
      metadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : undefined,
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
        CREATE TABLE IF NOT EXISTS doc_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE,
          tags TEXT NOT NULL DEFAULT '[]',
          crawl_options TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          last_crawled_at INTEGER,
          refresh_interval INTEGER,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS doc_pages (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          sections TEXT,
          fetched_at INTEGER NOT NULL,
          content_hash TEXT NOT NULL,
          metadata TEXT,
          FOREIGN KEY (source_id) REFERENCES doc_sources(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_doc_pages_source_id ON doc_pages(source_id);
        CREATE INDEX IF NOT EXISTS idx_doc_pages_url ON doc_pages(url);
      `);

      initialized = true;
    },

    // Source operations
    addSource(input: DocSourceInput): DocSource {
      const database = getDb();
      const now = Date.now();

      const source: DocSource = {
        ...input,
        id: randomUUID(),
        createdAt: now,
      };

      const stmt = database.prepare(`
        INSERT INTO doc_sources (
          id, name, type, url, tags, crawl_options, enabled, last_crawled_at, refresh_interval, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        source.id,
        source.name,
        source.type,
        source.url,
        JSON.stringify(source.tags || []),
        source.crawlOptions ? JSON.stringify(source.crawlOptions) : null,
        source.enabled ? 1 : 0,
        source.lastCrawledAt || null,
        source.refreshInterval || null,
        source.createdAt
      );

      return source;
    },

    getSource(id: UUID): DocSource | undefined {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_sources WHERE id = ?');
      const row = stmt.get(id) as DocSourceRow | undefined;

      return row ? rowToSource(row) : undefined;
    },

    getSourceByUrl(url: string): DocSource | undefined {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_sources WHERE url = ?');
      const row = stmt.get(url) as DocSourceRow | undefined;

      return row ? rowToSource(row) : undefined;
    },

    updateSource(id: UUID, update: Partial<DocSource>): DocSource | undefined {
      const database = getDb();

      const existing = this.getSource(id);
      if (!existing) return undefined;

      const updated: DocSource = { ...existing, ...update };

      const stmt = database.prepare(`
        UPDATE doc_sources SET
          name = ?,
          type = ?,
          url = ?,
          tags = ?,
          crawl_options = ?,
          enabled = ?,
          last_crawled_at = ?,
          refresh_interval = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.name,
        updated.type,
        updated.url,
        JSON.stringify(updated.tags || []),
        updated.crawlOptions ? JSON.stringify(updated.crawlOptions) : null,
        updated.enabled ? 1 : 0,
        updated.lastCrawledAt || null,
        updated.refreshInterval || null,
        id
      );

      return updated;
    },

    removeSource(id: UUID): boolean {
      const database = getDb();

      // Pages will be cascade deleted due to foreign key
      const stmt = database.prepare('DELETE FROM doc_sources WHERE id = ?');
      const result = stmt.run(id);

      return result.changes > 0;
    },

    listSources(): DocSource[] {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_sources ORDER BY created_at DESC');
      const rows = stmt.all() as DocSourceRow[];

      return rows.map(rowToSource);
    },

    getEnabledSources(): DocSource[] {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_sources WHERE enabled = 1 ORDER BY created_at DESC');
      const rows = stmt.all() as DocSourceRow[];

      return rows.map(rowToSource);
    },

    // Page operations
    addPage(page: DocPage): void {
      const database = getDb();

      const stmt = database.prepare(`
        INSERT INTO doc_pages (
          id, source_id, url, title, content, sections, fetched_at, content_hash, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          sections = excluded.sections,
          fetched_at = excluded.fetched_at,
          content_hash = excluded.content_hash,
          metadata = excluded.metadata
      `);

      stmt.run(
        page.id,
        page.sourceId,
        page.url,
        page.title,
        page.content,
        page.sections ? JSON.stringify(page.sections) : null,
        page.fetchedAt,
        page.contentHash,
        page.metadata ? JSON.stringify(page.metadata) : null
      );
    },

    getPage(id: UUID): DocPage | undefined {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_pages WHERE id = ?');
      const row = stmt.get(id) as DocPageRow | undefined;

      return row ? rowToPage(row) : undefined;
    },

    getPageByUrl(url: string): DocPage | undefined {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_pages WHERE url = ?');
      const row = stmt.get(url) as DocPageRow | undefined;

      return row ? rowToPage(row) : undefined;
    },

    getPagesBySource(sourceId: UUID): DocPage[] {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_pages WHERE source_id = ?');
      const rows = stmt.all(sourceId) as DocPageRow[];

      return rows.map(rowToPage);
    },

    updatePage(id: UUID, update: Partial<DocPage>): DocPage | undefined {
      const database = getDb();

      const existing = this.getPage(id);
      if (!existing) return undefined;

      const updated: DocPage = { ...existing, ...update };

      const stmt = database.prepare(`
        UPDATE doc_pages SET
          source_id = ?,
          url = ?,
          title = ?,
          content = ?,
          sections = ?,
          fetched_at = ?,
          content_hash = ?,
          metadata = ?
        WHERE id = ?
      `);

      stmt.run(
        updated.sourceId,
        updated.url,
        updated.title,
        updated.content,
        updated.sections ? JSON.stringify(updated.sections) : null,
        updated.fetchedAt,
        updated.contentHash,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        id
      );

      return updated;
    },

    removePage(id: UUID): boolean {
      const database = getDb();

      const stmt = database.prepare('DELETE FROM doc_pages WHERE id = ?');
      const result = stmt.run(id);

      return result.changes > 0;
    },

    removePagesBySource(sourceId: UUID): number {
      const database = getDb();

      const stmt = database.prepare('DELETE FROM doc_pages WHERE source_id = ?');
      const result = stmt.run(sourceId);

      return result.changes;
    },

    listPages(): DocPage[] {
      const database = getDb();

      const stmt = database.prepare('SELECT * FROM doc_pages ORDER BY fetched_at DESC');
      const rows = stmt.all() as DocPageRow[];

      return rows.map(rowToPage);
    },

    // Utility
    getSummary(): DocRegistrySummary {
      const database = getDb();

      const sourcesStmt = database.prepare(`
        SELECT
          COUNT(*) as total_sources,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as enabled_sources,
          MAX(last_crawled_at) as last_crawled_at
        FROM doc_sources
      `);
      const sourcesRow = sourcesStmt.get() as {
        total_sources: number;
        enabled_sources: number;
        last_crawled_at: number | null;
      };

      const pagesStmt = database.prepare('SELECT COUNT(*) as total_pages FROM doc_pages');
      const pagesRow = pagesStmt.get() as { total_pages: number };

      return {
        totalSources: sourcesRow.total_sources || 0,
        enabledSources: sourcesRow.enabled_sources || 0,
        totalPages: pagesRow.total_pages || 0,
        totalChunks: 0, // Chunks are stored in SemanticStore, not here
        lastCrawledAt: sourcesRow.last_crawled_at || undefined,
      };
    },

    hasIndexedSources(): boolean {
      const database = getDb();

      const stmt = database.prepare('SELECT COUNT(*) as count FROM doc_sources');
      const row = stmt.get() as { count: number };

      return row.count > 0;
    },

    async clear(): Promise<void> {
      const database = getDb();
      database.exec('DELETE FROM doc_pages');
      database.exec('DELETE FROM doc_sources');
    },

    async close(): Promise<void> {
      initialized = false;
      // Database is managed by the caller
    },
  };
}
