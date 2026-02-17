/**
 * TaskStateReducer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskStateReducer, TaskActions } from '../src/state-reducer.js';
import type { TaskState } from '../src/types.js';

describe('TaskStateReducer', () => {
  let reducer: TaskStateReducer;
  let initialState: TaskState;

  beforeEach(() => {
    reducer = new TaskStateReducer();
    initialState = {
      id: 'task-1',
      goal: 'Implement feature X',
      status: 'pending',
      constraints: [],
      plan: [
        { id: 'step-1', description: 'Step 1', status: 'pending' },
        { id: 'step-2', description: 'Step 2', status: 'pending' },
        { id: 'step-3', description: 'Step 3', status: 'pending' },
      ],
      done: [],
      blocked: [],
      updatedAt: Date.now(),
      version: 1,
    };
  });

  describe('SET_GOAL', () => {
    it('should update goal and trigger snapshot', () => {
      const result = reducer.reduce(initialState, TaskActions.setGoal('New goal'));

      expect(result.state.goal).toBe('New goal');
      expect(result.shouldSnapshot).toBe(true);
    });
  });

  describe('SET_STATUS', () => {
    it('should update status', () => {
      const result = reducer.reduce(initialState, TaskActions.setStatus('in_progress'));

      expect(result.state.status).toBe('in_progress');
    });

    it('should trigger snapshot for completed status', () => {
      const result = reducer.reduce(initialState, TaskActions.setStatus('completed'));

      expect(result.shouldSnapshot).toBe(true);
    });
  });

  describe('ADD_STEP', () => {
    it('should add a new step to plan', () => {
      const newStep = {
        id: 'step-4',
        description: 'Step 4',
        status: 'pending' as const,
      };

      const result = reducer.reduce(initialState, TaskActions.addStep(newStep));

      expect(result.state.plan.length).toBe(4);
      expect(result.state.plan[3].id).toBe('step-4');
    });
  });

  describe('UPDATE_STEP', () => {
    it('should update specific step', () => {
      const result = reducer.reduce(
        initialState,
        TaskActions.updateStep('step-1', { description: 'Updated Step 1' })
      );

      expect(result.state.plan[0].description).toBe('Updated Step 1');
      expect(result.state.plan[1].description).toBe('Step 2'); // Others unchanged
    });
  });

  describe('COMPLETE_STEP', () => {
    it('should mark step as completed', () => {
      const result = reducer.reduce(
        initialState,
        TaskActions.completeStep('step-1', 'Done successfully')
      );

      expect(result.state.plan[0].status).toBe('completed');
      expect(result.state.plan[0].result).toBe('Done successfully');
      expect(result.state.done).toContain('step-1');
    });

    it('should set next action to next pending step', () => {
      const result = reducer.reduce(initialState, TaskActions.completeStep('step-1'));

      expect(result.state.nextAction).toBe('Step 2');
    });

    it('should generate actionId', () => {
      const result = reducer.reduce(initialState, TaskActions.completeStep('step-1'));

      expect(result.actionId).toBeDefined();
      expect(result.actionId).toContain('complete-step-1');
    });

    it('should trigger snapshot', () => {
      const result = reducer.reduce(initialState, TaskActions.completeStep('step-1'));

      expect(result.shouldSnapshot).toBe(true);
    });
  });

  describe('BLOCK_STEP', () => {
    it('should mark step as blocked', () => {
      const result = reducer.reduce(
        initialState,
        TaskActions.blockStep('step-2', 'Waiting for API')
      );

      expect(result.state.plan[1].status).toBe('blocked');
      expect(result.state.plan[1].blockedBy).toBe('Waiting for API');
      expect(result.state.blocked).toContain('step-2');
    });

    it('should skip blocked step in nextAction', () => {
      // Block step 1
      const result1 = reducer.reduce(
        initialState,
        TaskActions.blockStep('step-1', 'Blocked')
      );

      // Next action should be step 2
      expect(result1.state.nextAction).toBe('Step 2');
    });
  });

  describe('UNBLOCK_STEP', () => {
    it('should unblock a blocked step', () => {
      // First block
      let state = reducer.reduce(
        initialState,
        TaskActions.blockStep('step-1', 'Blocked')
      ).state;

      // Then unblock
      const result = reducer.reduce(state, TaskActions.unblockStep('step-1'));

      expect(result.state.plan[0].status).toBe('pending');
      expect(result.state.plan[0].blockedBy).toBeUndefined();
      expect(result.state.blocked).not.toContain('step-1');
    });
  });

  describe('ADD_CONSTRAINT', () => {
    it('should add a constraint', () => {
      const constraint = {
        id: 'c-1',
        type: 'must' as const,
        description: 'Must use TypeScript',
      };

      const result = reducer.reduce(initialState, TaskActions.addConstraint(constraint));

      expect(result.state.constraints.length).toBe(1);
      expect(result.state.constraints[0].description).toBe('Must use TypeScript');
    });
  });

  describe('REMOVE_CONSTRAINT', () => {
    it('should remove a constraint by id', () => {
      // Add constraint first
      const state = reducer.reduce(
        initialState,
        TaskActions.addConstraint({
          id: 'c-1',
          type: 'must',
          description: 'Test constraint',
        })
      ).state;

      // Remove it
      const result = reducer.reduce(state, TaskActions.removeConstraint('c-1'));

      expect(result.state.constraints.length).toBe(0);
    });
  });

  describe('RESET_PROGRESS', () => {
    it('should reset all progress', () => {
      // Complete some steps first
      let state = reducer.reduce(initialState, TaskActions.completeStep('step-1')).state;
      state = reducer.reduce(state, TaskActions.completeStep('step-2')).state;

      // Reset
      const result = reducer.reduce(state, TaskActions.resetProgress());

      expect(result.state.done.length).toBe(0);
      expect(result.state.blocked.length).toBe(0);
      expect(result.state.status).toBe('pending');
      expect(result.state.plan.every((s) => s.status === 'pending')).toBe(true);
    });
  });

  describe('BATCH', () => {
    it('should apply multiple actions', () => {
      const result = reducer.reduce(
        initialState,
        TaskActions.batch(
          TaskActions.setStatus('in_progress'),
          TaskActions.completeStep('step-1')
        )
      );

      expect(result.state.status).toBe('in_progress');
      expect(result.state.done).toContain('step-1');
    });
  });

  describe('Helper Methods', () => {
    describe('isCompleted', () => {
      it('should return false when not all steps done', () => {
        expect(reducer.isCompleted(initialState)).toBe(false);
      });

      it('should return true when all steps done', () => {
        const state = {
          ...initialState,
          done: ['step-1', 'step-2', 'step-3'],
        };
        expect(reducer.isCompleted(state)).toBe(true);
      });
    });

    describe('getProgress', () => {
      it('should return correct percentage', () => {
        expect(reducer.getProgress(initialState)).toBe(0);

        const oneThird = { ...initialState, done: ['step-1'] };
        expect(reducer.getProgress(oneThird)).toBe(33);

        const twoThirds = { ...initialState, done: ['step-1', 'step-2'] };
        expect(reducer.getProgress(twoThirds)).toBe(67);

        const complete = { ...initialState, done: ['step-1', 'step-2', 'step-3'] };
        expect(reducer.getProgress(complete)).toBe(100);
      });
    });

    describe('getNextStep', () => {
      it('should return first pending step', () => {
        const next = reducer.getNextStep(initialState);
        expect(next).not.toBeNull();
        expect(next!.id).toBe('step-1');
      });

      it('should skip blocked and done steps', () => {
        const state = {
          ...initialState,
          done: ['step-1'],
          blocked: ['step-2'],
        };

        const next = reducer.getNextStep(state);
        expect(next!.id).toBe('step-3');
      });

      it('should return null when no pending steps', () => {
        const state = {
          ...initialState,
          done: ['step-1', 'step-2', 'step-3'],
        };

        expect(reducer.getNextStep(state)).toBeNull();
      });
    });

    describe('validate', () => {
      it('should return no errors for valid state', () => {
        const errors = reducer.validate(initialState);
        expect(errors.length).toBe(0);
      });

      it('should detect invalid done references', () => {
        const state = {
          ...initialState,
          done: ['non-existent-step'],
        };

        const errors = reducer.validate(state);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('non-existent-step');
      });

      it('should detect duplicate step IDs', () => {
        const state = {
          ...initialState,
          plan: [
            { id: 'step-1', description: 'Step 1', status: 'pending' as const },
            { id: 'step-1', description: 'Duplicate', status: 'pending' as const },
          ],
        };

        const errors = reducer.validate(state);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0]).toContain('Duplicate');
      });
    });
  });
});
