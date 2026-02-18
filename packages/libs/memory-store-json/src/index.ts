/**
 * @agent-stack/memory-store-json
 *
 * JSON/Markdown storage layer for agent-stack memory system.
 * Zero native dependencies - works everywhere Node.js runs.
 *
 * This package provides lightweight JSON-based storage implementations:
 * - Event Store: Episodic memory stored as JSON files per session
 * - Task State Store: Working memory with JSON task files
 * - Summary Store: Rolling summaries in JSON + human-readable Markdown
 * - Profile Store: User preferences in a single JSON file
 * - Semantic Store: Searchable content with simple FTS via inverted index
 *
 * Use this for:
 * - Development and prototyping (no native dependencies to compile)
 * - Lightweight deployments
 * - Human-readable memory storage
 *
 * For high-performance production use, see @agent-stack/memory-store-sqlite (SQLite).
 *
 * @packageDocumentation
 */

// Factory
export {
  createJsonStores,
  type JsonStoresConfig,
  type MemoryStores,
} from './factory.js';

// Individual stores
export {
  createJsonEventStore,
  type JsonEventStoreConfig,
  createJsonTaskStateStore,
  type JsonTaskStateStoreConfig,
  createJsonSummaryStore,
  type JsonSummaryStoreConfig,
  createJsonProfileStore,
  type JsonProfileStoreConfig,
  createJsonSemanticStore,
  type JsonSemanticStoreConfig,
} from './stores/index.js';

// Re-export types from memory-store for convenience
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
} from '@agent-stack/memory-store-sqlite';
