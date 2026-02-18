import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createJsonEventStore } from '../src/stores/event.js';
import type { EventInput } from '@ai-stack/memory-store-sqlite';

const TEST_BASE_PATH = path.join(process.cwd(), '.test-memory-event');

describe('JsonEventStore', () => {
  let store: ReturnType<typeof createJsonEventStore>;

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }

    store = createJsonEventStore({ basePath: TEST_BASE_PATH });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }
  });

  const createTestEvent = (overrides: Partial<EventInput> = {}): EventInput => ({
    type: 'USER_MSG',
    summary: 'Test event',
    payload: { content: 'Hello' },
    entities: [],
    links: [],
    tags: [],
    ...overrides,
  });

  it('should add and get an event', async () => {
    const input = createTestEvent({ summary: 'Test summary' });
    const event = await store.add(input);

    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.summary).toBe('Test summary');
    expect(event.type).toBe('USER_MSG');

    const retrieved = await store.get(event.id);
    expect(retrieved).toEqual(event);
  });

  it('should add batch events', async () => {
    const inputs = [
      createTestEvent({ summary: 'Event 1', sessionId: 'session1' }),
      createTestEvent({ summary: 'Event 2', sessionId: 'session1' }),
      createTestEvent({ summary: 'Event 3', sessionId: 'session2' }),
    ];

    const events = await store.addBatch(inputs);

    expect(events).toHaveLength(3);
    expect(events[0].summary).toBe('Event 1');
    expect(events[1].summary).toBe('Event 2');
    expect(events[2].summary).toBe('Event 3');

    const count = await store.count();
    expect(count).toBe(3);
  });

  it('should query events by session', async () => {
    await store.addBatch([
      createTestEvent({ summary: 'Event 1', sessionId: 'session1' }),
      createTestEvent({ summary: 'Event 2', sessionId: 'session1' }),
      createTestEvent({ summary: 'Event 3', sessionId: 'session2' }),
    ]);

    const session1Events = await store.query({ sessionId: 'session1' });
    expect(session1Events).toHaveLength(2);

    const session2Events = await store.query({ sessionId: 'session2' });
    expect(session2Events).toHaveLength(1);
  });

  it('should query events by type', async () => {
    await store.addBatch([
      createTestEvent({ type: 'USER_MSG' }),
      createTestEvent({ type: 'ASSISTANT_MSG' }),
      createTestEvent({ type: 'TOOL_CALL' }),
    ]);

    const userMsgs = await store.query({ types: ['USER_MSG'] });
    expect(userMsgs).toHaveLength(1);

    const allMsgs = await store.query({ types: ['USER_MSG', 'ASSISTANT_MSG'] });
    expect(allMsgs).toHaveLength(2);
  });

  it('should query events with limit and offset', async () => {
    await store.addBatch([
      createTestEvent({ summary: 'Event 1' }),
      createTestEvent({ summary: 'Event 2' }),
      createTestEvent({ summary: 'Event 3' }),
      createTestEvent({ summary: 'Event 4' }),
    ]);

    const limited = await store.query({ limit: 2 });
    expect(limited).toHaveLength(2);

    const withOffset = await store.query({ limit: 2, offset: 2 });
    expect(withOffset).toHaveLength(2);
  });

  it('should delete event by id', async () => {
    const event = await store.add(createTestEvent());
    expect(await store.get(event.id)).not.toBeNull();

    const deleted = await store.delete(event.id);
    expect(deleted).toBe(true);
    expect(await store.get(event.id)).toBeNull();
  });

  it('should delete events by session', async () => {
    await store.addBatch([
      createTestEvent({ sessionId: 'session1' }),
      createTestEvent({ sessionId: 'session1' }),
      createTestEvent({ sessionId: 'session2' }),
    ]);

    const deleted = await store.deleteBySession('session1');
    expect(deleted).toBe(2);

    const remaining = await store.count();
    expect(remaining).toBe(1);
  });

  it('should clear all events', async () => {
    await store.addBatch([
      createTestEvent({ sessionId: 'session1' }),
      createTestEvent({ sessionId: 'session2' }),
    ]);

    expect(await store.count()).toBe(2);

    await store.clear();
    expect(await store.count()).toBe(0);
  });

  it('should get recent events', async () => {
    await store.addBatch([
      createTestEvent({ summary: 'Old', sessionId: 'session1' }),
      createTestEvent({ summary: 'New', sessionId: 'session1' }),
    ]);

    const recent = await store.getRecent(1, 'session1');
    expect(recent).toHaveLength(1);
  });
});
