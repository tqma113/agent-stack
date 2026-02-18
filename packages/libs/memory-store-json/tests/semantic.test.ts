import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createJsonSemanticStore } from '../src/stores/semantic.js';
import type { SemanticChunkInput } from '@ai-stack/memory-store-sqlite';

const TEST_BASE_PATH = path.join(process.cwd(), '.test-memory-semantic');

describe('JsonSemanticStore', () => {
  let store: ReturnType<typeof createJsonSemanticStore>;

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }

    store = createJsonSemanticStore({ basePath: TEST_BASE_PATH });
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(TEST_BASE_PATH)) {
      fs.rmSync(TEST_BASE_PATH, { recursive: true, force: true });
    }
  });

  const createTestChunk = (overrides: Partial<SemanticChunkInput> = {}): SemanticChunkInput => ({
    text: 'Test chunk content',
    tags: [],
    ...overrides,
  });

  it('should add and get a chunk', async () => {
    const input = createTestChunk({ text: 'Hello world from the test' });
    const chunk = await store.add(input);

    expect(chunk.id).toBeDefined();
    expect(chunk.timestamp).toBeDefined();
    expect(chunk.text).toBe('Hello world from the test');

    const retrieved = await store.get(chunk.id);
    expect(retrieved).toEqual(chunk);
  });

  it('should search chunks using FTS', async () => {
    await store.add(createTestChunk({ text: 'The quick brown fox jumps over the lazy dog' }));
    await store.add(createTestChunk({ text: 'Machine learning is transforming AI applications' }));
    await store.add(createTestChunk({ text: 'TypeScript is a great programming language' }));

    const results = await store.searchFts('fox');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.text).toContain('fox');
    expect(results[0].matchType).toBe('fts');

    const mlResults = await store.searchFts('learning AI');
    expect(mlResults).toHaveLength(1);
    expect(mlResults[0].chunk.text).toContain('learning');
  });

  it('should search chunks with relevance scoring', async () => {
    await store.add(createTestChunk({ text: 'JavaScript and TypeScript are programming languages' }));
    await store.add(createTestChunk({ text: 'TypeScript TypeScript TypeScript is popular' }));

    const results = await store.searchFts('TypeScript');
    expect(results).toHaveLength(2);
    // The chunk with more occurrences should score higher
    expect(results[0].chunk.text).toContain('TypeScript TypeScript');
  });

  it('should filter search by tags', async () => {
    await store.add(createTestChunk({ text: 'Frontend development', tags: ['frontend'] }));
    await store.add(createTestChunk({ text: 'Backend development', tags: ['backend'] }));
    await store.add(createTestChunk({ text: 'Full stack development', tags: ['frontend', 'backend'] }));

    const frontendResults = await store.searchFts('development', { tags: ['frontend'] });
    expect(frontendResults).toHaveLength(2);

    const backendOnly = await store.searchFts('development', { tags: ['backend'] });
    expect(backendOnly).toHaveLength(2);
  });

  it('should filter search by sessionId', async () => {
    await store.add(createTestChunk({ text: 'Session 1 content', sessionId: 'session1' }));
    await store.add(createTestChunk({ text: 'Session 2 content', sessionId: 'session2' }));

    const session1Results = await store.searchFts('content', { sessionId: 'session1' });
    expect(session1Results).toHaveLength(1);
    expect(session1Results[0].chunk.sessionId).toBe('session1');
  });

  it('should limit search results', async () => {
    await store.add(createTestChunk({ text: 'Test document one' }));
    await store.add(createTestChunk({ text: 'Test document two' }));
    await store.add(createTestChunk({ text: 'Test document three' }));

    const results = await store.searchFts('test document', { limit: 2 });
    expect(results).toHaveLength(2);
  });

  it('should delete chunks by session', async () => {
    await store.add(createTestChunk({ text: 'Session 1 chunk', sessionId: 'session1' }));
    await store.add(createTestChunk({ text: 'Session 2 chunk', sessionId: 'session2' }));

    const deleted = await store.deleteBySession('session1');
    expect(deleted).toBe(1);

    const results = await store.searchFts('chunk');
    expect(results).toHaveLength(1);
    expect(results[0].chunk.sessionId).toBe('session2');
  });

  it('should clear all chunks', async () => {
    await store.add(createTestChunk({ text: 'Chunk 1' }));
    await store.add(createTestChunk({ text: 'Chunk 2' }));

    await store.clear();

    const results = await store.searchFts('chunk');
    expect(results).toHaveLength(0);
  });

  it('should return empty array for vector search (not supported)', async () => {
    await store.add(createTestChunk({ text: 'Test content' }));

    const results = await store.searchVector([0.1, 0.2, 0.3]);
    expect(results).toHaveLength(0);
  });

  it('should handle search with no results', async () => {
    await store.add(createTestChunk({ text: 'Hello world' }));

    const results = await store.searchFts('nonexistent');
    expect(results).toHaveLength(0);
  });
});
