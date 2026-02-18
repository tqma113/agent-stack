/**
 * @agent-stack/memory-store-sqlite
 *
 * SQLite storage layer for agent-stack memory system.
 *
 * This package provides the low-level storage implementations:
 * - Event Store: Episodic memory (conversations, tool calls, decisions)
 * - Task State Store: Working memory for task execution
 * - Summary Store: Rolling summaries for context compression
 * - Profile Store: User preferences and profile data
 * - Semantic Store: Searchable content with FTS5 and vector search
 *
 * @packageDocumentation
 */

// Factory
export {
  createSqliteStores,
  type SqliteStoresConfig,
  type MemoryStores,
  type SqliteMemoryStores,
} from './factory.js';

// Stores
export {
  // Database operations (composition helper)
  createDbOperations,
  type DbOperationsInstance,
  // Event Store
  createEventStore,
  type EventStoreInstance,
  // Task State Store
  createTaskStateStore,
  type TaskStateStoreInstance,
  // Summary Store
  createSummaryStore,
  type SummaryStoreInstance,
  // Profile Store
  createProfileStore,
  type ProfileStoreInstance,
  // Semantic Store
  createSemanticStore,
  type SemanticStoreInstance,
} from './stores/index.js';

export {
  DEFAULT_SEMANTIC_CONFIG,
  type SemanticStoreConfig,
  type VectorSearchOptions,
  type HybridSearchOptions,
  type EmbedFunction,
} from './stores/index.js';

// Errors
export {
  MemoryStoreError,
  StoreInitializationError,
  EventRecordError,
  TaskStateError,
  TaskStateConflictError,
  ProfileError,
  SemanticSearchError,
  DatabaseError,
} from './errors.js';

// Types
export type {
  // Common
  UUID,
  Timestamp,
  Confidence,
  TokenCount,

  // Events
  EventType,
  EventEntity,
  EventLink,
  MemoryEvent,
  EventInput,

  // Task State
  TaskStatus,
  TaskConstraint,
  PlanStep,
  TaskStep,
  TaskState,
  TaskStateUpdate,
  TaskStateSnapshot,

  // Summary
  SummaryDecision,
  SummaryTodo,
  Summary,
  SummaryInput,

  // Profile
  ConflictStrategy,
  ProfileItem,
  ProfileItemInput,
  ProfileKey,

  // Semantic
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  SemanticMatchType,

  // Store interfaces
  BaseStore,
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
} from './types.js';

// Constants
export { PROFILE_KEYS } from './types.js';
