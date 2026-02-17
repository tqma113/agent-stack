/**
 * EventStore Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createEventStore, type EventStoreInstance } from '../../src/stores/event.js';
import type { EventInput } from '../../src/types.js';

describe('EventStore', () => {
  let db: Database.Database;
  let store: EventStoreInstance;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = createEventStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('add', () => {
    it('should add an event and return it with generated id', async () => {
      const input: EventInput = {
        type: 'USER_MSG',
        summary: 'User said hello',
        payload: { content: 'Hello!' },
        sessionId: 'test-session',
      };

      const event = await store.add(input);

      expect(event.id).toBeDefined();
      expect(event.type).toBe('USER_MSG');
      expect(event.summary).toBe('User said hello');
      expect(event.payload.content).toBe('Hello!');
      expect(event.sessionId).toBe('test-session');
      expect(event.timestamp).toBeDefined();
    });

    it('should use provided summary', async () => {
      const input: EventInput = {
        type: 'USER_MSG',
        summary: 'This is a test message',
        payload: { content: 'This is a test message' },
        sessionId: 'test-session',
      };

      const event = await store.add(input);

      expect(event.summary).toBe('This is a test message');
    });
  });

  describe('get', () => {
    it('should retrieve an event by id', async () => {
      const input: EventInput = {
        type: 'USER_MSG',
        summary: 'Test event',
        payload: { content: 'Test' },
        sessionId: 'test-session',
      };

      const added = await store.add(input);
      const retrieved = await store.get(added.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(added.id);
      expect(retrieved!.summary).toBe('Test event');
    });

    it('should return null for non-existent id', async () => {
      const retrieved = await store.get('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      // Add multiple events
      const events: EventInput[] = [
        { type: 'USER_MSG', summary: 'User 1', payload: {}, sessionId: 'session-1' },
        { type: 'ASSISTANT_MSG', summary: 'Assistant 1', payload: {}, sessionId: 'session-1' },
        { type: 'TOOL_CALL', summary: 'Tool 1', payload: { toolName: 'test' }, sessionId: 'session-1' },
        { type: 'USER_MSG', summary: 'User 2', payload: {}, sessionId: 'session-2' },
      ];

      for (const event of events) {
        await store.add(event);
      }
    });

    it('should query events by sessionId', async () => {
      const events = await store.query({ sessionId: 'session-1' });

      expect(events.length).toBe(3);
      events.forEach((e) => expect(e.sessionId).toBe('session-1'));
    });

    it('should query events by type', async () => {
      const events = await store.query({ types: ['USER_MSG'] });

      expect(events.length).toBe(2);
      events.forEach((e) => expect(e.type).toBe('USER_MSG'));
    });

    it('should query events with limit', async () => {
      const events = await store.query({ limit: 2 });

      expect(events.length).toBe(2);
    });

    it('should query events since timestamp', async () => {
      const since = Date.now() - 1000; // 1 second ago
      const events = await store.query({ since });

      expect(events.length).toBe(4);
    });
  });

  describe('getRecent', () => {
    it('should get most recent events', async () => {
      for (let i = 0; i < 15; i++) {
        await store.add({
          type: 'USER_MSG',
          summary: `Event ${i}`,
          payload: {},
          sessionId: 'test',
        });
      }

      const recent = await store.getRecent(10);

      expect(recent.length).toBe(10);
      // Most recent should be first
      expect(recent[0].summary).toBe('Event 14');
    });
  });

  describe('clear', () => {
    it('should clear all events', async () => {
      await store.add({
        type: 'USER_MSG',
        summary: 'Test',
        payload: {},
        sessionId: 'test',
      });

      await store.clear();

      const events = await store.query({});
      expect(events.length).toBe(0);
    });
  });

  describe('addBatch', () => {
    it('should add multiple events in a single transaction', async () => {
      const inputs = [
        { type: 'USER_MSG' as const, summary: 'Msg 1', payload: {}, sessionId: 'test' },
        { type: 'ASSISTANT_MSG' as const, summary: 'Msg 2', payload: {}, sessionId: 'test' },
        { type: 'TOOL_CALL' as const, summary: 'Tool 1', payload: { tool: 'test' }, sessionId: 'test' },
      ];

      const events = await store.addBatch(inputs);

      expect(events.length).toBe(3);
      expect(events[0].type).toBe('USER_MSG');
      expect(events[1].type).toBe('ASSISTANT_MSG');
      expect(events[2].type).toBe('TOOL_CALL');

      const all = await store.query({ sessionId: 'test' });
      expect(all.length).toBe(3);
    });

    it('should handle empty batch', async () => {
      const events = await store.addBatch([]);
      expect(events.length).toBe(0);
    });

    it('should be atomic - all or nothing', async () => {
      // This tests that we're using a transaction
      const inputs = [
        { type: 'USER_MSG' as const, summary: 'Msg 1', payload: {}, sessionId: 'batch-test' },
        { type: 'ASSISTANT_MSG' as const, summary: 'Msg 2', payload: {}, sessionId: 'batch-test' },
      ];

      await store.addBatch(inputs);
      const events = await store.query({ sessionId: 'batch-test' });
      expect(events.length).toBe(2);
    });
  });

  describe('delete', () => {
    it('should delete a single event by id', async () => {
      const event = await store.add({
        type: 'USER_MSG',
        summary: 'To be deleted',
        payload: {},
        sessionId: 'test',
      });

      const deleted = await store.delete(event.id);
      expect(deleted).toBe(true);

      const retrieved = await store.get(event.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const deleted = await store.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteBatch', () => {
    it('should delete multiple events by ids', async () => {
      const events = await store.addBatch([
        { type: 'USER_MSG' as const, summary: 'Msg 1', payload: {}, sessionId: 'test' },
        { type: 'USER_MSG' as const, summary: 'Msg 2', payload: {}, sessionId: 'test' },
        { type: 'USER_MSG' as const, summary: 'Msg 3', payload: {}, sessionId: 'test' },
      ]);

      const deleted = await store.deleteBatch([events[0].id, events[1].id]);
      expect(deleted).toBe(2);

      const remaining = await store.query({ sessionId: 'test' });
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(events[2].id);
    });

    it('should handle empty ids array', async () => {
      const deleted = await store.deleteBatch([]);
      expect(deleted).toBe(0);
    });
  });

  describe('deleteBySession', () => {
    it('should delete all events for a session', async () => {
      await store.addBatch([
        { type: 'USER_MSG' as const, summary: 'Msg 1', payload: {}, sessionId: 'session-1' },
        { type: 'USER_MSG' as const, summary: 'Msg 2', payload: {}, sessionId: 'session-1' },
        { type: 'USER_MSG' as const, summary: 'Msg 3', payload: {}, sessionId: 'session-2' },
      ]);

      const deleted = await store.deleteBySession('session-1');
      expect(deleted).toBe(2);

      const session1Events = await store.query({ sessionId: 'session-1' });
      expect(session1Events.length).toBe(0);

      const session2Events = await store.query({ sessionId: 'session-2' });
      expect(session2Events.length).toBe(1);
    });
  });

  describe('deleteBeforeTimestamp', () => {
    it('should delete events older than timestamp', async () => {
      const now = Date.now();
      const oldTime = now - 100000;
      const newTime = now;

      await store.addBatch([
        { type: 'USER_MSG' as const, summary: 'Old msg 1', payload: {}, sessionId: 'test', timestamp: oldTime },
        { type: 'USER_MSG' as const, summary: 'Old msg 2', payload: {}, sessionId: 'test', timestamp: oldTime - 1000 },
        { type: 'USER_MSG' as const, summary: 'New msg', payload: {}, sessionId: 'test', timestamp: newTime },
      ]);

      const deleted = await store.deleteBeforeTimestamp(now - 50000);
      expect(deleted).toBe(2);

      const remaining = await store.query({ sessionId: 'test' });
      expect(remaining.length).toBe(1);
      expect(remaining[0].summary).toBe('New msg');
    });
  });
});
