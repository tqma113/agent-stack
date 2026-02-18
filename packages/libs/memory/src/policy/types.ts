/**
 * @agent-stack/memory - Policy Types
 *
 * Type definitions for the memory policy layer.
 */

import type { TokenCount, MemoryEvent, ProfileItem, ProfileKey } from '@agent-stack/memory-store';

// =============================================================================
// Rule Types
// =============================================================================

/**
 * Condition types for policy rules
 */
export type ConditionType =
  | 'event_type'
  | 'content_match'
  | 'token_threshold'
  | 'time_elapsed'
  | 'entity_present'
  | 'custom';

/**
 * Action types for policy rules
 */
export type ActionType =
  | 'write'
  | 'skip'
  | 'summarize'
  | 'retrieve'
  | 'extract_profile';

/**
 * Policy rule condition
 */
export interface RuleCondition {
  type: ConditionType;
  params: Record<string, unknown>;
}

/**
 * Policy rule action
 */
export interface RuleAction {
  type: ActionType;
  params: Record<string, unknown>;
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Rule priority (higher = evaluated first) */
  priority: number;
  /** Condition that triggers this rule */
  condition: RuleCondition;
  /** Action to take when condition matches */
  action: RuleAction;
  /** Whether the rule is enabled */
  enabled: boolean;
}

// =============================================================================
// Retrieval Decision Types
// =============================================================================

/**
 * Context for retrieval decisions
 */
export interface RetrievalContext {
  /** User's input query */
  userQuery?: string;
  /** Current session ID */
  sessionId?: string;
  /** Current task ID */
  taskId?: string;
  /** Event count in session */
  sessionEventCount?: number;
  /** Time since last retrieval (ms) */
  timeSinceLastRetrieval?: number;
  /** Custom context */
  metadata?: Record<string, unknown>;
}

/**
 * Result of retrieval decision
 */
export interface RetrievalDecision {
  /** Whether to retrieve memory */
  shouldRetrieve: boolean;
  /** Reason for the decision */
  reason: string;
  /** Layers to retrieve from */
  layers: Array<'profile' | 'taskState' | 'events' | 'semantic' | 'summary'>;
  /** Priority of retrieval */
  priority: 'high' | 'normal' | 'low';
}

/**
 * Search parameters for memory retrieval
 */
export interface MemorySearchParams {
  /** Query string for semantic search */
  query?: string;
  /** Session ID filter */
  sessionId?: string;
  /** Task ID filter */
  taskId?: string;
  /** Tags filter */
  tags?: string[];
  /** Maximum results per layer */
  limits: {
    events?: number;
    semantic?: number;
    summaries?: number;
  };
  /** Time window for events (ms) */
  eventsWindowMs?: number;
  /** Enable vector search */
  useVectorSearch?: boolean;
}

// =============================================================================
// Write Decision Types
// =============================================================================

/**
 * Context for write decisions
 */
export interface WriteContext {
  /** Event being written */
  event: MemoryEvent;
  /** Current session ID */
  sessionId?: string;
  /** Total events in session */
  sessionEventCount?: number;
  /** Total tokens in session */
  sessionTokenCount?: number;
  /** Whether this is an explicit user request */
  isExplicitUserRequest?: boolean;
}

/**
 * Write operation to execute
 */
export interface WriteOperation {
  /** Target layer */
  layer: 'event' | 'profile' | 'semantic' | 'summary';
  /** Operation type */
  type: 'create' | 'update' | 'delete';
  /** Payload for the operation */
  payload: Record<string, unknown>;
  /** Priority (for ordering) */
  priority: number;
}

/**
 * Result of write decision
 */
export interface WriteDecision {
  /** Whether to write */
  shouldWrite: boolean;
  /** Operations to execute */
  operations: WriteOperation[];
  /** Reason for the decision */
  reason: string;
  /** Confidence in the decision */
  confidence: number;
}

// =============================================================================
// Conflict Resolution Types
// =============================================================================

/**
 * Result of conflict resolution
 */
export interface ConflictResolution {
  /** Winning value */
  winner: unknown;
  /** Reason for selection */
  reason: string;
  /** Whether user review is needed */
  needsReview: boolean;
}

// =============================================================================
// Budget Types
// =============================================================================

/**
 * Token budget configuration
 */
export interface TokenBudget {
  profile: TokenCount;
  taskState: TokenCount;
  recentEvents: TokenCount;
  semanticChunks: TokenCount;
  summary: TokenCount;
  total: TokenCount;
}

/**
 * Budget allocation result
 */
export interface BudgetAllocation {
  profile: TokenCount;
  taskState: TokenCount;
  recentEvents: TokenCount;
  semanticChunks: TokenCount;
  summary: TokenCount;
  remaining: TokenCount;
}

// =============================================================================
// Policy Interface
// =============================================================================

/**
 * Memory Policy interface
 */
export interface IMemoryPolicy {
  // Retrieval decisions
  shouldRetrieve(context: RetrievalContext): RetrievalDecision;
  buildSearchParams(context: RetrievalContext): MemorySearchParams;

  // Write decisions
  shouldWrite(context: WriteContext): WriteDecision;
  buildWriteOperations(context: WriteContext): WriteOperation[];

  // Conflict resolution
  resolveConflict(key: string, existing: unknown, incoming: unknown): ConflictResolution;

  // Token budget
  allocateBudget(available: TokenBudget): BudgetAllocation;

  // Rule management
  addRule(rule: PolicyRule): void;
  removeRule(ruleId: string): void;
  getRules(): PolicyRule[];
  enableRule(ruleId: string): void;
  disableRule(ruleId: string): void;
}

// =============================================================================
// Preference Extraction Types
// =============================================================================

/**
 * Extracted preference from content
 */
export interface ExtractedPreference {
  key: ProfileKey;
  value: unknown;
  confidence: number;
}
