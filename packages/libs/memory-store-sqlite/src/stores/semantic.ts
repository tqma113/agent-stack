/**
 * @ai-stack/memory-store-sqlite - Semantic Store
 *
 * Stores searchable content chunks with FTS5 and sqlite-vec vector support.
 */

import type Database from 'better-sqlite3';
import type {
  ISemanticStore,
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  UUID,
} from '../types.js';
import { createDbOperations, type DbOperationsInstance } from './db-operations.js';
import { SemanticSearchError, DatabaseError } from '../errors.js';
import {
  createEmbeddingCache,
  type EmbeddingCacheInstance,
  type EmbeddingCacheConfig,
} from './embedding-cache.js';

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  tags?: string[];
  sessionId?: string;
  limit?: number;
}

/**
 * Hybrid search options
 */
export interface HybridSearchOptions extends VectorSearchOptions {
  /** Use vector search (default: true if embedding provided or embedFunction set) */
  useVector?: boolean;
  /** Query embedding (optional, will use embedFunction if not provided) */
  embedding?: number[];
  /** Weights for FTS and vector results (default: { fts: 0.3, vector: 0.7 }) */
  weights?: { fts: number; vector: number };
}

/**
 * Embedding function type
 */
export type EmbedFunction = (text: string) => Promise<number[]>;

/**
 * Semantic store configuration
 */
export interface SemanticStoreConfig {
  /** Vector dimensions (default: 1536 for OpenAI text-embedding-3-small) */
  vectorDimensions: number;

  /** Enable vector search (requires embeddings) */
  enableVectorSearch: boolean;

  /** Enable FTS search */
  enableFtsSearch: boolean;

  /** Embedding cache configuration */
  embeddingCache?: Partial<EmbeddingCacheConfig> & { enabled?: boolean };

  /** Embedding provider name (for cache key) */
  embeddingProvider?: string;

  /** Embedding model name (for cache key) */
  embeddingModel?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_SEMANTIC_CONFIG: SemanticStoreConfig = {
  vectorDimensions: 1536,
  enableVectorSearch: true,
  enableFtsSearch: true,
  embeddingCache: { enabled: true },
  embeddingProvider: 'default',
  embeddingModel: 'default',
};

/**
 * Database row type
 */
interface ChunkRow {
  id: string;
  rowid: number;
  timestamp: number;
  text: string;
  tags: string;
  source_event_id: string | null;
  source_type: string | null;
  session_id: string | null;
  metadata: string | null;
}

/**
 * Semantic store instance interface
 */
export interface SemanticStoreInstance extends ISemanticStore {
  /** Set the database instance (called by MemoryManager) */
  setDatabase(db: Database.Database): void;
  /** Check if store is initialized */
  isInitialized(): boolean;
  /** Set the embedding function for automatic vector generation */
  setEmbedFunction(fn: EmbedFunction): void;
  /** Get the current embed function */
  getEmbedFunction(): EmbedFunction | undefined;
  /** Check if automatic embedding is available */
  hasEmbedFunction(): boolean;
  /** Check if vector search is enabled */
  isVectorEnabled(): boolean;
  /** Get vector dimensions */
  getVectorDimensions(): number;
  /** Add or update embedding for a chunk */
  setEmbedding(chunkId: UUID, embedding: number[]): Promise<void>;
  /** Convenience method for pure FTS search (no vector) */
  searchText(query: string, options?: VectorSearchOptions): Promise<SemanticSearchResult[]>;
  /** Convenience method for pure vector search */
  searchSimilar(
    queryOrEmbedding: string | number[],
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]>;
  /** Delete a chunk by ID */
  delete(id: UUID): Promise<boolean>;
  /** Get chunk count */
  count(sessionId?: string): Promise<number>;
  /** Get embedding cache instance (if enabled) */
  getEmbeddingCache(): EmbeddingCacheInstance | undefined;
  /** Get embedding cache statistics */
  getCacheStats(): Promise<{
    totalEntries: number;
    providers: Array<{ provider: string; model: string; count: number }>;
  } | null>;
  /** Set embedding provider/model for cache keys */
  setEmbeddingProviderInfo(provider: string, model: string): void;
}

/**
 * Create a semantic store instance (functional style)
 */
export function createSemanticStore(
  config: Partial<SemanticStoreConfig> = {}
): SemanticStoreInstance {
  // Private state via closure
  const dbOps: DbOperationsInstance = createDbOperations('SemanticStore');
  const storeConfig: SemanticStoreConfig = { ...DEFAULT_SEMANTIC_CONFIG, ...config };
  let vecEnabled = false;
  let embedFunction: EmbedFunction | undefined;

  // Embedding cache
  const cacheEnabled = storeConfig.embeddingCache?.enabled !== false;
  const embeddingCache: EmbeddingCacheInstance | undefined = cacheEnabled
    ? createEmbeddingCache(storeConfig.embeddingCache)
    : undefined;
  let embeddingProvider = storeConfig.embeddingProvider ?? 'default';
  let embeddingModel = storeConfig.embeddingModel ?? 'default';

  // ============================================================================
  // Private helper functions
  // ============================================================================

  /**
   * Convert database row to SemanticChunk
   */
  function rowToChunk(row: ChunkRow): SemanticChunk {
    return {
      id: row.id,
      timestamp: row.timestamp,
      text: row.text,
      tags: JSON.parse(row.tags),
      sourceEventId: row.source_event_id || undefined,
      sourceType: row.source_type || undefined,
      sessionId: row.session_id || undefined,
      embedding: undefined, // Loaded separately from vec table
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }

  /**
   * Build FTS5 query from user input
   */
  function buildFtsQuery(query: string): string {
    // Escape special characters and build phrase query
    const escaped = query.replace(/['"]/g, '');
    const terms = escaped.split(/\s+/).filter((t) => t.length > 0);

    if (terms.length === 0) return '""';
    if (terms.length === 1) return `"${terms[0]}"*`;

    // Create OR query for multiple terms
    return terms.map((t) => `"${t}"*`).join(' OR ');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Insert vector into vec0 table
   */
  function insertVector(chunkId: string, embedding: number[]): void {
    const db = dbOps.getDb();

    try {
      // Delete existing if any
      db.prepare('DELETE FROM semantic_chunks_vec WHERE chunk_id = ?').run(chunkId);

      // Insert new vector as JSON array
      const vecJson = JSON.stringify(embedding);
      db.prepare(`
        INSERT INTO semantic_chunks_vec (chunk_id, embedding)
        VALUES (?, ?)
      `).run(chunkId, vecJson);
    } catch (error) {
      console.warn('[SemanticStore] Failed to insert vector:', (error as Error).message);
    }
  }

  /**
   * Get vector from vec0 table
   */
  function getVector(chunkId: string): number[] | undefined {
    const db = dbOps.getDb();

    try {
      const row = db
        .prepare('SELECT embedding FROM semantic_chunks_vec WHERE chunk_id = ?')
        .get(chunkId) as { embedding: string } | undefined;

      if (row?.embedding) {
        return JSON.parse(row.embedding);
      }
    } catch {
      // Vector not found or error
    }

    return undefined;
  }

  /**
   * Fallback vector search using in-memory cosine similarity
   */
  async function searchVectorFallback(
    embedding: number[],
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    const db = dbOps.getDb();

    try {
      // Get all chunks and compute similarity in memory
      let sql = 'SELECT * FROM semantic_chunks';
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options?.sessionId) {
        conditions.push('session_id = ?');
        params.push(options.sessionId);
      }

      if (options?.tags && options.tags.length > 0) {
        const tagConditions = options.tags.map(() => 'tags LIKE ?');
        conditions.push(`(${tagConditions.join(' OR ')})`);
        params.push(...options.tags.map((tag) => `%"${tag}"%`));
      }

      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      const rows = db.prepare(sql).all(...params) as ChunkRow[];

      // Get embeddings from vec table and compute similarity
      const results: SemanticSearchResult[] = [];

      for (const row of rows) {
        const storedEmbedding = getVector(row.id);
        if (storedEmbedding) {
          const score = cosineSimilarity(embedding, storedEmbedding);
          results.push({
            chunk: rowToChunk(row),
            score,
            matchType: 'vector' as const,
          });
        }
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      return options?.limit ? results.slice(0, options.limit) : results;
    } catch (error) {
      throw new SemanticSearchError(
        `Vector search fallback failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Merge FTS and vector results with weighted scoring
   */
  function mergeResults(
    ftsResults: SemanticSearchResult[],
    vectorResults: SemanticSearchResult[],
    weights: { fts: number; vector: number }
  ): SemanticSearchResult[] {
    const scoreMap = new Map<string, { chunk: SemanticChunk; ftsScore: number; vecScore: number }>();

    // Normalize FTS scores (0-1)
    const maxFtsScore = Math.max(...ftsResults.map((r) => r.score), 1);
    for (const result of ftsResults) {
      scoreMap.set(result.chunk.id, {
        chunk: result.chunk,
        ftsScore: result.score / maxFtsScore,
        vecScore: 0,
      });
    }

    // Add vector scores
    const maxVecScore = Math.max(...vectorResults.map((r) => r.score), 1);
    for (const result of vectorResults) {
      const existing = scoreMap.get(result.chunk.id);
      if (existing) {
        existing.vecScore = result.score / maxVecScore;
      } else {
        scoreMap.set(result.chunk.id, {
          chunk: result.chunk,
          ftsScore: 0,
          vecScore: result.score / maxVecScore,
        });
      }
    }

    // Calculate combined scores
    const combined: SemanticSearchResult[] = [];
    for (const [, value] of scoreMap) {
      const combinedScore = value.ftsScore * weights.fts + value.vecScore * weights.vector;
      combined.push({
        chunk: value.chunk,
        score: combinedScore,
        matchType: 'hybrid' as const,
      });
    }

    // Sort by combined score
    combined.sort((a, b) => b.score - a.score);

    return combined;
  }

  // ============================================================================
  // Public methods
  // ============================================================================

  async function initialize(): Promise<void> {
    const db = dbOps.getDb();

    // Try to load sqlite-vec extension
    if (storeConfig.enableVectorSearch) {
      try {
        // Dynamic import to handle cases where sqlite-vec is not installed
        const sqliteVec = await import('sqlite-vec');
        sqliteVec.load(db);
        vecEnabled = true;
      } catch (error) {
        console.warn(
          '[SemanticStore] sqlite-vec not available, falling back to FTS-only mode:',
          (error as Error).message
        );
        vecEnabled = false;
      }
    }

    // Create main chunks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_chunks (
        id TEXT PRIMARY KEY,
        rowid INTEGER,
        timestamp INTEGER NOT NULL,
        text TEXT NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        source_event_id TEXT,
        source_type TEXT,
        session_id TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_semantic_chunks_timestamp ON semantic_chunks(timestamp);
      CREATE INDEX IF NOT EXISTS idx_semantic_chunks_session_id ON semantic_chunks(session_id);
      CREATE INDEX IF NOT EXISTS idx_semantic_chunks_source_event_id ON semantic_chunks(source_event_id);
    `);

    // Create FTS5 virtual table
    if (storeConfig.enableFtsSearch) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS semantic_chunks_fts USING fts5(
          text,
          tags,
          content='semantic_chunks',
          content_rowid='rowid'
        );

        -- Triggers to keep FTS index in sync
        CREATE TRIGGER IF NOT EXISTS semantic_chunks_fts_ai AFTER INSERT ON semantic_chunks BEGIN
          INSERT INTO semantic_chunks_fts(rowid, text, tags)
          VALUES (new.rowid, new.text, new.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS semantic_chunks_fts_ad AFTER DELETE ON semantic_chunks BEGIN
          INSERT INTO semantic_chunks_fts(semantic_chunks_fts, rowid, text, tags)
          VALUES ('delete', old.rowid, old.text, old.tags);
        END;

        CREATE TRIGGER IF NOT EXISTS semantic_chunks_fts_au AFTER UPDATE ON semantic_chunks BEGIN
          INSERT INTO semantic_chunks_fts(semantic_chunks_fts, rowid, text, tags)
          VALUES ('delete', old.rowid, old.text, old.tags);
          INSERT INTO semantic_chunks_fts(rowid, text, tags)
          VALUES (new.rowid, new.text, new.tags);
        END;
      `);
    }

    // Create sqlite-vec virtual table for vector search
    if (vecEnabled) {
      try {
        db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS semantic_chunks_vec USING vec0(
            chunk_id TEXT PRIMARY KEY,
            embedding FLOAT[${storeConfig.vectorDimensions}]
          );
        `);
      } catch (error) {
        console.warn('[SemanticStore] Failed to create vec0 table:', (error as Error).message);
        vecEnabled = false;
      }
    }

    // Initialize embedding cache
    if (embeddingCache) {
      embeddingCache.setDatabase(db);
      await embeddingCache.initialize();
    }

    dbOps.setInitialized(true);
  }

  async function close(): Promise<void> {
    return dbOps.close();
  }

  async function clear(): Promise<void> {
    const db = dbOps.getDb();

    db.exec('DELETE FROM semantic_chunks');

    if (storeConfig.enableFtsSearch) {
      try {
        db.exec("DELETE FROM semantic_chunks_fts WHERE semantic_chunks_fts MATCH '*'");
      } catch {
        // FTS table might not exist or be empty
      }
    }

    if (vecEnabled) {
      try {
        db.exec('DELETE FROM semantic_chunks_vec');
      } catch {
        // Vec table might not exist
      }
    }

    // Note: We intentionally do NOT clear embedding cache on clear()
    // because cached embeddings can be reused across sessions
  }

  async function add(input: SemanticChunkInput): Promise<SemanticChunk> {
    const db = dbOps.getDb();

    // Auto-generate embedding if embedFunction is set and no embedding provided
    let embedding = input.embedding;
    if (!embedding && embedFunction && vecEnabled) {
      try {
        // Check cache first
        if (embeddingCache) {
          const cached = await embeddingCache.get(input.text, embeddingProvider, embeddingModel);
          if (cached) {
            embedding = cached;
          }
        }

        // Generate if not cached
        if (!embedding) {
          embedding = await embedFunction(input.text);

          // Cache the result
          if (embeddingCache && embedding) {
            await embeddingCache.set(input.text, embedding, embeddingProvider, embeddingModel);
          }
        }
      } catch (error) {
        // Log warning but continue without embedding
        console.warn('[SemanticStore] Failed to generate embedding for chunk:', (error as Error).message);
      }
    }

    const chunk: SemanticChunk = {
      id: dbOps.generateId(),
      timestamp: dbOps.now(),
      text: input.text,
      tags: input.tags || [],
      sourceEventId: input.sourceEventId,
      sourceType: input.sourceType,
      sessionId: input.sessionId,
      embedding,
      metadata: input.metadata,
    };

    try {
      // Insert into main table
      const stmt = db.prepare(`
        INSERT INTO semantic_chunks (
          id, timestamp, text, tags, source_event_id, source_type,
          session_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        chunk.id,
        chunk.timestamp,
        chunk.text,
        JSON.stringify(chunk.tags),
        chunk.sourceEventId || null,
        chunk.sourceType || null,
        chunk.sessionId || null,
        chunk.metadata ? JSON.stringify(chunk.metadata) : null
      );

      // Update rowid
      db.prepare('UPDATE semantic_chunks SET rowid = ? WHERE id = ?').run(
        result.lastInsertRowid,
        chunk.id
      );

      // Insert into vector table if embedding available
      if (vecEnabled && chunk.embedding) {
        insertVector(chunk.id, chunk.embedding);
      }

      return chunk;
    } catch (error) {
      throw new DatabaseError('add', (error as Error).message, error as Error);
    }
  }

  async function get(id: UUID): Promise<SemanticChunk | null> {
    const db = dbOps.getDb();

    try {
      const stmt = db.prepare('SELECT * FROM semantic_chunks WHERE id = ?');
      const row = stmt.get(id) as ChunkRow | undefined;

      if (!row) return null;

      const chunk = rowToChunk(row);

      // Load embedding from vec table if available
      if (vecEnabled) {
        chunk.embedding = getVector(id);
      }

      return chunk;
    } catch (error) {
      throw new DatabaseError('get', (error as Error).message, error as Error);
    }
  }

  async function searchFts(
    query: string,
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    if (!storeConfig.enableFtsSearch) {
      return [];
    }

    const db = dbOps.getDb();

    if (!query.trim()) {
      return [];
    }

    try {
      const ftsQuery = buildFtsQuery(query);

      let sql = `
        SELECT sc.*, bm25(semantic_chunks_fts) as score
        FROM semantic_chunks_fts fts
        JOIN semantic_chunks sc ON fts.rowid = sc.rowid
        WHERE semantic_chunks_fts MATCH ?
      `;

      const params: unknown[] = [ftsQuery];

      if (options?.sessionId) {
        sql += ' AND sc.session_id = ?';
        params.push(options.sessionId);
      }

      if (options?.tags && options.tags.length > 0) {
        const tagConditions = options.tags.map(() => 'sc.tags LIKE ?');
        sql += ` AND (${tagConditions.join(' OR ')})`;
        params.push(...options.tags.map((tag) => `%"${tag}"%`));
      }

      sql += ' ORDER BY score';

      if (options?.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as (ChunkRow & { score: number })[];

      return rows.map((row) => ({
        chunk: rowToChunk(row),
        score: Math.abs(row.score), // bm25 returns negative scores
        matchType: 'fts' as const,
      }));
    } catch (error) {
      throw new SemanticSearchError(
        `FTS search failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function searchVector(
    embedding: number[],
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    if (!vecEnabled) {
      // Fallback to in-memory cosine similarity if vec not available
      return searchVectorFallback(embedding, options);
    }

    const db = dbOps.getDb();
    const limit = options?.limit || 10;

    try {
      // Use sqlite-vec KNN search
      const vecJson = JSON.stringify(embedding);

      // First get KNN results from vec table
      const vecResults = db
        .prepare(
          `
          SELECT chunk_id, distance
          FROM semantic_chunks_vec
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
        `
        )
        .all(vecJson, limit * 2) as Array<{ chunk_id: string; distance: number }>;

      if (vecResults.length === 0) {
        return [];
      }

      // Get chunk details with filtering
      const chunkIds = vecResults.map((r) => r.chunk_id);
      const distanceMap = new Map(vecResults.map((r) => [r.chunk_id, r.distance]));

      let sql = `
        SELECT * FROM semantic_chunks
        WHERE id IN (${chunkIds.map(() => '?').join(', ')})
      `;
      const params: unknown[] = [...chunkIds];

      if (options?.sessionId) {
        sql += ' AND session_id = ?';
        params.push(options.sessionId);
      }

      if (options?.tags && options.tags.length > 0) {
        const tagConditions = options.tags.map(() => 'tags LIKE ?');
        sql += ` AND (${tagConditions.join(' OR ')})`;
        params.push(...options.tags.map((tag) => `%"${tag}"%`));
      }

      const rows = db.prepare(sql).all(...params) as ChunkRow[];

      // Map to results with distance-based score
      const results = rows
        .map((row) => {
          const distance = distanceMap.get(row.id) || Infinity;
          // Convert distance to similarity score (smaller distance = higher score)
          const score = 1 / (1 + distance);
          return {
            chunk: rowToChunk(row),
            score,
            matchType: 'vector' as const,
          };
        })
        .sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (error) {
      throw new SemanticSearchError(
        `Vector search failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Hybrid search combining FTS and vector results
   */
  async function search(
    query: string,
    options?: HybridSearchOptions
  ): Promise<SemanticSearchResult[]> {
    const limit = options?.limit || 10;
    // Default weights favor vector search when available
    const weights = options?.weights || { fts: 0.3, vector: 0.7 };

    // Get FTS results
    const ftsResults = storeConfig.enableFtsSearch
      ? await searchFts(query, { ...options, limit: limit * 2 })
      : [];

    // Determine if we should use vector search
    let embedding = options?.embedding;
    const shouldUseVector = options?.useVector !== false &&
      storeConfig.enableVectorSearch &&
      vecEnabled;

    // Auto-generate embedding if embedFunction is set and no embedding provided
    if (shouldUseVector && !embedding && embedFunction) {
      try {
        // Check cache first
        if (embeddingCache) {
          const cached = await embeddingCache.get(query, embeddingProvider, embeddingModel);
          if (cached) {
            embedding = cached;
          }
        }

        // Generate if not cached
        if (!embedding) {
          embedding = await embedFunction(query);

          // Cache the result
          if (embeddingCache && embedding) {
            await embeddingCache.set(query, embedding, embeddingProvider, embeddingModel);
          }
        }
      } catch (error) {
        // Log warning but continue with FTS-only
        console.warn('[SemanticStore] Failed to generate embedding:', (error as Error).message);
      }
    }

    // Get vector results if embedding available
    let vectorResults: SemanticSearchResult[] = [];
    if (shouldUseVector && embedding) {
      vectorResults = await searchVector(embedding, {
        ...options,
        limit: limit * 2,
      });
    }

    // If only FTS results, return them
    if (vectorResults.length === 0) {
      return ftsResults.slice(0, limit);
    }

    // If only vector results, return them
    if (ftsResults.length === 0) {
      return vectorResults.slice(0, limit);
    }

    // Combine and rerank results using weighted scoring
    const combined = mergeResults(ftsResults, vectorResults, weights);
    return combined.slice(0, limit);
  }

  async function setEmbeddingForChunk(chunkId: UUID, embedding: number[]): Promise<void> {
    if (!vecEnabled) {
      throw new SemanticSearchError('Vector search is not enabled');
    }

    if (embedding.length !== storeConfig.vectorDimensions) {
      throw new SemanticSearchError(
        `Embedding dimension mismatch: expected ${storeConfig.vectorDimensions}, got ${embedding.length}`
      );
    }

    insertVector(chunkId, embedding);
  }

  async function searchText(
    query: string,
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    return searchFts(query, options);
  }

  async function searchSimilar(
    queryOrEmbedding: string | number[],
    options?: VectorSearchOptions
  ): Promise<SemanticSearchResult[]> {
    let embedding: number[];

    if (Array.isArray(queryOrEmbedding)) {
      embedding = queryOrEmbedding;
    } else if (embedFunction) {
      embedding = await embedFunction(queryOrEmbedding);
    } else {
      throw new SemanticSearchError(
        'Vector search requires either an embedding array or embedFunction to be set'
      );
    }

    return searchVector(embedding, options);
  }

  async function deleteBySession(sessionId: string): Promise<number> {
    const db = dbOps.getDb();

    try {
      // Get chunk IDs to delete from vec table
      if (vecEnabled) {
        const chunks = db
          .prepare('SELECT id FROM semantic_chunks WHERE session_id = ?')
          .all(sessionId) as Array<{ id: string }>;

        for (const chunk of chunks) {
          db.prepare('DELETE FROM semantic_chunks_vec WHERE chunk_id = ?').run(chunk.id);
        }
      }

      // Delete from main table (FTS triggers will handle cleanup)
      const stmt = db.prepare('DELETE FROM semantic_chunks WHERE session_id = ?');
      const result = stmt.run(sessionId);
      return result.changes;
    } catch (error) {
      throw new DatabaseError('deleteBySession', (error as Error).message, error as Error);
    }
  }

  async function deleteChunk(id: UUID): Promise<boolean> {
    const db = dbOps.getDb();

    try {
      // Delete from vec table
      if (vecEnabled) {
        db.prepare('DELETE FROM semantic_chunks_vec WHERE chunk_id = ?').run(id);
      }

      // Delete from main table
      const result = db.prepare('DELETE FROM semantic_chunks WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError('delete', (error as Error).message, error as Error);
    }
  }

  async function count(sessionId?: string): Promise<number> {
    const db = dbOps.getDb();

    try {
      if (sessionId) {
        const result = db
          .prepare('SELECT COUNT(*) as count FROM semantic_chunks WHERE session_id = ?')
          .get(sessionId) as { count: number };
        return result.count;
      } else {
        const result = db
          .prepare('SELECT COUNT(*) as count FROM semantic_chunks')
          .get() as { count: number };
        return result.count;
      }
    } catch (error) {
      throw new DatabaseError('count', (error as Error).message, error as Error);
    }
  }

  // Return the instance object
  return {
    // DbOperations delegation
    setDatabase: (db: Database.Database) => {
      dbOps.setDatabase(db);
      if (embeddingCache) {
        embeddingCache.setDatabase(db);
      }
    },
    isInitialized: () => dbOps.isInitialized(),

    // BaseStore methods
    initialize,
    close,
    clear,

    // ISemanticStore methods
    add,
    get,
    searchFts,
    searchVector,
    search,
    deleteBySession,

    // Extended methods
    setEmbedFunction: (fn: EmbedFunction) => {
      embedFunction = fn;
    },
    getEmbedFunction: () => embedFunction,
    hasEmbedFunction: () => !!embedFunction,
    isVectorEnabled: () => vecEnabled,
    getVectorDimensions: () => storeConfig.vectorDimensions,
    setEmbedding: setEmbeddingForChunk,
    searchText,
    searchSimilar,
    delete: deleteChunk,
    count,

    // Embedding cache methods
    getEmbeddingCache: () => embeddingCache,
    getCacheStats: async () => {
      if (!embeddingCache) return null;
      const stats = await embeddingCache.getStats();
      return {
        totalEntries: stats.totalEntries,
        providers: stats.providers,
      };
    },
    setEmbeddingProviderInfo: (provider: string, model: string) => {
      embeddingProvider = provider;
      embeddingModel = model;
    },
  };
}
