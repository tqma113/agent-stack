/**
 * @ai-stack/agent - State Machine Types
 *
 * Defines types for agent execution state management,
 * including state snapshots, transitions, and checkpoints.
 */

import type { PlanStep } from '../types.js';

// =============================================================================
// Agent State
// =============================================================================

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'idle'        // Idle, waiting for input
  | 'planning'    // Planning phase
  | 'executing'   // Executing tasks
  | 'waiting'     // Waiting for user/external input
  | 'paused'      // Paused by user
  | 'error'       // Error occurred
  | 'completed';  // Task completed

/**
 * Error information in agent state
 */
export interface AgentError {
  /** Error message */
  message: string;
  /** Error code if available */
  code?: string;
  /** Step ID where error occurred */
  stepId?: string;
  /** Whether error is recoverable */
  recoverable?: boolean;
  /** Stack trace (only in debug mode) */
  stack?: string;
}

/**
 * Plan DAG reference (simplified for state storage)
 */
export interface PlanDAGRef {
  /** Plan ID */
  id: string;
  /** Goal description */
  goal: string;
  /** Total steps count */
  totalSteps: number;
  /** Completed steps count */
  completedSteps: number;
  /** Current step ID */
  currentStepId?: string;
}

/**
 * Message for conversation history (simplified for serialization)
 */
export interface SerializedMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

/**
 * Agent state snapshot (fully serializable)
 *
 * Contains all information needed to resume agent execution.
 */
export interface AgentState {
  /** State version for compatibility checking */
  version: number;

  /** Session ID */
  sessionId: string;

  /** Current task ID (if any) */
  taskId: string | null;

  /** Current step index in plan */
  stepIndex: number;

  /** Current execution plan reference */
  plan: PlanDAGRef | null;

  /**
   * Working memory (task-related temporary data)
   * Contains intermediate results, context, etc.
   */
  workingMemory: Record<string, unknown>;

  /** Current status */
  status: AgentStatus;

  /** Error information (if status is 'error') */
  error: AgentError | null;

  /** Conversation history (optional, for recovery) */
  conversationHistory?: SerializedMessage[];

  /** Creation timestamp */
  createdAt: number;

  /** Last update timestamp */
  updatedAt: number;

  /** Checkpoint name (if restored from checkpoint) */
  checkpointName?: string;

  /** Number of retries attempted */
  retryCount?: number;

  /** Metadata for custom use */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// State Transitions
// =============================================================================

/**
 * State transition events
 */
export type StateTransition =
  | { type: 'START'; input: string; taskId?: string }
  | { type: 'PLAN_CREATED'; plan: PlanDAGRef }
  | { type: 'STEP_START'; stepId: string }
  | { type: 'STEP_COMPLETE'; stepId: string; result: string }
  | { type: 'STEP_ERROR'; stepId: string; error: Error }
  | { type: 'STEP_SKIP'; stepId: string; reason: string }
  | { type: 'PAUSE'; reason?: string }
  | { type: 'RESUME' }
  | { type: 'WAIT'; reason: string }
  | { type: 'INPUT_RECEIVED'; input: string }
  | { type: 'RESET' }
  | { type: 'COMPLETE'; result: string }
  | { type: 'ERROR'; error: Error }
  | { type: 'RETRY'; reason: string };

/**
 * Valid state transitions map
 *
 * Key: current status
 * Value: allowed transition types
 */
export const VALID_TRANSITIONS: Record<AgentStatus, StateTransition['type'][]> = {
  idle: ['START'],
  planning: ['PLAN_CREATED', 'ERROR', 'PAUSE', 'RESET'],
  executing: [
    'STEP_START',
    'STEP_COMPLETE',
    'STEP_ERROR',
    'STEP_SKIP',
    'COMPLETE',
    'ERROR',
    'PAUSE',
    'WAIT',
    'RETRY',
  ],
  waiting: ['INPUT_RECEIVED', 'RESUME', 'ERROR', 'PAUSE', 'RESET'],
  paused: ['RESUME', 'RESET'],
  error: ['RESET', 'RETRY'],
  completed: ['RESET', 'START'],
};

// =============================================================================
// Checkpoint Types
// =============================================================================

/**
 * Checkpoint information
 */
export interface CheckpointInfo {
  /** Checkpoint ID (unique identifier) */
  id: string;

  /** Optional human-readable name */
  name?: string;

  /** Session ID this checkpoint belongs to */
  sessionId: string;

  /** Task ID (if any) */
  taskId?: string;

  /** Status when checkpoint was created */
  status: AgentStatus;

  /** Step index when checkpoint was created */
  stepIndex: number;

  /** Creation timestamp */
  createdAt: number;

  /** File size in bytes (if persisted) */
  sizeBytes?: number;

  /** Checkpoint description/notes */
  description?: string;
}

/**
 * Checkpoint storage interface
 */
export interface CheckpointStorage {
  /** Save state to checkpoint */
  save(state: AgentState, name?: string): Promise<string>;

  /** Load state from checkpoint */
  load(checkpointId: string): Promise<AgentState>;

  /** List all checkpoints for a session */
  list(sessionId?: string): Promise<CheckpointInfo[]>;

  /** Delete a checkpoint */
  delete(checkpointId: string): Promise<void>;

  /** Delete all checkpoints for a session */
  deleteAll(sessionId: string): Promise<void>;
}

// =============================================================================
// State Machine Configuration
// =============================================================================

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  /** Initial session ID (auto-generated if not provided) */
  sessionId?: string;

  /** Whether to auto-save checkpoints */
  autoCheckpoint?: boolean;

  /** Checkpoint interval (every N steps) */
  checkpointInterval?: number;

  /** Checkpoint storage path */
  checkpointPath?: string;

  /** Custom checkpoint storage implementation */
  checkpointStorage?: CheckpointStorage;

  /** State change callback */
  onStateChange?: (state: AgentState, transition: StateTransition) => void;

  /** Error callback */
  onError?: (error: Error, state: AgentState) => void;

  /** Maximum working memory size (entries) */
  maxWorkingMemorySize?: number;

  /** Whether to include conversation history in state */
  includeConversationHistory?: boolean;

  /** Debug mode (includes stack traces in errors) */
  debug?: boolean;
}

/**
 * Default state machine configuration
 */
export const DEFAULT_STATE_MACHINE_CONFIG: Partial<StateMachineConfig> = {
  autoCheckpoint: false,
  checkpointInterval: 5,
  maxWorkingMemorySize: 100,
  includeConversationHistory: true,
  debug: false,
};
