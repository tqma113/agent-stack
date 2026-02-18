import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createJsonStores } from '../src/factory.js';
import type { MemoryStores } from '../src/factory.js';

const TEST_BASE_PATH = path.join(process.cwd(), '.test-memory-factory');

describe('createJsonStores', () => {
  let stores: MemoryStores;

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }

    stores = await createJsonStores({ basePath: TEST_BASE_PATH });
    await stores.initialize();
  });

  afterEach(async () => {
    await stores.close();
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }
  });

  it('should create all stores', () => {
    expect(stores.eventStore).toBeDefined();
    expect(stores.taskStateStore).toBeDefined();
    expect(stores.summaryStore).toBeDefined();
    expect(stores.profileStore).toBeDefined();
    expect(stores.semanticStore).toBeDefined();
  });

  it('should add and query events', async () => {
    const event = await stores.eventStore.add({
      type: 'USER_MSG',
      summary: 'Test event',
      payload: { content: 'Hello' },
      entities: [],
      links: [],
      tags: [],
    });

    expect(event.id).toBeDefined();

    const retrieved = await stores.eventStore.get(event.id);
    expect(retrieved).toEqual(event);
  });

  it('should create and get tasks', async () => {
    const task = await stores.taskStateStore.create({
      goal: 'Test task',
      status: 'pending',
      constraints: [],
      plan: [],
      done: [],
      blocked: [],
    });

    expect(task.id).toBeDefined();
    expect(task.version).toBe(1);

    const retrieved = await stores.taskStateStore.get(task.id);
    expect(retrieved).toEqual(task);
  });

  it('should add and get summaries', async () => {
    const summary = await stores.summaryStore.add({
      sessionId: 'session1',
      short: 'Test summary',
      bullets: ['Point 1', 'Point 2'],
      decisions: [],
      todos: [],
      coveredEventIds: [],
    });

    expect(summary.id).toBeDefined();

    const latest = await stores.summaryStore.getLatest('session1');
    expect(latest).toEqual(summary);
  });

  it('should set and get profiles', async () => {
    const profile = await stores.profileStore.set({
      key: 'language',
      value: 'en',
      confidence: 0.9,
      explicit: true,
    });

    expect(profile.updatedAt).toBeDefined();

    const retrieved = await stores.profileStore.get('language');
    expect(retrieved).toEqual(profile);
  });

  it('should add and search semantic chunks', async () => {
    await stores.semanticStore.add({
      text: 'TypeScript is a programming language',
      tags: ['programming'],
    });

    const results = await stores.semanticStore.search('TypeScript');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.text).toContain('TypeScript');
  });

  it('should clear all stores', async () => {
    await stores.eventStore.add({
      type: 'USER_MSG',
      summary: 'Test',
      payload: {},
      entities: [],
      links: [],
      tags: [],
    });
    await stores.profileStore.set({
      key: 'test',
      value: 'value',
      confidence: 1,
      explicit: true,
    });

    await stores.clear();

    expect(await stores.eventStore.count()).toBe(0);
    expect(await stores.profileStore.getAll()).toHaveLength(0);
  });
});
