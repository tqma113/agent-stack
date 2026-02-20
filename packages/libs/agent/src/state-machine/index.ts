/**
 * @ai-stack/agent - State Machine Module
 *
 * Provides state management for agent execution with support for:
 * - State transitions (idle → planning → executing → completed)
 * - Checkpoint/restore for pause/resume
 * - Working memory management
 * - State subscription for UI updates
 */

export { createStateMachine, type StateMachineInstance } from './state-machine.js';
export type {
  AgentStatus,
  AgentState,
  AgentError,
  StateTransition,
  StateMachineConfig,
  CheckpointInfo,
  CheckpointStorage,
  PlanDAGRef,
  SerializedMessage,
} from './types.js';
export { VALID_TRANSITIONS, DEFAULT_STATE_MACHINE_CONFIG } from './types.js';
