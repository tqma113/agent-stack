/**
 * @ai-stack/agent - State Machine Implementation
 *
 * Provides state management for agent execution with
 * checkpoint support for pause/resume functionality.
 */

import { promises as fs } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  AgentState,
  AgentStatus,
  AgentError,
  StateTransition,
  StateMachineConfig,
  CheckpointInfo,
  CheckpointStorage,
  PlanDAGRef,
  SerializedMessage,
} from './types.js';
import { VALID_TRANSITIONS, DEFAULT_STATE_MACHINE_CONFIG } from './types.js';

// =============================================================================
// State Machine Instance Interface
// =============================================================================

/**
 * State machine instance interface
 */
export interface StateMachineInstance {
  /** Get current state (immutable copy) */
  getState(): AgentState;

  /** Get current status */
  getStatus(): AgentStatus;

  /** Trigger state transition */
  transition(event: StateTransition): AgentState;

  /** Check if transition is valid */
  canTransition(event: StateTransition): boolean;

  /** Pause execution */
  pause(reason?: string): void;

  /** Resume execution */
  resume(): void;

  /** Reset to initial state */
  reset(): void;

  /** Create checkpoint */
  checkpoint(name?: string): Promise<string>;

  /** Restore from checkpoint */
  restore(checkpointId: string): Promise<AgentState>;

  /** List all checkpoints */
  listCheckpoints(): Promise<CheckpointInfo[]>;

  /** Delete checkpoint */
  deleteCheckpoint(checkpointId: string): Promise<void>;

  /** Export state to JSON string */
  exportState(): string;

  /** Import state from JSON string */
  importState(serialized: string): AgentState;

  /** Subscribe to state changes */
  subscribe(callback: (state: AgentState) => void): () => void;

  /** Update working memory */
  updateWorkingMemory(key: string, value: unknown): void;

  /** Get working memory value */
  getWorkingMemory<T = unknown>(key: string): T | undefined;

  /** Clear working memory */
  clearWorkingMemory(): void;

  /** Set conversation history */
  setConversationHistory(messages: SerializedMessage[]): void;

  /** Get session ID */
  getSessionId(): string;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Create initial state
 */
function createInitialState(sessionId: string): AgentState {
  return {
    version: 1,
    sessionId,
    taskId: null,
    stepIndex: 0,
    plan: null,
    workingMemory: {},
    status: 'idle',
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// File-based Checkpoint Storage
// =============================================================================

/**
 * Create file-based checkpoint storage
 */
function createFileCheckpointStorage(basePath: string): CheckpointStorage {
  async function ensureDir(path: string): Promise<void> {
    try {
      await fs.mkdir(dirname(path), { recursive: true });
    } catch {
      // Directory may already exist
    }
  }

  return {
    async save(state: AgentState, name?: string): Promise<string> {
      const id = name ?? `checkpoint_${state.stepIndex}_${Date.now()}`;
      const filePath = join(basePath, `${id}.json`);

      await ensureDir(filePath);
      const serialized = JSON.stringify(state, null, 2);
      await fs.writeFile(filePath, serialized, 'utf-8');

      return id;
    },

    async load(checkpointId: string): Promise<AgentState> {
      const filePath = join(basePath, `${checkpointId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as AgentState;
    },

    async list(sessionId?: string): Promise<CheckpointInfo[]> {
      try {
        const files = await fs.readdir(basePath);
        const checkpoints: CheckpointInfo[] = [];

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = join(basePath, file);
          const stat = await fs.stat(filePath);
          const data = await fs.readFile(filePath, 'utf-8');
          const state = JSON.parse(data) as AgentState;

          // Filter by session if specified
          if (sessionId && state.sessionId !== sessionId) continue;

          checkpoints.push({
            id: file.replace('.json', ''),
            name: state.checkpointName,
            sessionId: state.sessionId,
            taskId: state.taskId ?? undefined,
            status: state.status,
            stepIndex: state.stepIndex,
            createdAt: state.updatedAt,
            sizeBytes: stat.size,
          });
        }

        return checkpoints.sort((a, b) => b.createdAt - a.createdAt);
      } catch {
        return [];
      }
    },

    async delete(checkpointId: string): Promise<void> {
      const filePath = join(basePath, `${checkpointId}.json`);
      await fs.unlink(filePath);
    },

    async deleteAll(sessionId: string): Promise<void> {
      const checkpoints = await this.list(sessionId);
      await Promise.all(checkpoints.map(cp => this.delete(cp.id)));
    },
  };
}

// =============================================================================
// State Machine Factory
// =============================================================================

/**
 * Create state machine instance
 */
export function createStateMachine(
  config: StateMachineConfig = {}
): StateMachineInstance {
  const mergedConfig = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config };
  const sessionId = config.sessionId ?? generateId();

  let currentState = createInitialState(sessionId);
  const subscribers = new Set<(state: AgentState) => void>();
  let checkpointCounter = 0;

  // Initialize checkpoint storage
  const checkpointStorage: CheckpointStorage | null =
    config.checkpointStorage ??
    (config.checkpointPath
      ? createFileCheckpointStorage(config.checkpointPath)
      : null);

  /**
   * Notify all subscribers of state change
   */
  function notifySubscribers(): void {
    subscribers.forEach(callback => {
      try {
        callback({ ...currentState });
      } catch (error) {
        console.error('State subscriber error:', error);
      }
    });
  }

  /**
   * Check if transition is valid from current state
   */
  function canTransition(event: StateTransition): boolean {
    const allowedTypes = VALID_TRANSITIONS[currentState.status];
    return allowedTypes?.includes(event.type) ?? false;
  }

  /**
   * Apply state transition
   */
  function applyTransition(event: StateTransition): AgentState {
    if (!canTransition(event)) {
      const error = new Error(
        `Invalid transition: ${event.type} from state ${currentState.status}`
      );
      mergedConfig.onError?.(error, currentState);
      throw error;
    }

    const newState: AgentState = {
      ...currentState,
      updatedAt: Date.now(),
    };

    switch (event.type) {
      case 'START':
        newState.status = 'planning';
        newState.workingMemory = { input: event.input };
        if (event.taskId) {
          newState.taskId = event.taskId;
        }
        break;

      case 'PLAN_CREATED':
        newState.status = 'executing';
        newState.plan = event.plan;
        newState.stepIndex = 0;
        break;

      case 'STEP_START':
        newState.workingMemory = {
          ...newState.workingMemory,
          currentStepId: event.stepId,
          stepStartTime: Date.now(),
        };
        if (newState.plan) {
          newState.plan = {
            ...newState.plan,
            currentStepId: event.stepId,
          };
        }
        break;

      case 'STEP_COMPLETE':
        newState.stepIndex++;
        newState.workingMemory = {
          ...newState.workingMemory,
          [`step_${event.stepId}_result`]: event.result,
          currentStepId: undefined,
          stepStartTime: undefined,
        };
        if (newState.plan) {
          newState.plan = {
            ...newState.plan,
            completedSteps: newState.plan.completedSteps + 1,
            currentStepId: undefined,
          };
        }
        break;

      case 'STEP_ERROR': {
        newState.status = 'error';
        const agentError: AgentError = {
          message: event.error.message,
          stepId: event.stepId,
          recoverable: true,
        };
        if (mergedConfig.debug && event.error.stack) {
          agentError.stack = event.error.stack;
        }
        newState.error = agentError;
        break;
      }

      case 'STEP_SKIP':
        newState.stepIndex++;
        newState.workingMemory = {
          ...newState.workingMemory,
          [`step_${event.stepId}_skipped`]: event.reason,
        };
        if (newState.plan) {
          newState.plan = {
            ...newState.plan,
            completedSteps: newState.plan.completedSteps + 1,
          };
        }
        break;

      case 'PAUSE':
        newState.status = 'paused';
        if (event.reason) {
          newState.workingMemory = {
            ...newState.workingMemory,
            pauseReason: event.reason,
          };
        }
        break;

      case 'RESUME':
        newState.status = 'executing';
        delete newState.workingMemory.pauseReason;
        break;

      case 'WAIT':
        newState.status = 'waiting';
        newState.workingMemory = {
          ...newState.workingMemory,
          waitReason: event.reason,
        };
        break;

      case 'INPUT_RECEIVED':
        newState.status = 'executing';
        newState.workingMemory = {
          ...newState.workingMemory,
          lastInput: event.input,
          waitReason: undefined,
        };
        break;

      case 'COMPLETE':
        newState.status = 'completed';
        newState.workingMemory = {
          ...newState.workingMemory,
          finalResult: event.result,
        };
        break;

      case 'ERROR': {
        newState.status = 'error';
        const err: AgentError = {
          message: event.error.message,
          recoverable: false,
        };
        if (mergedConfig.debug && event.error.stack) {
          err.stack = event.error.stack;
        }
        newState.error = err;
        break;
      }

      case 'RETRY':
        newState.status = 'executing';
        newState.retryCount = (newState.retryCount ?? 0) + 1;
        newState.error = null;
        newState.workingMemory = {
          ...newState.workingMemory,
          lastRetryReason: event.reason,
        };
        break;

      case 'RESET':
        return createInitialState(sessionId);
    }

    return newState;
  }

  /**
   * Save checkpoint if auto-checkpoint is enabled
   */
  async function autoSaveCheckpoint(): Promise<void> {
    if (!mergedConfig.autoCheckpoint || !checkpointStorage) return;
    if (currentState.stepIndex % (mergedConfig.checkpointInterval ?? 5) !== 0) return;

    try {
      await checkpointStorage.save(currentState);
    } catch (error) {
      console.error('Auto-checkpoint failed:', error);
    }
  }

  return {
    getState(): AgentState {
      return { ...currentState };
    },

    getStatus(): AgentStatus {
      return currentState.status;
    },

    transition(event: StateTransition): AgentState {
      currentState = applyTransition(event);
      mergedConfig.onStateChange?.(currentState, event);
      notifySubscribers();

      // Auto checkpoint (fire and forget)
      autoSaveCheckpoint().catch(() => {});

      return { ...currentState };
    },

    canTransition,

    pause(reason?: string): void {
      this.transition({ type: 'PAUSE', reason });
    },

    resume(): void {
      this.transition({ type: 'RESUME' });
    },

    reset(): void {
      this.transition({ type: 'RESET' });
    },

    async checkpoint(name?: string): Promise<string> {
      if (!checkpointStorage) {
        throw new Error('Checkpoint storage not configured');
      }

      const checkpointId = await checkpointStorage.save(
        { ...currentState, checkpointName: name },
        name ?? `checkpoint_${++checkpointCounter}_${Date.now()}`
      );

      return checkpointId;
    },

    async restore(checkpointId: string): Promise<AgentState> {
      if (!checkpointStorage) {
        throw new Error('Checkpoint storage not configured');
      }

      currentState = await checkpointStorage.load(checkpointId);
      currentState.checkpointName = checkpointId;
      currentState.updatedAt = Date.now();
      notifySubscribers();

      return { ...currentState };
    },

    async listCheckpoints(): Promise<CheckpointInfo[]> {
      if (!checkpointStorage) {
        return [];
      }
      return checkpointStorage.list(sessionId);
    },

    async deleteCheckpoint(checkpointId: string): Promise<void> {
      if (!checkpointStorage) {
        throw new Error('Checkpoint storage not configured');
      }
      await checkpointStorage.delete(checkpointId);
    },

    exportState(): string {
      return JSON.stringify(currentState, null, 2);
    },

    importState(serialized: string): AgentState {
      const imported = JSON.parse(serialized) as AgentState;

      // Version compatibility check
      if (imported.version !== currentState.version) {
        console.warn(
          `State version mismatch: expected ${currentState.version}, got ${imported.version}`
        );
      }

      currentState = {
        ...imported,
        updatedAt: Date.now(),
      };
      notifySubscribers();

      return { ...currentState };
    },

    subscribe(callback: (state: AgentState) => void): () => void {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },

    updateWorkingMemory(key: string, value: unknown): void {
      // Enforce max size
      const keys = Object.keys(currentState.workingMemory);
      if (
        keys.length >= (mergedConfig.maxWorkingMemorySize ?? 100) &&
        !keys.includes(key)
      ) {
        // Remove oldest entry (first key)
        const oldestKey = keys[0];
        delete currentState.workingMemory[oldestKey];
      }

      currentState.workingMemory[key] = value;
      currentState.updatedAt = Date.now();
    },

    getWorkingMemory<T = unknown>(key: string): T | undefined {
      return currentState.workingMemory[key] as T | undefined;
    },

    clearWorkingMemory(): void {
      currentState.workingMemory = {};
      currentState.updatedAt = Date.now();
    },

    setConversationHistory(messages: SerializedMessage[]): void {
      if (mergedConfig.includeConversationHistory) {
        currentState.conversationHistory = messages;
        currentState.updatedAt = Date.now();
      }
    },

    getSessionId(): string {
      return sessionId;
    },
  };
}
