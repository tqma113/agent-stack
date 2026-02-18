/**
 * TaskStateStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTaskStateStore, type TaskStateStoreInstance } from '../../src/stores/task-state.js';
import { TaskStateConflictError } from '../../src/errors.js';
import type { TaskState } from '../../src/types.js';
// Note: This file was moved from @ai-stack/memory to @ai-stack/memory-store-sqlite

describe('TaskStateStore', () => {
  let db: Database.Database;
  let store: TaskStateStoreInstance;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = createTaskStateStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('create', () => {
    it('should create a task with generated id and version 1', async () => {
      const task = await store.create({
        goal: 'Implement feature X',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'test-session',
      });

      expect(task.id).toBeDefined();
      expect(task.version).toBe(1);
      expect(task.goal).toBe('Implement feature X');
      expect(task.status).toBe('pending');
    });

    it('should mark new task as current', async () => {
      const task = await store.create({
        goal: 'Test task',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'test-session',
      });

      const current = await store.getCurrent('test-session');
      expect(current).not.toBeNull();
      expect(current!.id).toBe(task.id);
    });
  });

  describe('update', () => {
    let task: TaskState;

    beforeEach(async () => {
      task = await store.create({
        goal: 'Test task',
        status: 'pending',
        constraints: [],
        plan: [
          { id: 'step-1', description: 'Step 1', status: 'pending' },
          { id: 'step-2', description: 'Step 2', status: 'pending' },
        ],
        done: [],
        blocked: [],
        sessionId: 'test-session',
      });
    });

    it('should update task and increment version', async () => {
      const updated = await store.update(task.id, {
        status: 'in_progress',
      });

      expect(updated.version).toBe(2);
      expect(updated.status).toBe('in_progress');
    });

    it('should support idempotent updates with actionId', async () => {
      const actionId = 'complete-step-1';

      // First update
      const update1 = await store.update(task.id, {
        done: ['step-1'],
        actionId,
      });
      expect(update1.done).toContain('step-1');
      const version1 = update1.version;

      // Second update with same actionId should be idempotent
      const update2 = await store.update(task.id, {
        done: ['step-1'],
        actionId,
      });
      expect(update2.version).toBe(version1); // Version should NOT increment
    });

    it('should create snapshot before update', async () => {
      await store.update(task.id, { status: 'in_progress' });

      const snapshots = await store.getSnapshots(task.id);
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].version).toBe(1);
    });
  });

  describe('rollback', () => {
    it('should rollback to previous version', async () => {
      const task = await store.create({
        goal: 'Test task',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'test-session',
      });

      // Make some updates
      await store.update(task.id, { status: 'in_progress' });
      await store.update(task.id, { status: 'completed' });

      // Rollback to version 1
      const rolledBack = await store.rollback(task.id, 1);

      expect(rolledBack.status).toBe('pending');
      expect(rolledBack.version).toBe(4); // New version after rollback
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.create({
        goal: 'Task 1',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'session-1',
      });
      await store.create({
        goal: 'Task 2',
        status: 'in_progress',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'session-1',
      });
      await store.create({
        goal: 'Task 3',
        status: 'completed',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: 'session-2',
      });
    });

    it('should list tasks by sessionId', async () => {
      const tasks = await store.list({ sessionId: 'session-1' });

      expect(tasks.length).toBe(2);
      tasks.forEach((t) => expect(t.sessionId).toBe('session-1'));
    });

    it('should list tasks by status', async () => {
      const tasks = await store.list({ status: ['in_progress', 'pending'] });

      expect(tasks.length).toBe(2);
    });

    it('should limit results', async () => {
      const tasks = await store.list({ limit: 1 });

      expect(tasks.length).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all tasks and snapshots', async () => {
      await store.create({
        goal: 'Test',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
      });

      await store.clear();

      const tasks = await store.list({});
      expect(tasks.length).toBe(0);
    });
  });
});
