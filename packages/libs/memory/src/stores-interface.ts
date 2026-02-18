/**
 * @agent-stack/memory - Stores Interface
 *
 * Defines the aggregated stores interface for dependency injection.
 */

import type {
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
} from '@agent-stack/memory-store-sqlite';

/**
 * Memory stores collection interface
 *
 * This interface allows the memory manager to work with any store implementation
 * (SQLite, JSON, or custom) as long as it provides all required stores.
 */
export interface MemoryStores {
  /** Event store for episodic memory */
  eventStore: IEventStore;

  /** Task state store for working memory */
  taskStateStore: ITaskStateStore;

  /** Summary store for compressed memory */
  summaryStore: ISummaryStore;

  /** Profile store for user preferences */
  profileStore: IProfileStore;

  /** Semantic store for searchable content */
  semanticStore: ISemanticStore;

  /** Initialize all stores */
  initialize(): Promise<void>;

  /** Close all stores */
  close(): Promise<void>;

  /** Clear all stores */
  clear(): Promise<void>;
}
