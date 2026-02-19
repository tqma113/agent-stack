/**
 * @ai-stack/memory
 *
 * Memory system for AI agents with multi-layer storage.
 *
 * This package provides:
 * - **Policy Layer**: Decision logic for memory operations
 * - **Components**: Observer, injector, summarizer helpers
 * - **Store Re-exports**: Convenience re-exports from @ai-stack/memory-store-sqlite
 *
 * For direct storage operations, use @ai-stack/memory-store-sqlite.
 * For tool-based access, use @ai-stack/skill-memory.
 *
 * @packageDocumentation
 */

// =============================================================================
// Policy Layer (NEW)
// =============================================================================

// Memory Policy - main orchestrator
export {
  createMemoryPolicy,
  type MemoryPolicyConfig,
  type MemoryPolicyInstance,
} from './policy/index.js';

// Individual policies
export {
  createRetrievalPolicy,
  DEFAULT_RETRIEVAL_CONFIG,
  type RetrievalPolicyConfig,
  type IRetrievalPolicy,
} from './policy/index.js';

export {
  createWritePolicy,
  DEFAULT_WRITE_POLICY_CONFIG,
  type WritePolicyConfig,
  type IWritePolicy,
} from './policy/index.js';

export {
  createBudgetPolicy,
  DEFAULT_TOKEN_BUDGET,
  type TokenEstimationOptions,
  type IBudgetPolicy,
} from './policy/index.js';

// Policy types
export type {
  ConditionType,
  ActionType,
  RuleCondition,
  RuleAction,
  PolicyRule,
  RetrievalContext,
  RetrievalDecision,
  MemorySearchParams,
  WriteContext,
  WriteOperation,
  WriteDecision,
  ConflictResolution,
  TokenBudget,
  BudgetAllocation,
  IMemoryPolicy,
  ExtractedPreference,
} from './policy/index.js';

// =============================================================================
// Rules Layer (NEW)
// =============================================================================

export {
  createRuleEngine,
  createRule,
  conditions,
  actions,
  type IRuleEngine,
} from './rules/index.js';

export {
  DEFAULT_RETRIEVAL_RULES,
  DEFAULT_WRITE_RULES,
  getDefaultRules,
  getDefaultRetrievalRules,
  getDefaultWriteRules,
  createEventTypeWriteRule,
  createContentPatternRule,
} from './rules/index.js';

// =============================================================================
// Components (kept from original)
// =============================================================================

export {
  createMemoryObserver,
  DEFAULT_ENTITY_PATTERNS,
  type IMemoryObserver,
} from './observer.js';
export type { ObserverOptions, EntityPattern } from './observer.js';

export {
  createMemoryInjector,
  DEFAULT_INJECTION_TEMPLATE,
  type IMemoryInjector,
} from './injector.js';
export type { InjectionOptions } from './injector.js';

export {
  createMemorySummarizer,
  type IMemorySummarizer,
} from './summarizer.js';
export type { SummarizerOptions, SummaryResult } from './summarizer.js';

export { TaskStateReducer, TaskActions } from './state-reducer.js';
export type { TaskAction, ReducerResult } from './state-reducer.js';

// =============================================================================
// Compaction Module (NEW)
// =============================================================================

export {
  // Memory Flush
  createMemoryFlush,
  DEFAULT_MEMORY_FLUSH_CONFIG,
  DEFAULT_FLUSH_PROMPT,
  parseLLMFlushResponse,
  type MemoryFlushConfig,
  type FlushCheckResult,
  type FlushContent,
  type FlushResult,
  type FlushTriggerReason,
  type IMemoryFlush,
  // Compaction Manager
  createCompactionManager,
  DEFAULT_COMPACTION_CONFIG,
  type CompactionConfig,
  type CompactionState,
  type CompactionResult,
  type ICompactionManager,
} from './compaction/index.js';

// =============================================================================
// Transcript Module (NEW)
// =============================================================================

export {
  // Session Transcript
  createSessionTranscript,
  formatTranscript,
  type ISessionTranscript,
  type TranscriptEntry,
  type TranscriptContent,
  type TranscriptMetadata,
  type TranscriptSearchOptions,
  type TranscriptSearchResult,
  type TranscriptChunk,
  // Transcript Indexer
  createTranscriptIndexer,
  createDebouncer,
  DEFAULT_INDEXER_CONFIG,
  type ITranscriptIndexer,
  type TranscriptIndexerConfig,
  type IndexedTranscript,
  type SyncResult,
} from './transcript/index.js';

// =============================================================================
// Pipeline Module (NEW)
// =============================================================================

export {
  createMemoryPipeline,
  DEFAULT_WRITE_CONFIG,
  DEFAULT_READ_CONFIG,
  type IMemoryPipeline,
  type WritePipelineConfig,
  type ReadPipelineConfig,
  type WriteInput,
  type WriteResult,
  type ReadInput,
  type ReadResult,
  type PipelineStores,
} from './pipeline/index.js';

// =============================================================================
// Ranking Module (NEW)
// =============================================================================

export {
  // Temporal Decay
  applyTemporalDecay,
  createTemporalDecayProcessor,
  calculateExponentialDecay,
  calculateLinearDecay,
  calculateStepDecay,
  getTemporalDecayStats,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
  type TemporalDecayConfig,
  type DecayedSearchResult,
  type TemporalDecayStats,
  // MMR
  applyMMR,
  createMMRProcessor,
  needsDiversityReranking,
  getMMRStats,
  jaccardSimilarity,
  overlapSimilarity,
  cosineSimilarity,
  DEFAULT_MMR_CONFIG,
  type MMRConfig,
  type MMRSearchResult,
  type MMRStats,
  // Pipeline
  createRankingPipeline,
  type RankingPipelineConfig,
} from './ranking/index.js';

// =============================================================================
// Legacy Manager (deprecated, kept for backward compatibility)
// These exports will be removed in v1.0.0
// =============================================================================

/**
 * @deprecated Use `createMemoryPolicy` instead. Will be removed in v1.0.0.
 * Migration: Replace createMemoryManager with createMemoryPolicy for policy-based memory management.
 */
export {
  createMemoryManager,
  type MemoryManagerInstance,
  type MemoryManagerConfig,
} from './manager.js';

/**
 * @deprecated Use `SqliteMemoryStores` from `@ai-stack/memory-store-sqlite` instead. Will be removed in v1.0.0.
 */
export type { MemoryStores } from './stores-interface.js';

// =============================================================================
// Re-exports from @ai-stack/memory-store-sqlite
// =============================================================================

// Stores
export {
  createDbOperations,
  type DbOperationsInstance,
  createEventStore,
  type EventStoreInstance,
  createTaskStateStore,
  type TaskStateStoreInstance,
  createSummaryStore,
  type SummaryStoreInstance,
  createProfileStore,
  type ProfileStoreInstance,
  createSemanticStore,
  type SemanticStoreInstance,
  DEFAULT_SEMANTIC_CONFIG,
  type SemanticStoreConfig,
  type VectorSearchOptions,
  type HybridSearchOptions,
  type EmbedFunction,
  // Embedding Cache
  createEmbeddingCache,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
  type EmbeddingCacheInstance,
  type EmbeddingCacheConfig,
  type EmbeddingCacheEntry,
} from '@ai-stack/memory-store-sqlite';

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
} from '@ai-stack/memory-store-sqlite';

// Types
export type {
  UUID,
  Timestamp,
  Confidence,
  TokenCount,
  EventType,
  EventEntity,
  EventLink,
  MemoryEvent,
  EventInput,
  TaskStatus,
  TaskConstraint,
  PlanStep,
  TaskStep,
  TaskState,
  TaskStateUpdate,
  TaskStateSnapshot,
  SummaryDecision,
  SummaryTodo,
  Summary,
  SummaryInput,
  ConflictStrategy,
  ProfileItem,
  ProfileItemInput,
  ProfileKey,
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  SemanticMatchType,
  BaseStore,
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
} from '@ai-stack/memory-store-sqlite';

// Constants
export { PROFILE_KEYS } from '@ai-stack/memory-store-sqlite';

// =============================================================================
// Legacy Errors (aliases for backward compatibility)
// These exports will be removed in v1.0.0
// =============================================================================

/**
 * @deprecated Use `MemoryStoreError` directly. Will be removed in v1.0.0.
 */
export {
  MemoryStoreError as MemoryError,
} from '@ai-stack/memory-store-sqlite';

/**
 * @deprecated Use `ProfileError` directly. Will be removed in v1.0.0.
 */
export {
  ProfileError as ProfileKeyNotAllowedError,
} from '@ai-stack/memory-store-sqlite';

// =============================================================================
// Legacy Types (aliases for backward compatibility)
// These exports will be removed in v1.0.0
// =============================================================================

/**
 * @deprecated Use `TokenBudget` from `./policy/types.js`. Will be removed in v1.0.0.
 */
export type {
  TokenBudget as TokenBudgetConfig,
} from './policy/types.js';

/**
 * @deprecated These types are for legacy MemoryManager only. Will be removed in v1.0.0.
 * Migration: Use the new policy-based types instead.
 */
export type { MemoryBundle, MemoryWarning, MemoryConfig } from './types.js';

/**
 * @deprecated Use `WritePolicyConfig` from `./policy/index.js`. Will be removed in v1.0.0.
 */
export type {
  WritePolicyConfig as LegacyWritePolicyConfig,
  RetrievalConfig,
  IMemoryManager,
  ObserverCallback,
} from './types.js';

/**
 * @deprecated Use `DEFAULT_WRITE_POLICY_CONFIG` from `./policy/index.js`. Will be removed in v1.0.0.
 */
export {
  DEFAULT_WRITE_POLICY,
  DEFAULT_RETRIEVAL_CONFIG as DEFAULT_RETRIEVAL_CONFIG_LEGACY,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';

/**
 * @deprecated Use `createWritePolicy` from `./policy/index.js`. Will be removed in v1.0.0.
 * Migration: Replace createWritePolicyEngine with createWritePolicy for policy-based writes.
 */
export {
  createWritePolicyEngine,
  type IWritePolicyEngine,
} from './write-policy.js';

/**
 * @deprecated Use `createRetrievalPolicy` from `./policy/index.js`. Will be removed in v1.0.0.
 * Migration: Replace createMemoryRetriever with createRetrievalPolicy for policy-based retrieval.
 */
export {
  createMemoryRetriever,
  type IMemoryRetriever,
} from './retriever.js';
/**
 * @deprecated These types are for legacy retriever only. Will be removed in v1.0.0.
 */
export type { RetrievalOptions, RetrieverStores } from './retriever.js';

/**
 * @deprecated Use `createBudgetPolicy` from `./policy/index.js`. Will be removed in v1.0.0.
 * Migration: Replace createMemoryBudgeter with createBudgetPolicy for policy-based budgeting.
 */
export {
  createMemoryBudgeter,
  type IMemoryBudgeter,
} from './budgeter.js';
/**
 * @deprecated Use `BudgetAllocation` from `./policy/types.js`. Will be removed in v1.0.0.
 */
export type { BudgetAllocation as LegacyBudgetAllocation } from './budgeter.js';
