/**
 * @ai-stack/assistant - Memory Types
 */

export type {
  MemoryDocument,
  ProfileSection,
  FactItem,
  TodoItem,
  DailyLogEntry,
  DailyLog,
  MarkdownMemoryConfig,
} from '../types.js';

/**
 * Memory sync status
 */
export interface SyncStatus {
  /** Last sync timestamp */
  lastSyncAt?: Date;
  /** Number of items synced */
  itemCount: number;
  /** Whether sync is in progress */
  inProgress: boolean;
  /** Last error if any */
  lastError?: string;
  /** Number of files checked (incremental sync) */
  filesChecked?: number;
  /** Number of files reindexed (incremental sync) */
  filesReindexed?: number;
  /** Number of files skipped - unchanged (incremental sync) */
  filesSkipped?: number;
}

/**
 * Memory search result
 */
export interface MemorySearchResult {
  /** Result type */
  type: 'fact' | 'todo' | 'log' | 'note';
  /** Content text */
  content: string;
  /** Relevance score */
  score: number;
  /** Source (file path or section) */
  source: string;
  /** Timestamp if available */
  timestamp?: Date;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Memory query options
 */
export interface MemoryQueryOptions {
  /** Maximum results */
  limit?: number;
  /** Filter by type */
  types?: Array<'fact' | 'todo' | 'log' | 'note'>;
  /** Date range filter */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Minimum score threshold */
  minScore?: number;
}

/**
 * Search mode for hybrid search
 */
export type SearchMode = 'bm25' | 'vector' | 'hybrid';

/**
 * Hybrid search options extending MemoryQueryOptions
 */
export interface HybridSearchOptions extends MemoryQueryOptions {
  /** Search mode (default: 'hybrid' when vector search is enabled, 'bm25' otherwise) */
  mode?: SearchMode;
  /** Custom weights for hybrid search (overrides config defaults) */
  weights?: {
    /** FTS (BM25) weight */
    fts: number;
    /** Vector search weight */
    vector: number;
  };
}
