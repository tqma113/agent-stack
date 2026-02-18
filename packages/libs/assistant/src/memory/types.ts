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
