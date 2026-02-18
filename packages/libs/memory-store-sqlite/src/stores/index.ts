/**
 * @agent-stack/memory-store-sqlite - Stores
 *
 * Export all store implementations.
 */

// Database operations (composition helper)
export { createDbOperations, type DbOperationsInstance } from './db-operations.js';

// Event Store
export {
  createEventStore,
  type EventStoreInstance,
} from './event.js';

// Task State Store
export {
  createTaskStateStore,
  type TaskStateStoreInstance,
} from './task-state.js';

// Summary Store
export {
  createSummaryStore,
  type SummaryStoreInstance,
} from './summary.js';

// Profile Store
export {
  createProfileStore,
  type ProfileStoreInstance,
} from './profile.js';

// Semantic Store
export {
  createSemanticStore,
  DEFAULT_SEMANTIC_CONFIG,
  type SemanticStoreInstance,
  type SemanticStoreConfig,
  type VectorSearchOptions,
  type HybridSearchOptions,
  type EmbedFunction,
} from './semantic.js';

// Embedding Cache
export {
  createEmbeddingCache,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
  type EmbeddingCacheInstance,
  type EmbeddingCacheConfig,
  type EmbeddingCacheEntry,
} from './embedding-cache.js';
