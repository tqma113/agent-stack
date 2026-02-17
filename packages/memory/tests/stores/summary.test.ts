/**
 * SummaryStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SummaryStore } from '../../src/stores/summary.js';

describe('SummaryStore', () => {
  let db: Database.Database;
  let store: SummaryStore;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = new SummaryStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('add', () => {
    it('should add a summary with generated id', async () => {
      const summary = await store.add({
        sessionId: 'test-session',
        short: 'Test session summary',
        bullets: ['Point 1', 'Point 2'],
        decisions: [{ description: 'Decision 1', timestamp: Date.now() }],
        todos: [{ description: 'Todo 1', completed: false }],
        coveredEventIds: ['event-1', 'event-2'],
      });

      expect(summary.id).toBeDefined();
      expect(summary.timestamp).toBeDefined();
      expect(summary.sessionId).toBe('test-session');
      expect(summary.short).toBe('Test session summary');
      expect(summary.bullets.length).toBe(2);
      expect(summary.decisions.length).toBe(1);
      expect(summary.todos.length).toBe(1);
    });
  });

  describe('get', () => {
    it('should retrieve a summary by id', async () => {
      const added = await store.add({
        sessionId: 'test-session',
        short: 'Test',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });

      const retrieved = await store.get(added.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(added.id);
    });

    it('should return null for non-existent id', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getLatest', () => {
    it('should get the most recent summary for a session', async () => {
      await store.add({
        sessionId: 'test-session',
        short: 'First summary',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });

      await new Promise((r) => setTimeout(r, 10)); // Small delay

      await store.add({
        sessionId: 'test-session',
        short: 'Second summary',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });

      const latest = await store.getLatest('test-session');

      expect(latest).not.toBeNull();
      expect(latest!.short).toBe('Second summary');
    });

    it('should return null for session without summaries', async () => {
      const latest = await store.getLatest('non-existent-session');
      expect(latest).toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await store.add({
        sessionId: 'session-1',
        short: 'Summary 1',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });
      await store.add({
        sessionId: 'session-1',
        short: 'Summary 2',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });
      await store.add({
        sessionId: 'session-2',
        short: 'Summary 3',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });
    });

    it('should list summaries by sessionId', async () => {
      const summaries = await store.list({ sessionId: 'session-1' });

      expect(summaries.length).toBe(2);
      summaries.forEach((s) => expect(s.sessionId).toBe('session-1'));
    });

    it('should limit results', async () => {
      const summaries = await store.list({ limit: 1 });

      expect(summaries.length).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all summaries', async () => {
      await store.add({
        sessionId: 'test',
        short: 'Test',
        bullets: [],
        decisions: [],
        todos: [],
        coveredEventIds: [],
      });

      await store.clear();

      const summaries = await store.list({});
      expect(summaries.length).toBe(0);
    });
  });
});
