/**
 * @agent-stack/memory - Task State Reducer
 *
 * Immutable state updates for task management using reducer pattern.
 */

import type { TaskState, TaskStep, TaskConstraint, TaskStatus } from './types.js';

/**
 * Action types for task state updates
 */
export type TaskAction =
  | { type: 'SET_GOAL'; payload: string }
  | { type: 'SET_STATUS'; payload: TaskStatus }
  | { type: 'ADD_STEP'; payload: TaskStep }
  | { type: 'UPDATE_STEP'; payload: { id: string; updates: Partial<TaskStep> } }
  | { type: 'COMPLETE_STEP'; payload: { stepId: string; result?: string } }
  | { type: 'BLOCK_STEP'; payload: { stepId: string; reason: string } }
  | { type: 'UNBLOCK_STEP'; payload: string }
  | { type: 'ADD_CONSTRAINT'; payload: TaskConstraint }
  | { type: 'REMOVE_CONSTRAINT'; payload: string }
  | { type: 'SET_NEXT_ACTION'; payload: string | undefined }
  | { type: 'RESET_PROGRESS' }
  | { type: 'BATCH'; payload: TaskAction[] };

/**
 * Reducer result with optional side effects
 */
export interface ReducerResult {
  state: TaskState;
  shouldSnapshot: boolean;
  actionId?: string;
}

/**
 * Task state reducer class for immutable updates
 */
export class TaskStateReducer {
  /**
   * Apply an action to the task state
   */
  reduce(state: TaskState, action: TaskAction): ReducerResult {
    let shouldSnapshot = false;

    switch (action.type) {
      case 'SET_GOAL':
        return {
          state: { ...state, goal: action.payload },
          shouldSnapshot: true,
        };

      case 'SET_STATUS':
        return {
          state: { ...state, status: action.payload },
          shouldSnapshot: action.payload === 'completed' || action.payload === 'cancelled',
        };

      case 'ADD_STEP':
        return {
          state: {
            ...state,
            plan: [...state.plan, action.payload],
          },
          shouldSnapshot: false,
        };

      case 'UPDATE_STEP':
        return {
          state: {
            ...state,
            plan: state.plan.map((step) =>
              step.id === action.payload.id
                ? { ...step, ...action.payload.updates }
                : step
            ),
          },
          shouldSnapshot: false,
        };

      case 'COMPLETE_STEP': {
        const { stepId, result } = action.payload;
        const step = state.plan.find((s) => s.id === stepId);

        if (!step) {
          return { state, shouldSnapshot: false };
        }

        // Update plan with completed status
        const updatedPlan = state.plan.map((s) =>
          s.id === stepId
            ? { ...s, status: 'completed' as const, result }
            : s
        );

        // Add to done list if not already there
        const updatedDone = state.done.includes(stepId)
          ? state.done
          : [...state.done, stepId];

        // Remove from blocked if present
        const updatedBlocked = state.blocked.filter((b) => b !== stepId);

        // Find next pending step
        const nextStep = updatedPlan.find(
          (s) => s.status === 'pending' && !updatedBlocked.includes(s.id)
        );

        return {
          state: {
            ...state,
            plan: updatedPlan,
            done: updatedDone,
            blocked: updatedBlocked,
            nextAction: nextStep?.description,
          },
          shouldSnapshot: true,
          actionId: `complete-${stepId}-${Date.now()}`,
        };
      }

      case 'BLOCK_STEP': {
        const { stepId, reason } = action.payload;

        // Update plan with blocked status
        const updatedPlan = state.plan.map((s) =>
          s.id === stepId
            ? { ...s, status: 'blocked' as const, blockedBy: reason }
            : s
        );

        // Add to blocked list if not already there
        const updatedBlocked = state.blocked.includes(stepId)
          ? state.blocked
          : [...state.blocked, stepId];

        // Find next non-blocked pending step
        const nextStep = updatedPlan.find(
          (s) => s.status === 'pending' && !updatedBlocked.includes(s.id)
        );

        return {
          state: {
            ...state,
            plan: updatedPlan,
            blocked: updatedBlocked,
            nextAction: nextStep?.description,
          },
          shouldSnapshot: true,
          actionId: `block-${stepId}-${Date.now()}`,
        };
      }

      case 'UNBLOCK_STEP': {
        const stepId = action.payload;

        // Update plan with pending status
        const updatedPlan = state.plan.map((s) =>
          s.id === stepId
            ? { ...s, status: 'pending' as const, blockedBy: undefined }
            : s
        );

        // Remove from blocked list
        const updatedBlocked = state.blocked.filter((b) => b !== stepId);

        return {
          state: {
            ...state,
            plan: updatedPlan,
            blocked: updatedBlocked,
          },
          shouldSnapshot: false,
        };
      }

      case 'ADD_CONSTRAINT':
        return {
          state: {
            ...state,
            constraints: [...state.constraints, action.payload],
          },
          shouldSnapshot: false,
        };

      case 'REMOVE_CONSTRAINT':
        return {
          state: {
            ...state,
            constraints: state.constraints.filter((c) => c.id !== action.payload),
          },
          shouldSnapshot: false,
        };

      case 'SET_NEXT_ACTION':
        return {
          state: {
            ...state,
            nextAction: action.payload,
          },
          shouldSnapshot: false,
        };

      case 'RESET_PROGRESS':
        return {
          state: {
            ...state,
            done: [],
            blocked: [],
            plan: state.plan.map((s) => ({ ...s, status: 'pending' as const })),
            status: 'pending',
          },
          shouldSnapshot: true,
        };

      case 'BATCH': {
        let currentState = state;
        let anyShouldSnapshot = false;
        let lastActionId: string | undefined;

        for (const batchAction of action.payload) {
          const result = this.reduce(currentState, batchAction);
          currentState = result.state;
          if (result.shouldSnapshot) anyShouldSnapshot = true;
          if (result.actionId) lastActionId = result.actionId;
        }

        return {
          state: currentState,
          shouldSnapshot: anyShouldSnapshot,
          actionId: lastActionId,
        };
      }

      default:
        return { state, shouldSnapshot: false };
    }
  }

  /**
   * Create a step ID
   */
  createStepId(): string {
    return `step-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a constraint ID
   */
  createConstraintId(): string {
    return `constraint-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Check if all steps are completed
   */
  isCompleted(state: TaskState): boolean {
    return (
      state.plan.length > 0 &&
      state.plan.every((step) => state.done.includes(step.id))
    );
  }

  /**
   * Get progress percentage
   */
  getProgress(state: TaskState): number {
    if (state.plan.length === 0) return 0;
    return Math.round((state.done.length / state.plan.length) * 100);
  }

  /**
   * Get next actionable step
   */
  getNextStep(state: TaskState): TaskStep | null {
    return (
      state.plan.find(
        (step) =>
          step.status === 'pending' &&
          !state.blocked.includes(step.id) &&
          !state.done.includes(step.id)
      ) || null
    );
  }

  /**
   * Get all blocked steps
   */
  getBlockedSteps(state: TaskState): TaskStep[] {
    return state.plan.filter((step) => state.blocked.includes(step.id));
  }

  /**
   * Validate state consistency
   */
  validate(state: TaskState): string[] {
    const errors: string[] = [];

    // Check done steps exist in plan
    for (const doneId of state.done) {
      if (!state.plan.some((s) => s.id === doneId)) {
        errors.push(`Done step "${doneId}" not found in plan`);
      }
    }

    // Check blocked steps exist in plan
    for (const blockedId of state.blocked) {
      if (!state.plan.some((s) => s.id === blockedId)) {
        errors.push(`Blocked step "${blockedId}" not found in plan`);
      }
    }

    // Check for duplicate step IDs
    const stepIds = state.plan.map((s) => s.id);
    const duplicates = stepIds.filter((id, i) => stepIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate step IDs: ${duplicates.join(', ')}`);
    }

    return errors;
  }
}

/**
 * Helper functions for creating actions
 */
export const TaskActions = {
  setGoal: (goal: string): TaskAction => ({
    type: 'SET_GOAL',
    payload: goal,
  }),

  setStatus: (status: TaskStatus): TaskAction => ({
    type: 'SET_STATUS',
    payload: status,
  }),

  addStep: (step: TaskStep): TaskAction => ({
    type: 'ADD_STEP',
    payload: step,
  }),

  updateStep: (id: string, updates: Partial<TaskStep>): TaskAction => ({
    type: 'UPDATE_STEP',
    payload: { id, updates },
  }),

  completeStep: (stepId: string, result?: string): TaskAction => ({
    type: 'COMPLETE_STEP',
    payload: { stepId, result },
  }),

  blockStep: (stepId: string, reason: string): TaskAction => ({
    type: 'BLOCK_STEP',
    payload: { stepId, reason },
  }),

  unblockStep: (stepId: string): TaskAction => ({
    type: 'UNBLOCK_STEP',
    payload: stepId,
  }),

  addConstraint: (constraint: TaskConstraint): TaskAction => ({
    type: 'ADD_CONSTRAINT',
    payload: constraint,
  }),

  removeConstraint: (constraintId: string): TaskAction => ({
    type: 'REMOVE_CONSTRAINT',
    payload: constraintId,
  }),

  setNextAction: (action?: string): TaskAction => ({
    type: 'SET_NEXT_ACTION',
    payload: action,
  }),

  resetProgress: (): TaskAction => ({
    type: 'RESET_PROGRESS',
  }),

  batch: (...actions: TaskAction[]): TaskAction => ({
    type: 'BATCH',
    payload: actions,
  }),
};
