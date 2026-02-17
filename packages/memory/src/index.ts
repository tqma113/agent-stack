/**
 * @agent-stack/memory
 *
 * Memory system for AI agents with multi-layer storage.
 *
 * Features:
 * - Episodic memory (event log)
 * - Working memory (task state)
 * - Summary memory (compressed context)
 * - Profile memory (user preferences)
 * - Semantic memory (searchable content)
 *
 * @packageDocumentation
 */

// Main manager
export {
  createMemoryManager,
  type MemoryManagerInstance,
} from './manager.js';

// Components
export {
  createMemoryObserver,
  DEFAULT_ENTITY_PATTERNS,
  type IMemoryObserver,
} from './observer.js';
export type { ObserverOptions, EntityPattern } from './observer.js';

export {
  createMemoryRetriever,
  type IMemoryRetriever,
} from './retriever.js';
export type { RetrievalOptions, RetrieverStores } from './retriever.js';

export {
  createMemoryInjector,
  DEFAULT_INJECTION_TEMPLATE,
  type IMemoryInjector,
} from './injector.js';
export type { InjectionOptions } from './injector.js';

export {
  createMemoryBudgeter,
  type IMemoryBudgeter,
} from './budgeter.js';
export type { BudgetAllocation, TokenEstimationOptions } from './budgeter.js';

export {
  createWritePolicyEngine,
  type IWritePolicyEngine,
} from './write-policy.js';
export type { WriteDecision, ConflictResolution } from './write-policy.js';

export {
  createMemorySummarizer,
  type IMemorySummarizer,
} from './summarizer.js';
export type { SummarizerOptions, SummaryResult } from './summarizer.js';

export { TaskStateReducer, TaskActions } from './state-reducer.js';
export type { TaskAction, ReducerResult } from './state-reducer.js';

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
  MemoryError,
  StoreInitializationError,
  EventRecordError,
  TaskStateError,
  TaskStateConflictError,
  ProfileError,
  ProfileKeyNotAllowedError,
  RetrievalError,
  SummarizationError,
  SemanticSearchError,
  TokenBudgetExceededError,
  WritePolicyError,
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

  // Bundle
  MemoryWarning,
  MemoryBundle,

  // Configuration
  TokenBudget,
  WritePolicyConfig,
  RetrievalConfig,
  MemoryConfig,

  // Store interfaces
  BaseStore,
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
  IMemoryManager,
  ObserverCallback,
} from './types.js';

// Constants
export {
  PROFILE_KEYS,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_WRITE_POLICY,
  DEFAULT_RETRIEVAL_CONFIG,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';
