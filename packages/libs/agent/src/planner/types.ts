/**
 * @ai-stack/agent - Planner Types
 *
 * Defines types for execution planning with DAG-based
 * task decomposition and dependency management.
 */

// =============================================================================
// Plan Node Types
// =============================================================================

/**
 * Status of a plan node
 */
export type PlanNodeStatus =
  | 'pending'     // Not yet started
  | 'ready'       // Dependencies met, ready to execute
  | 'executing'   // Currently executing
  | 'completed'   // Successfully completed
  | 'failed'      // Execution failed
  | 'skipped'     // Skipped (dependency failed or manual skip)
  | 'cancelled';  // Cancelled by user

/**
 * A node in the plan DAG
 */
export interface PlanNode {
  /** Unique node identifier */
  id: string;

  /** Human-readable description of the task */
  description: string;

  /** Tool to use (if applicable) */
  tool?: string;

  /** Tool arguments (if applicable) */
  args?: Record<string, unknown>;

  /** Current status */
  status: PlanNodeStatus;

  /** Execution result (when completed) */
  result?: string;

  /** Error message (when failed) */
  error?: string;

  /** IDs of nodes this depends on */
  dependsOn: string[];

  /** IDs of nodes that depend on this (computed) */
  dependents: string[];

  /** IDs of blocking nodes (dependencies not yet completed) */
  blockedBy: string[];

  /** Estimated execution duration (ms) */
  estimatedDurationMs?: number;

  /** Actual execution duration (ms) */
  actualDurationMs?: number;

  /** Priority (lower = higher priority) */
  priority?: number;

  /** Whether this node can run in parallel with others */
  parallel?: boolean;

  /** Retry count for this node */
  retryCount?: number;

  /** Maximum retries allowed */
  maxRetries?: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Timestamp when execution started */
  startedAt?: number;

  /** Timestamp when execution completed */
  completedAt?: number;
}

// =============================================================================
// Plan DAG Types
// =============================================================================

/**
 * Status of the overall plan
 */
export type PlanStatus =
  | 'draft'       // Being created/edited
  | 'pending'     // Ready to execute
  | 'executing'   // Actively executing
  | 'paused'      // Execution paused
  | 'completed'   // All nodes completed
  | 'failed'      // One or more nodes failed
  | 'cancelled';  // Cancelled by user

/**
 * Plan DAG structure
 */
export interface PlanDAG {
  /** Unique plan identifier */
  id: string;

  /** High-level goal this plan achieves */
  goal: string;

  /** Reasoning behind the plan structure */
  reasoning?: string;

  /** Map of node ID to node */
  nodes: Map<string, PlanNode>;

  /** Topologically sorted execution order */
  executionOrder: string[];

  /** Current plan status */
  status: PlanStatus;

  /** Plan creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Version for concurrent modification detection */
  version: number;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Plan progress information
 */
export interface PlanProgress {
  /** Total number of nodes */
  total: number;
  /** Completed nodes */
  completed: number;
  /** Failed nodes */
  failed: number;
  /** Skipped nodes */
  skipped: number;
  /** Currently executing nodes */
  executing: number;
  /** Pending nodes */
  pending: number;
  /** Ready nodes (can be executed) */
  ready: number;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Estimated remaining time (ms) */
  estimatedRemainingMs?: number;
}

// =============================================================================
// Planner Configuration
// =============================================================================

/**
 * Planning mode
 */
export type PlanningMode =
  | 'react'         // ReAct pattern (interleaved planning/execution)
  | 'plan-execute'  // Plan first, then execute
  | 'hybrid';       // Plan initially, replan on failures

/**
 * Planner configuration
 */
export interface PlannerConfig {
  /** Planning mode */
  mode?: PlanningMode;

  /** Maximum steps in a plan */
  maxSteps?: number;

  /** Allow dynamic replanning during execution */
  allowDynamicReplanning?: boolean;

  /** Model to use for planning (defaults to agent's model) */
  model?: string;

  /** Custom planning prompt */
  planPrompt?: string;

  /** Whether to validate plan before execution */
  validateBeforeExecution?: boolean;

  /** Maximum parallel execution batch size */
  maxParallelBatchSize?: number;

  /** Enable plan caching */
  enableCaching?: boolean;

  /** Plan timeout (ms) */
  timeoutMs?: number;
}

/**
 * Context provided to planner for plan generation
 */
export interface PlanContext {
  /** Available tools for planning */
  availableTools?: Array<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;

  /** Additional context information */
  additionalContext?: Record<string, unknown>;

  /** Previous plan (for replanning) */
  previousPlan?: PlanDAG;

  /** Failure information (for replanning) */
  failureInfo?: {
    nodeId: string;
    error: string;
    attempt: number;
  };

  /** User constraints */
  constraints?: string[];

  /** Conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

// =============================================================================
// Plan Events
// =============================================================================

/**
 * Plan event types
 */
export type PlanEventType =
  | 'plan:created'
  | 'plan:started'
  | 'plan:completed'
  | 'plan:failed'
  | 'plan:cancelled'
  | 'plan:paused'
  | 'plan:resumed'
  | 'plan:replanned'
  | 'node:ready'
  | 'node:started'
  | 'node:completed'
  | 'node:failed'
  | 'node:skipped'
  | 'node:retrying';

/**
 * Plan event
 */
export interface PlanEvent {
  /** Event type */
  type: PlanEventType;
  /** Timestamp */
  timestamp: number;
  /** Plan ID */
  planId: string;
  /** Node ID (if node event) */
  nodeId?: string;
  /** Additional event data */
  data?: Record<string, unknown>;
}

/**
 * Plan event listener
 */
export type PlanEventListener = (event: PlanEvent) => void;

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default planner configuration
 */
export const DEFAULT_PLANNER_CONFIG: Required<
  Pick<PlannerConfig, 'mode' | 'maxSteps' | 'allowDynamicReplanning' | 'validateBeforeExecution' | 'maxParallelBatchSize' | 'enableCaching'>
> = {
  mode: 'plan-execute',
  maxSteps: 20,
  allowDynamicReplanning: true,
  validateBeforeExecution: true,
  maxParallelBatchSize: 5,
  enableCaching: false,
};
