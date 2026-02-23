/**
 * Knowledge Manager
 *
 * Unified management of code and document indexing with integrated search.
 * Uses its own SQLite database with SemanticStore for independent operation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createDatabase,
  loadVecExtension,
  createSemanticStore,
  type DatabaseInstance,
  type SemanticStoreInstance,
  type EmbedFunction,
  type SemanticStoreConfig,
} from '@ai-stack/memory-store-sqlite';
import type { TreeStoreInstance, TreeRoot } from '@ai-stack/tree-index';

import type {
  KnowledgeManagerConfig,
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
  KnowledgeStats,
  CodeSearchOptions,
  DocSearchOptions,
  DocSourceInput,
  DocSource,
  IndexSummary,
  CrawlSummary,
  UUID,
} from './types.js';
import { DEFAULT_CODE_INDEXER_CONFIG, DEFAULT_DOC_INDEXER_CONFIG } from './types.js';
import { KnowledgeError } from './errors.js';
import { createCodeIndexer, type CodeIndexerInstance } from './code/index.js';
import { createDocIndexer, type DocIndexerInstance } from './doc/index.js';
import { createHybridSearch, type HybridSearchInstance } from './retriever/index.js';

/** Default knowledge database path */
const DEFAULT_KNOWLEDGE_DB_PATH = 'knowledge/sqlite.db';

/**
 * Knowledge manager instance interface
 */
export interface KnowledgeManagerInstance {
  /** Initialize */
  initialize(): Promise<void>;

  /** Close */
  close(): Promise<void>;

  /** Get code indexer */
  getCodeIndexer(): CodeIndexerInstance | undefined;

  /** Get document indexer */
  getDocIndexer(): DocIndexerInstance | undefined;

  /** Get semantic store */
  getSemanticStore(): SemanticStoreInstance | undefined;

  /** Unified search (code + docs + optionally memory) */
  search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** Search code */
  searchCode(query: string, options?: CodeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** Search documents */
  searchDocs(query: string, options?: DocSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** Index codebase */
  indexCode(options?: { force?: boolean }): Promise<IndexSummary>;

  /** Crawl documents */
  crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary>;

  /** Add document source */
  addDocSource(input: DocSourceInput): Promise<DocSource>;

  /** Remove document source */
  removeDocSource(sourceId: UUID): Promise<void>;

  /** Update document source */
  updateDocSource(sourceId: UUID, update: { name?: string; tags?: string[]; enabled?: boolean }): Promise<DocSource | undefined>;

  /** Get statistics */
  getStats(): Promise<KnowledgeStats>;

  /** Clear all data */
  clear(): Promise<void>;

  /** Set embedding function */
  setEmbedFunction(fn: EmbedFunction): void;

  /** Start code file watching */
  startWatching(): void;

  /** Stop code file watching */
  stopWatching(): void;

  /** Enable/disable tree indexing */
  enableTreeIndex(enabled?: boolean): void;

  /** Get code tree store instance */
  getCodeTreeStore(): TreeStoreInstance | null;

  /** Get document tree store instance */
  getDocTreeStore(): TreeStoreInstance | null;

  /** Get code tree root */
  getCodeTreeRoot(): TreeRoot | null;

  /** Get document tree root */
  getDocTreeRoot(): TreeRoot | null;
}

/**
 * Create a knowledge manager
 */
export function createKnowledgeManager(
  config: KnowledgeManagerConfig = {}
): KnowledgeManagerInstance {
  // Private state
  let semanticStore: SemanticStoreInstance | null = null;
  let databaseInstance: DatabaseInstance | null = null;
  let codeIndexer: CodeIndexerInstance | null = null;
  let docIndexer: DocIndexerInstance | null = null;
  let hybridSearch: HybridSearchInstance | null = null;
  let embedFunction: EmbedFunction | undefined;
  let initialized = false;
  let treeIndexEnabled = config.treeIndex?.enabled ?? false;

  // Configuration
  const dbPath = config.dbPath || DEFAULT_KNOWLEDGE_DB_PATH;
  const codeEnabled = config.code?.enabled !== false;
  const docEnabled = config.doc?.enabled !== false;

  const codeConfig = {
    ...DEFAULT_CODE_INDEXER_CONFIG,
    ...config.code,
  };

  const docConfig = {
    ...DEFAULT_DOC_INDEXER_CONFIG,
    ...config.doc,
  };

  const searchConfig = {
    defaultWeights: { fts: 0.3, vector: 0.7 },
    defaultLimit: 10,
    temporalDecay: { enabled: true, halfLifeDays: 30 },
    mmr: { enabled: true, lambda: 0.7 },
    ...config.search,
  };

  /**
   * Initialize
   */
  async function initialize(): Promise<void> {
    if (initialized) return;

    // Create database using the factory from memory-store-sqlite
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    databaseInstance = createDatabase({
      path: dbPath,
      wal: true,
      foreignKeys: true,
    });

    // Load sqlite-vec extension for vector search
    await loadVecExtension(databaseInstance.db);

    // Create SemanticStore for chunks and vector search
    semanticStore = createSemanticStore(config.semantic);
    semanticStore.setDatabase(databaseInstance.db);
    await semanticStore.initialize();

    if (embedFunction) {
      semanticStore.setEmbedFunction(embedFunction);
    }

    // Create code indexer
    if (codeEnabled) {
      codeIndexer = createCodeIndexer(codeConfig);
      codeIndexer.setDatabase(databaseInstance.db);
      codeIndexer.setStore(semanticStore);
      if (embedFunction) {
        codeIndexer.setEmbedFunction(embedFunction);
      }
      if (treeIndexEnabled) {
        codeIndexer.enableTreeIndex(true);
      }
      await codeIndexer.initialize();
    }

    // Create document indexer
    if (docEnabled) {
      docIndexer = createDocIndexer(docConfig);
      docIndexer.setDatabase(databaseInstance.db);
      docIndexer.setStore(semanticStore);
      if (embedFunction) {
        docIndexer.setEmbedFunction(embedFunction);
      }
      if (treeIndexEnabled) {
        docIndexer.enableTreeIndex(true);
      }
      await docIndexer.initialize();
    }

    // Create hybrid search
    hybridSearch = createHybridSearch({
      ftsWeight: searchConfig.defaultWeights.fts,
      vectorWeight: searchConfig.defaultWeights.vector,
      temporalDecay: {
        enabled: searchConfig.temporalDecay?.enabled ?? true,
        halfLifeDays: searchConfig.temporalDecay?.halfLifeDays ?? 30,
        minMultiplier: 0.1,
      },
      mmr: {
        enabled: searchConfig.mmr?.enabled ?? true,
        lambda: searchConfig.mmr?.lambda ?? 0.7,
        diversityThreshold: 0.8,
      },
    });

    // Wire up tree stores for tree-aware search
    if (treeIndexEnabled) {
      if (codeIndexer) {
        hybridSearch.setCodeTreeStore(codeIndexer.getTreeStore());
      }
      if (docIndexer) {
        hybridSearch.setDocTreeStore(docIndexer.getTreeStore());
      }
    }

    initialized = true;
  }

  /**
   * Close
   */
  async function close(): Promise<void> {
    if (codeIndexer) {
      await codeIndexer.close();
    }
    if (docIndexer) {
      await docIndexer.close();
    }
    if (semanticStore) {
      await semanticStore.close();
      semanticStore = null;
    }
    if (databaseInstance) {
      databaseInstance.close();
      databaseInstance = null;
    }

    initialized = false;
  }

  /**
   * Get code indexer
   */
  function getCodeIndexer(): CodeIndexerInstance | undefined {
    return codeIndexer || undefined;
  }

  /**
   * Get document indexer
   */
  function getDocIndexer(): DocIndexerInstance | undefined {
    return docIndexer || undefined;
  }

  /**
   * Get semantic store
   */
  function getSemanticStore(): SemanticStoreInstance | undefined {
    return semanticStore || undefined;
  }

  /**
   * Unified search
   */
  async function search(
    query: string,
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    if (!semanticStore) {
      throw new KnowledgeError('Manager not initialized');
    }

    if (!hybridSearch) {
      throw new KnowledgeError('Manager not initialized');
    }

    return hybridSearch.search(query, semanticStore, {
      ...options,
      limit: options?.limit || searchConfig.defaultLimit,
    });
  }

  /**
   * Search code
   */
  async function searchCode(
    query: string,
    options?: CodeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    if (!codeIndexer) {
      throw new KnowledgeError('Code indexer not enabled');
    }

    return codeIndexer.search(query, options);
  }

  /**
   * Search documents
   */
  async function searchDocs(
    query: string,
    options?: DocSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    if (!docIndexer) {
      throw new KnowledgeError('Document indexer not enabled');
    }

    return docIndexer.search(query, options);
  }

  /**
   * Index codebase
   */
  async function indexCode(options?: { force?: boolean }): Promise<IndexSummary> {
    if (!codeIndexer) {
      throw new KnowledgeError('Code indexer not enabled');
    }

    return codeIndexer.indexDirectory(options);
  }

  /**
   * Crawl documents
   */
  async function crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary> {
    if (!docIndexer) {
      throw new KnowledgeError('Document indexer not enabled');
    }

    return docIndexer.crawlAll(options);
  }

  /**
   * Add document source
   */
  async function addDocSource(input: DocSourceInput): Promise<DocSource> {
    if (!docIndexer) {
      throw new KnowledgeError('Document indexer not enabled');
    }

    return docIndexer.addSource(input);
  }

  /**
   * Remove document source
   */
  async function removeDocSource(sourceId: UUID): Promise<void> {
    if (!docIndexer) {
      throw new KnowledgeError('Document indexer not enabled');
    }

    return docIndexer.removeSource(sourceId);
  }

  /**
   * Update document source
   */
  async function updateDocSource(sourceId: UUID, update: { name?: string; tags?: string[]; enabled?: boolean }): Promise<DocSource | undefined> {
    if (!docIndexer) {
      throw new KnowledgeError('Document indexer not enabled');
    }

    return docIndexer.updateSource(sourceId, update);
  }

  /**
   * Get statistics
   */
  async function getStats(): Promise<KnowledgeStats> {
    const stats: KnowledgeStats = {
      code: {
        enabled: codeEnabled,
        totalFiles: 0,
        totalChunks: 0,
        lastIndexedAt: undefined,
      },
      doc: {
        enabled: docEnabled,
        totalSources: 0,
        totalPages: 0,
        totalChunks: 0,
        lastCrawledAt: undefined,
      },
    };

    if (codeIndexer) {
      const codeStatus = await codeIndexer.getStatus();
      stats.code.totalFiles = codeStatus.totalFiles;
      stats.code.totalChunks = codeStatus.totalChunks;
      stats.code.lastIndexedAt = codeStatus.lastIndexedAt;
    }

    if (docIndexer) {
      const sources = await docIndexer.listSources();
      stats.doc.totalSources = sources.length;

      // Find last crawled time
      const lastCrawled = sources
        .filter((s) => s.lastCrawledAt)
        .sort((a, b) => (b.lastCrawledAt || 0) - (a.lastCrawledAt || 0))[0];
      stats.doc.lastCrawledAt = lastCrawled?.lastCrawledAt;
    }

    return stats;
  }

  /**
   * Clear all data
   */
  async function clear(): Promise<void> {
    if (codeIndexer) {
      await codeIndexer.clear();
    }
    if (docIndexer) {
      await docIndexer.clear();
    }
  }

  /**
   * Set embed function
   */
  function setEmbedFunction(fn: EmbedFunction): void {
    embedFunction = fn;
    if (semanticStore) {
      semanticStore.setEmbedFunction(fn);
    }
    if (codeIndexer) {
      codeIndexer.setEmbedFunction(fn);
    }
    if (docIndexer) {
      docIndexer.setEmbedFunction(fn);
    }
  }

  /**
   * Start code file watching
   */
  function startWatching(): void {
    if (codeIndexer) {
      codeIndexer.startWatching();
    }
  }

  /**
   * Stop code file watching
   */
  function stopWatching(): void {
    if (codeIndexer) {
      codeIndexer.stopWatching();
    }
  }

  /**
   * Enable/disable tree indexing
   */
  function enableTreeIndex(enabled = true): void {
    treeIndexEnabled = enabled;
    if (codeIndexer) {
      codeIndexer.enableTreeIndex(enabled);
    }
    if (docIndexer) {
      docIndexer.enableTreeIndex(enabled);
    }
  }

  /**
   * Get code tree store
   */
  function getCodeTreeStore(): TreeStoreInstance | null {
    return codeIndexer?.getTreeStore() || null;
  }

  /**
   * Get document tree store
   */
  function getDocTreeStore(): TreeStoreInstance | null {
    return docIndexer?.getTreeStore() || null;
  }

  /**
   * Get code tree root
   */
  function getCodeTreeRoot(): TreeRoot | null {
    return codeIndexer?.getTreeRoot() || null;
  }

  /**
   * Get document tree root
   */
  function getDocTreeRoot(): TreeRoot | null {
    return docIndexer?.getTreeRoot() || null;
  }

  return {
    initialize,
    close,
    getCodeIndexer,
    getDocIndexer,
    getSemanticStore,
    search,
    searchCode,
    searchDocs,
    indexCode,
    crawlDocs,
    addDocSource,
    removeDocSource,
    updateDocSource,
    getStats,
    clear,
    setEmbedFunction,
    startWatching,
    stopWatching,
    enableTreeIndex,
    getCodeTreeStore,
    getDocTreeStore,
    getCodeTreeRoot,
    getDocTreeRoot,
  };
}
