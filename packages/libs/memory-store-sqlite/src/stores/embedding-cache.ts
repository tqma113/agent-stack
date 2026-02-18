/**
 * @ai-stack/memory-store-sqlite - Embedding Cache
 *
 * Caches embeddings to avoid redundant API calls.
 * Uses text hash as key for deduplication.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { createDbOperations, type DbOperationsInstance } from './db-operations.js';

/**
 * Embedding cache entry
 */
export interface EmbeddingCacheEntry {
  /** Hash of the text content */
  hash: string;
  /** Provider identifier (e.g., 'openai', 'local') */
  provider: string;
  /** Model identifier (e.g., 'text-embedding-3-small') */
  model: string;
  /** The embedding vector */
  embedding: number[];
  /** Vector dimensions */
  dimensions: number;
  /** Timestamp when cached */
  createdAt: number;
  /** Last access timestamp */
  accessedAt: number;
}

/**
 * Embedding cache configuration
 */
export interface EmbeddingCacheConfig {
  /** Maximum number of entries to cache (default: 50000) */
  maxEntries: number;
  /** Enable cache (default: true) */
  enabled: boolean;
  /** TTL in milliseconds (default: 7 days, 0 = no expiry) */
  ttlMs: number;
}

/**
 * Default cache configuration
 */
export const DEFAULT_EMBEDDING_CACHE_CONFIG: EmbeddingCacheConfig = {
  maxEntries: 50000,
  enabled: true,
  ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Embedding cache instance interface
 */
export interface EmbeddingCacheInstance {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Check if cache is initialized */
  isInitialized(): boolean;
  /** Initialize the cache table */
  initialize(): Promise<void>;
  /** Close the cache */
  close(): Promise<void>;
  /** Clear all cached entries */
  clear(): Promise<void>;

  /**
   * Get cached embedding for text
   * @param text - The text to look up
   * @param provider - Provider identifier
   * @param model - Model identifier
   * @returns The cached embedding or undefined if not found
   */
  get(text: string, provider: string, model: string): Promise<number[] | undefined>;

  /**
   * Cache an embedding
   * @param text - The original text
   * @param embedding - The embedding vector
   * @param provider - Provider identifier
   * @param model - Model identifier
   */
  set(text: string, embedding: number[], provider: string, model: string): Promise<void>;

  /**
   * Get multiple embeddings in batch
   * @param texts - Array of texts to look up
   * @param provider - Provider identifier
   * @param model - Model identifier
   * @returns Map of text -> embedding (only for cache hits)
   */
  getBatch(texts: string[], provider: string, model: string): Promise<Map<string, number[]>>;

  /**
   * Cache multiple embeddings in batch
   * @param entries - Array of [text, embedding] pairs
   * @param provider - Provider identifier
   * @param model - Model identifier
   */
  setBatch(
    entries: Array<[string, number[]]>,
    provider: string,
    model: string
  ): Promise<void>;

  /**
   * Check if embedding exists in cache
   * @param text - The text to check
   * @param provider - Provider identifier
   * @param model - Model identifier
   */
  has(text: string, provider: string, model: string): Promise<boolean>;

  /**
   * Delete cached embedding
   * @param text - The text whose embedding to delete
   * @param provider - Provider identifier
   * @param model - Model identifier
   */
  delete(text: string, provider: string, model: string): Promise<boolean>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    totalEntries: number;
    providers: Array<{ provider: string; model: string; count: number }>;
    oldestEntry: number | null;
    newestEntry: number | null;
  }>;

  /**
   * Prune expired and excess entries
   * @returns Number of entries removed
   */
  prune(): Promise<number>;

  /**
   * Get the current configuration
   */
  getConfig(): EmbeddingCacheConfig;
}

/**
 * Compute SHA-256 hash of text
 */
function hashText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Create an embedding cache instance
 */
export function createEmbeddingCache(
  config: Partial<EmbeddingCacheConfig> = {}
): EmbeddingCacheInstance {
  const dbOps: DbOperationsInstance = createDbOperations('EmbeddingCache');
  const cacheConfig: EmbeddingCacheConfig = { ...DEFAULT_EMBEDDING_CACHE_CONFIG, ...config };

  async function initialize(): Promise<void> {
    const db = dbOps.getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS embedding_cache (
        hash TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        embedding TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        accessed_at INTEGER NOT NULL,
        PRIMARY KEY (hash, provider, model)
      );

      CREATE INDEX IF NOT EXISTS idx_embedding_cache_accessed
        ON embedding_cache(accessed_at);
      CREATE INDEX IF NOT EXISTS idx_embedding_cache_provider_model
        ON embedding_cache(provider, model);
    `);

    dbOps.setInitialized(true);
  }

  async function close(): Promise<void> {
    return dbOps.close();
  }

  async function clear(): Promise<void> {
    const db = dbOps.getDb();
    db.exec('DELETE FROM embedding_cache');
  }

  async function get(
    text: string,
    provider: string,
    model: string
  ): Promise<number[] | undefined> {
    if (!cacheConfig.enabled) return undefined;

    const db = dbOps.getDb();
    const hash = hashText(text);
    const now = Date.now();

    const row = db
      .prepare(
        `SELECT embedding, created_at FROM embedding_cache
         WHERE hash = ? AND provider = ? AND model = ?`
      )
      .get(hash, provider, model) as { embedding: string; created_at: number } | undefined;

    if (!row) return undefined;

    // Check TTL
    if (cacheConfig.ttlMs > 0 && now - row.created_at > cacheConfig.ttlMs) {
      // Expired, delete it
      db.prepare(
        'DELETE FROM embedding_cache WHERE hash = ? AND provider = ? AND model = ?'
      ).run(hash, provider, model);
      return undefined;
    }

    // Update access time
    db.prepare(
      `UPDATE embedding_cache SET accessed_at = ?
       WHERE hash = ? AND provider = ? AND model = ?`
    ).run(now, hash, provider, model);

    return JSON.parse(row.embedding);
  }

  async function set(
    text: string,
    embedding: number[],
    provider: string,
    model: string
  ): Promise<void> {
    if (!cacheConfig.enabled) return;

    const db = dbOps.getDb();
    const hash = hashText(text);
    const now = Date.now();

    db.prepare(
      `INSERT OR REPLACE INTO embedding_cache
       (hash, provider, model, embedding, dimensions, created_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(hash, provider, model, JSON.stringify(embedding), embedding.length, now, now);

    // Check if we need to prune
    const count = (
      db.prepare('SELECT COUNT(*) as count FROM embedding_cache').get() as { count: number }
    ).count;

    if (count > cacheConfig.maxEntries * 1.1) {
      // Prune when 10% over limit
      await prune();
    }
  }

  async function getBatch(
    texts: string[],
    provider: string,
    model: string
  ): Promise<Map<string, number[]>> {
    if (!cacheConfig.enabled || texts.length === 0) {
      return new Map();
    }

    const db = dbOps.getDb();
    const now = Date.now();
    const result = new Map<string, number[]>();
    const hashToText = new Map<string, string>();

    // Build hash -> text mapping
    const hashes: string[] = [];
    for (const text of texts) {
      const hash = hashText(text);
      hashes.push(hash);
      hashToText.set(hash, text);
    }

    // Query in batch
    const placeholders = hashes.map(() => '?').join(', ');
    const rows = db
      .prepare(
        `SELECT hash, embedding, created_at FROM embedding_cache
         WHERE hash IN (${placeholders}) AND provider = ? AND model = ?`
      )
      .all(...hashes, provider, model) as Array<{
      hash: string;
      embedding: string;
      created_at: number;
    }>;

    const expiredHashes: string[] = [];
    const validHashes: string[] = [];

    for (const row of rows) {
      const text = hashToText.get(row.hash);
      if (!text) continue;

      // Check TTL
      if (cacheConfig.ttlMs > 0 && now - row.created_at > cacheConfig.ttlMs) {
        expiredHashes.push(row.hash);
        continue;
      }

      result.set(text, JSON.parse(row.embedding));
      validHashes.push(row.hash);
    }

    // Delete expired entries
    if (expiredHashes.length > 0) {
      const expPlaceholders = expiredHashes.map(() => '?').join(', ');
      db.prepare(
        `DELETE FROM embedding_cache
         WHERE hash IN (${expPlaceholders}) AND provider = ? AND model = ?`
      ).run(...expiredHashes, provider, model);
    }

    // Update access times for valid entries
    if (validHashes.length > 0) {
      const validPlaceholders = validHashes.map(() => '?').join(', ');
      db.prepare(
        `UPDATE embedding_cache SET accessed_at = ?
         WHERE hash IN (${validPlaceholders}) AND provider = ? AND model = ?`
      ).run(now, ...validHashes, provider, model);
    }

    return result;
  }

  async function setBatch(
    entries: Array<[string, number[]]>,
    provider: string,
    model: string
  ): Promise<void> {
    if (!cacheConfig.enabled || entries.length === 0) return;

    const db = dbOps.getDb();
    const now = Date.now();

    const stmt = db.prepare(
      `INSERT OR REPLACE INTO embedding_cache
       (hash, provider, model, embedding, dimensions, created_at, accessed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = db.transaction((items: Array<[string, number[]]>) => {
      for (const [text, embedding] of items) {
        const hash = hashText(text);
        stmt.run(hash, provider, model, JSON.stringify(embedding), embedding.length, now, now);
      }
    });

    insertMany(entries);

    // Check if we need to prune
    const count = (
      db.prepare('SELECT COUNT(*) as count FROM embedding_cache').get() as { count: number }
    ).count;

    if (count > cacheConfig.maxEntries * 1.1) {
      await prune();
    }
  }

  async function has(text: string, provider: string, model: string): Promise<boolean> {
    if (!cacheConfig.enabled) return false;

    const db = dbOps.getDb();
    const hash = hashText(text);

    const row = db
      .prepare(
        `SELECT created_at FROM embedding_cache
         WHERE hash = ? AND provider = ? AND model = ?`
      )
      .get(hash, provider, model) as { created_at: number } | undefined;

    if (!row) return false;

    // Check TTL
    if (cacheConfig.ttlMs > 0 && Date.now() - row.created_at > cacheConfig.ttlMs) {
      return false;
    }

    return true;
  }

  async function deleteEntry(
    text: string,
    provider: string,
    model: string
  ): Promise<boolean> {
    const db = dbOps.getDb();
    const hash = hashText(text);

    const result = db
      .prepare('DELETE FROM embedding_cache WHERE hash = ? AND provider = ? AND model = ?')
      .run(hash, provider, model);

    return result.changes > 0;
  }

  async function getStats(): Promise<{
    totalEntries: number;
    providers: Array<{ provider: string; model: string; count: number }>;
    oldestEntry: number | null;
    newestEntry: number | null;
  }> {
    const db = dbOps.getDb();

    const totalResult = db
      .prepare('SELECT COUNT(*) as count FROM embedding_cache')
      .get() as { count: number };

    const providersResult = db
      .prepare(
        `SELECT provider, model, COUNT(*) as count
         FROM embedding_cache
         GROUP BY provider, model
         ORDER BY count DESC`
      )
      .all() as Array<{ provider: string; model: string; count: number }>;

    const oldestResult = db
      .prepare('SELECT MIN(created_at) as oldest FROM embedding_cache')
      .get() as { oldest: number | null };

    const newestResult = db
      .prepare('SELECT MAX(created_at) as newest FROM embedding_cache')
      .get() as { newest: number | null };

    return {
      totalEntries: totalResult.count,
      providers: providersResult,
      oldestEntry: oldestResult.oldest,
      newestEntry: newestResult.newest,
    };
  }

  async function prune(): Promise<number> {
    const db = dbOps.getDb();
    let totalRemoved = 0;

    // 1. Remove expired entries
    if (cacheConfig.ttlMs > 0) {
      const expireThreshold = Date.now() - cacheConfig.ttlMs;
      const expiredResult = db
        .prepare('DELETE FROM embedding_cache WHERE created_at < ?')
        .run(expireThreshold);
      totalRemoved += expiredResult.changes;
    }

    // 2. Remove excess entries (LRU eviction)
    const count = (
      db.prepare('SELECT COUNT(*) as count FROM embedding_cache').get() as { count: number }
    ).count;

    if (count > cacheConfig.maxEntries) {
      const toRemove = count - cacheConfig.maxEntries;
      // Delete oldest accessed entries
      const lruResult = db
        .prepare(
          `DELETE FROM embedding_cache
           WHERE rowid IN (
             SELECT rowid FROM embedding_cache
             ORDER BY accessed_at ASC
             LIMIT ?
           )`
        )
        .run(toRemove);
      totalRemoved += lruResult.changes;
    }

    return totalRemoved;
  }

  return {
    setDatabase: (db: Database.Database) => dbOps.setDatabase(db),
    isInitialized: () => dbOps.isInitialized(),
    initialize,
    close,
    clear,
    get,
    set,
    getBatch,
    setBatch,
    has,
    delete: deleteEntry,
    getStats,
    prune,
    getConfig: () => ({ ...cacheConfig }),
  };
}
