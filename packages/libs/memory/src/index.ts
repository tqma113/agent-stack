/**
 * @agent-stack/memory
 *
 * Memory system for AI agents with multi-layer storage.
 *
 * This package provides:
 * - **Policy Layer**: Decision logic for memory operations
 * - **Components**: Observer, injector, summarizer helpers
 * - **Store Re-exports**: Convenience re-exports from @agent-stack/memory-store
 *
 * For direct storage operations, use @agent-stack/memory-store.
 * For tool-based access, use @agent-stack/skill-memory.
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
// Legacy Manager (deprecated, kept for backward compatibility)
// =============================================================================

export {
  createMemoryManager,
  type MemoryManagerInstance,
} from './manager.js';

// =============================================================================
// Re-exports from @agent-stack/memory-store
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
} from '@agent-stack/memory-store';

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
} from '@agent-stack/memory-store';

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
} from '@agent-stack/memory-store';

// Constants
export { PROFILE_KEYS } from '@agent-stack/memory-store';

// =============================================================================
// Legacy Errors (aliases for backward compatibility)
// =============================================================================

export {
  MemoryStoreError as MemoryError,
} from '@agent-stack/memory-store';

// Legacy error re-exports
export {
  ProfileError as ProfileKeyNotAllowedError,
} from '@agent-stack/memory-store';

// =============================================================================
// Legacy Types (aliases for backward compatibility)
// =============================================================================

// Re-export types that were in the old types.ts
export type {
  TokenBudget as TokenBudgetConfig,
} from './policy/types.js';

// Legacy interfaces from old index
export type { MemoryBundle, MemoryWarning, MemoryConfig } from './types.js';

export type {
  WritePolicyConfig as LegacyWritePolicyConfig,
  RetrievalConfig,
  IMemoryManager,
  ObserverCallback,
} from './types.js';

export {
  DEFAULT_WRITE_POLICY,
  DEFAULT_RETRIEVAL_CONFIG as DEFAULT_RETRIEVAL_CONFIG_LEGACY,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';

// Legacy write-policy exports
export {
  createWritePolicyEngine,
  type IWritePolicyEngine,
} from './write-policy.js';

// Legacy retriever exports
export {
  createMemoryRetriever,
  type IMemoryRetriever,
} from './retriever.js';
export type { RetrievalOptions, RetrieverStores } from './retriever.js';

// Legacy budgeter exports
export {
  createMemoryBudgeter,
  type IMemoryBudgeter,
} from './budgeter.js';
export type { BudgetAllocation as LegacyBudgetAllocation } from './budgeter.js';
