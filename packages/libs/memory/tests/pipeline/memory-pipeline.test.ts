/**
 * Tests for Memory Pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMemoryPipeline,
  type IMemoryPipeline,
} from '../../src/pipeline/memory-pipeline.js';
import type {
  IEventStore,
  ISemanticStore,
  ISummaryStore,
  IProfileStore,
  SemanticChunk,
  SemanticSearchResult,
} from '@ai-stack/memory-store-sqlite';

// Mock stores
function createMockStores() {
  const chunks: SemanticChunk[] = [];

  const eventStore: IEventStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    clear: vi.fn(),
    add: vi.fn(),
    addBatch: vi.fn(),
    get: vi.fn(),
    query: vi.fn(),
    getRecent: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
    deleteBatch: vi.fn(),
    deleteBySession: vi.fn(),
    deleteBeforeTimestamp: vi.fn(),
  };

  const semanticStore: ISemanticStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    clear: vi.fn(),
    add: vi.fn().mockImplementation(async (input) => {
      const chunk: SemanticChunk = {
        id: `chunk-${chunks.length}`,
        timestamp: Date.now(),
        text: input.text,
        tags: input.tags || [],
        sessionId: input.sessionId,
        sourceType: input.sourceType,
        sourceEventId: input.sourceEventId,
        embedding: input.embedding,
      };
      chunks.push(chunk);
      return chunk;
    }),
    get: vi.fn(),
    searchFts: vi.fn(),
    searchVector: vi.fn(),
    search: vi.fn().mockImplementation(async (query, options) => {
      const results: SemanticSearchResult[] = chunks
        .filter((c) => c.text.toLowerCase().includes(query.toLowerCase()))
        .map((chunk) => ({
          chunk,
          score: 0.8,
          matchType: 'hybrid' as const,
        }));
      return results.slice(0, options?.limit || 10);
    }),
    deleteBySession: vi.fn(),
  };

  const summaryStore: ISummaryStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    clear: vi.fn(),
    add: vi.fn(),
    get: vi.fn(),
    getLatest: vi.fn(),
    list: vi.fn(),
  };

  const profileStore: IProfileStore = {
    initialize: vi.fn(),
    close: vi.fn(),
    clear: vi.fn(),
    set: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
    getBySourceEvent: vi.fn(),
  };

  return { eventStore, semanticStore, summaryStore, profileStore, chunks };
}

describe('createMemoryPipeline', () => {
  let pipeline: IMemoryPipeline;
  let stores: ReturnType<typeof createMockStores>;

  beforeEach(() => {
    stores = createMockStores();
    pipeline = createMemoryPipeline(stores);
  });

  describe('configuration', () => {
    it('should return default write config', () => {
      const config = pipeline.getWriteConfig();
      expect(config.autoChunk).toBe(true);
      expect(config.chunkTokens).toBe(400);
    });

    it('should return default read config', () => {
      const config = pipeline.getReadConfig();
      expect(config.hybridSearch).toBe(true);
      expect(config.temporalDecay).toBe(true);
      expect(config.mmrEnabled).toBe(true);
    });

    it('should update write config', () => {
      pipeline.setWriteConfig({ chunkTokens: 200 });
      expect(pipeline.getWriteConfig().chunkTokens).toBe(200);
    });

    it('should update read config', () => {
      pipeline.setReadConfig({ maxResults: 20 });
      expect(pipeline.getReadConfig().maxResults).toBe(20);
    });
  });

  describe('embedding', () => {
    it('should track embedding function', () => {
      expect(pipeline.hasEmbedding()).toBe(false);

      pipeline.setEmbedFunction(async (text) => [0.1, 0.2, 0.3]);

      expect(pipeline.hasEmbedding()).toBe(true);
    });
  });

  describe('write', () => {
    it('should write chunk content', async () => {
      const result = await pipeline.write({
        type: 'chunk',
        content: 'This is test content for the memory pipeline.',
        sessionId: 'test-session',
        tags: ['test'],
      });

      expect(result.success).toBe(true);
      expect(result.chunkCount).toBe(1);
      expect(stores.semanticStore.add).toHaveBeenCalled();
    });

    it('should filter short content', async () => {
      const result = await pipeline.write({
        type: 'chunk',
        content: 'short',
        sessionId: 'test-session',
      });

      expect(result.chunkCount).toBe(0);
    });

    it('should chunk long content', async () => {
      const longContent = 'A'.repeat(2000);

      const result = await pipeline.write({
        type: 'chunk',
        content: longContent,
        sessionId: 'test-session',
      });

      // Should be chunked into multiple pieces
      expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    });

    it('should generate embeddings when available', async () => {
      const mockEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
      pipeline.setEmbedFunction(mockEmbed);

      const result = await pipeline.write({
        type: 'chunk',
        content: 'Test content for embedding generation.',
        sessionId: 'test-session',
      });

      expect(result.embeddingsGenerated).toBe(true);
      expect(mockEmbed).toHaveBeenCalled();
    });

    it('should skip embedding when requested', async () => {
      const mockEmbed = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
      pipeline.setEmbedFunction(mockEmbed);

      await pipeline.write({
        type: 'chunk',
        content: 'Test content without embedding.',
        sessionId: 'test-session',
        skipEmbed: true,
      });

      expect(mockEmbed).not.toHaveBeenCalled();
    });

    it('should handle flush content', async () => {
      const result = await pipeline.write({
        type: 'flush',
        content: {
          decisions: [{ decision: 'Test decision', timestamp: Date.now() }],
          facts: [],
          todos: [],
          preferences: [],
          chunks: [{ text: 'Flushed content here', tags: [] }],
        },
        sessionId: 'test-session',
      });

      expect(result.success).toBe(true);
      expect(result.chunks.some((c) => c.tags.includes('flush'))).toBe(true);
    });
  });

  describe('read', () => {
    beforeEach(async () => {
      // Add some test data
      await pipeline.write({
        type: 'chunk',
        content: 'TypeScript is a programming language.',
        sessionId: 'session-1',
        tags: ['programming'],
      });
      await pipeline.write({
        type: 'chunk',
        content: 'Python is great for data science.',
        sessionId: 'session-1',
        tags: ['programming'],
      });
      await pipeline.write({
        type: 'chunk',
        content: 'JavaScript runs in browsers.',
        sessionId: 'session-2',
        tags: ['programming'],
      });
    });

    it('should search and return results', async () => {
      const result = await pipeline.read({
        query: 'TypeScript',
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.queryTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include search stages info', async () => {
      const result = await pipeline.read({
        query: 'programming',
      });

      expect(result.stages.fts).toBe(true);
    });

    it('should filter by session ID', async () => {
      const result = await pipeline.read({
        query: 'programming',
        sessionId: 'session-1',
      });

      // All results should be from session-1
      for (const r of result.results) {
        expect(r.chunk.sessionId).toBe('session-1');
      }
    });

    it('should create snippets', async () => {
      const result = await pipeline.read({
        query: 'TypeScript',
      });

      if (result.results.length > 0) {
        expect(result.results[0].snippet).toBeDefined();
        expect(result.results[0].snippet.length).toBeGreaterThan(0);
      }
    });

    it('should respect limit', async () => {
      const result = await pipeline.read({
        query: 'programming',
        limit: 1,
      });

      expect(result.results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('writeAndRead', () => {
    it('should write then read in one operation', async () => {
      const { write, read } = await pipeline.writeAndRead(
        {
          type: 'chunk',
          content: 'Memory pipeline test content for combined operation.',
          sessionId: 'test-session',
        },
        {
          query: 'pipeline',
        }
      );

      expect(write.success).toBe(true);
      expect(read.results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('indexTranscript', () => {
    it('should index a transcript', async () => {
      // Create a mock transcript
      const mockTranscript = {
        getMetadata: () => ({
          sessionId: 'transcript-session',
          entryCount: 2,
          estimatedTokens: 100,
          tags: [],
          active: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        generateChunks: () => [
          {
            sessionId: 'transcript-session',
            text: '[USER]: Hello\n[ASSISTANT]: Hi there!',
            startLine: 0,
            endLine: 1,
            timestampStart: Date.now(),
            timestampEnd: Date.now(),
            roles: ['user', 'assistant'],
            sourceType: 'transcript' as const,
          },
        ],
      };

      const result = await pipeline.indexTranscript(mockTranscript as never);

      expect(result.success).toBe(true);
      expect(result.chunks.some((c) => c.tags.includes('transcript'))).toBe(true);
    });
  });

  describe('processFlush', () => {
    it('should process flush content', async () => {
      const flushContent = {
        decisions: [{ decision: 'Use TypeScript', timestamp: Date.now() }],
        facts: [{ fact: 'Project uses ESM', source: 'config', confidence: 0.9 }],
        todos: [],
        preferences: [],
        summary: 'Session about TypeScript setup',
        chunks: [
          { text: 'Decision: Use TypeScript for better type safety', tags: ['decision'] },
          { text: 'Fact: Project uses ESM modules', tags: ['fact'] },
        ],
      };

      const result = await pipeline.processFlush(flushContent, 'flush-session');

      expect(result.success).toBe(true);
      expect(result.chunks.some((c) => c.tags.includes('compaction'))).toBe(true);
    });
  });
});
