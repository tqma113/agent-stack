/**
 * Tests for Transcript Indexer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTranscriptIndexer,
  createDebouncer,
  type ITranscriptIndexer,
} from '../../src/transcript/transcript-indexer.js';
import { createSessionTranscript, type ISessionTranscript } from '../../src/transcript/session-transcript.js';
import type { ISemanticStore, SemanticChunk, SemanticSearchResult } from '@agent-stack/memory-store-sqlite';

// Mock semantic store
function createMockSemanticStore(): ISemanticStore & { _chunks: SemanticChunk[] } {
  const chunks: SemanticChunk[] = [];

  return {
    _chunks: chunks,
    initialize: vi.fn(),
    close: vi.fn(),
    clear: vi.fn(),

    add: vi.fn().mockImplementation(async (input) => {
      const chunk: SemanticChunk = {
        id: `chunk-${chunks.length}-${Date.now()}`,
        timestamp: Date.now(),
        text: input.text,
        tags: input.tags || [],
        sessionId: input.sessionId,
        sourceType: input.sourceType,
        sourceEventId: input.sourceEventId,
        embedding: input.embedding,
        metadata: input.metadata,
      };
      chunks.push(chunk);
      return chunk;
    }),

    get: vi.fn().mockImplementation(async (id) => {
      return chunks.find((c) => c.id === id) || null;
    }),

    searchFts: vi.fn(),
    searchVector: vi.fn(),

    search: vi.fn().mockImplementation(async (query, options) => {
      const results: SemanticSearchResult[] = chunks
        .filter((c) => {
          if (!c.text.toLowerCase().includes(query.toLowerCase())) return false;
          if (options?.sessionId && c.sessionId !== options.sessionId) return false;
          if (options?.tags) {
            for (const tag of options.tags) {
              if (!c.tags.includes(tag)) return false;
            }
          }
          return true;
        })
        .map((chunk) => ({
          chunk,
          score: 0.85,
          matchType: 'hybrid' as const,
        }));
      return results.slice(0, options?.limit || 10);
    }),

    deleteBySession: vi.fn().mockImplementation(async (sessionId) => {
      const toRemove = chunks.filter((c) => c.sessionId === sessionId);
      for (const chunk of toRemove) {
        const index = chunks.indexOf(chunk);
        if (index > -1) chunks.splice(index, 1);
      }
      return toRemove.length;
    }),
  };
}

describe('createTranscriptIndexer', () => {
  let indexer: ITranscriptIndexer;
  let store: ReturnType<typeof createMockSemanticStore>;

  beforeEach(() => {
    store = createMockSemanticStore();
    indexer = createTranscriptIndexer(store);
  });

  describe('configuration', () => {
    it('should return default config', () => {
      const config = indexer.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.chunkTokens).toBe(400);
      expect(config.overlapTokens).toBe(80);
    });

    it('should update config', () => {
      indexer.setConfig({ chunkTokens: 200 });
      expect(indexer.getConfig().chunkTokens).toBe(200);
    });

    it('should accept initial config', () => {
      const customIndexer = createTranscriptIndexer(store, {
        chunkTokens: 300,
        enabled: false,
      });
      const config = customIndexer.getConfig();
      expect(config.chunkTokens).toBe(300);
      expect(config.enabled).toBe(false);
    });
  });

  describe('indexTranscript', () => {
    it('should index a transcript', async () => {
      const transcript = createSessionTranscript('test-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Hello, how are you?' },
      });
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'assistant', content: 'I am doing well, thank you!' },
      });

      const result = await indexer.indexTranscript(transcript);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test-session');
      expect(result.chunksAdded).toBeGreaterThanOrEqual(1);
      expect(store.add).toHaveBeenCalled();
    });

    it('should skip indexing when disabled', async () => {
      indexer.setConfig({ enabled: false });

      const transcript = createSessionTranscript('test-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Test message content' },
      });

      const result = await indexer.indexTranscript(transcript);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('disabled');
    });

    it('should filter short content', async () => {
      const transcript = createSessionTranscript('test-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Hi' },
      });

      const result = await indexer.indexTranscript(transcript);

      // Short content should be filtered
      expect(result.chunksAdded).toBe(0);
    });

    it('should track indexed sessions', async () => {
      const transcript = createSessionTranscript('tracked-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'This is enough content to be indexed' },
      });

      await indexer.indexTranscript(transcript);

      const info = indexer.getIndexedInfo('tracked-session');
      expect(info).toBeDefined();
      expect(info?.sessionId).toBe('tracked-session');
      expect(info?.chunkCount).toBeGreaterThanOrEqual(1);
    });

    it('should remove old chunks before re-indexing', async () => {
      const transcript = createSessionTranscript('reindex-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'First version of content here' },
      });

      await indexer.indexTranscript(transcript);

      // Add more content and re-index
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'assistant', content: 'Additional content added later' },
      });

      const result = await indexer.indexTranscript(transcript);

      expect(result.chunksRemoved).toBeGreaterThan(0);
      expect(store.deleteBySession).toHaveBeenCalledWith('reindex-session');
    });
  });

  describe('removeIndex', () => {
    it('should remove indexed chunks', async () => {
      const transcript = createSessionTranscript('remove-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content to be removed later' },
      });

      await indexer.indexTranscript(transcript);
      const removed = await indexer.removeIndex('remove-session');

      expect(removed).toBeGreaterThan(0);
      expect(indexer.getIndexedInfo('remove-session')).toBeUndefined();
    });

    it('should handle non-existent session', async () => {
      const removed = await indexer.removeIndex('non-existent');
      expect(removed).toBe(0);
    });
  });

  describe('getAllIndexedSessions', () => {
    it('should return all indexed sessions', async () => {
      const transcript1 = createSessionTranscript('session-1');
      transcript1.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content for session one' },
      });

      const transcript2 = createSessionTranscript('session-2');
      transcript2.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content for session two' },
      });

      await indexer.indexTranscript(transcript1);
      await indexer.indexTranscript(transcript2);

      const sessions = indexer.getAllIndexedSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain('session-1');
      expect(sessions.map((s) => s.sessionId)).toContain('session-2');
    });
  });

  describe('searchTranscripts', () => {
    beforeEach(async () => {
      const transcript1 = createSessionTranscript('search-session-1');
      transcript1.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'TypeScript programming language features' },
      });

      const transcript2 = createSessionTranscript('search-session-2');
      transcript2.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Python data science libraries' },
      });

      await indexer.indexTranscript(transcript1);
      await indexer.indexTranscript(transcript2);
    });

    it('should search across transcripts', async () => {
      const results = await indexer.searchTranscripts('TypeScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sessionId).toBe('search-session-1');
    });

    it('should filter by session IDs', async () => {
      const results = await indexer.searchTranscripts('programming', {
        sessionIds: ['search-session-1'],
      });

      for (const result of results) {
        expect(result.sessionId).toBe('search-session-1');
      }
    });

    it('should respect limit', async () => {
      const results = await indexer.searchTranscripts('programming', {
        limit: 1,
      });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should include snippets', async () => {
      const results = await indexer.searchTranscripts('TypeScript');

      if (results.length > 0) {
        expect(results[0].snippet).toBeDefined();
        expect(results[0].snippet.length).toBeGreaterThan(0);
      }
    });
  });

  describe('syncAll', () => {
    it('should sync multiple transcripts', async () => {
      const transcripts: ISessionTranscript[] = [];

      for (let i = 0; i < 3; i++) {
        const t = createSessionTranscript(`sync-session-${i}`);
        t.append({
          type: 'message',
          timestamp: Date.now(),
          message: { role: 'user', content: `Content for session ${i} here` },
        });
        transcripts.push(t);
      }

      const results = await indexer.syncAll(transcripts);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should report progress', async () => {
      const transcripts: ISessionTranscript[] = [];
      for (let i = 0; i < 3; i++) {
        const t = createSessionTranscript(`progress-session-${i}`);
        t.append({
          type: 'message',
          timestamp: Date.now(),
          message: { role: 'user', content: `Progress content ${i}` },
        });
        transcripts.push(t);
      }

      const progressCalls: [number, number][] = [];
      await indexer.syncAll(transcripts, {
        progress: (current, total) => {
          progressCalls.push([current, total]);
        },
      });

      expect(progressCalls.length).toBe(3);
      expect(progressCalls[2]).toEqual([3, 3]);
    });

    it('should skip already indexed when not forced', async () => {
      const transcript = createSessionTranscript('skip-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Already indexed content' },
      });

      // Index first
      await indexer.indexTranscript(transcript);

      // Sync without force - should skip
      const results = await indexer.syncAll([transcript], { force: false });

      expect(results[0].chunksAdded).toBe(0);
    });

    it('should re-index when forced', async () => {
      const transcript = createSessionTranscript('force-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content to be force re-indexed' },
      });

      await indexer.indexTranscript(transcript);

      const results = await indexer.syncAll([transcript], { force: true });

      expect(results[0].chunksAdded).toBeGreaterThan(0);
    });
  });

  describe('needsReindex', () => {
    it('should return true for new transcript', () => {
      const transcript = createSessionTranscript('new-session');

      expect(indexer.needsReindex(transcript)).toBe(true);
    });

    it('should return false for already indexed unchanged transcript', async () => {
      const transcript = createSessionTranscript('unchanged-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Unchanged content here' },
      });

      await indexer.indexTranscript(transcript);

      expect(indexer.needsReindex(transcript)).toBe(false);
    });

    it('should return true when entry count changes', async () => {
      const transcript = createSessionTranscript('changed-session');
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Initial content message' },
      });

      await indexer.indexTranscript(transcript);

      // Add more entries
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'assistant', content: 'New content added' },
      });

      expect(indexer.needsReindex(transcript)).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all indexed sessions', async () => {
      const transcript1 = createSessionTranscript('clear-session-1');
      transcript1.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content to be cleared 1' },
      });

      const transcript2 = createSessionTranscript('clear-session-2');
      transcript2.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Content to be cleared 2' },
      });

      await indexer.indexTranscript(transcript1);
      await indexer.indexTranscript(transcript2);

      expect(indexer.getAllIndexedSessions()).toHaveLength(2);

      await indexer.clearAll();

      expect(indexer.getAllIndexedSessions()).toHaveLength(0);
    });
  });
});

describe('createDebouncer', () => {
  it('should debounce function calls', async () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(50);

    debouncer.debounce(fn);
    debouncer.debounce(fn);
    debouncer.debounce(fn);

    // Should not have been called yet
    expect(fn).not.toHaveBeenCalled();

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 100));

    // Should be called only once
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending calls', async () => {
    const fn = vi.fn();
    const debouncer = createDebouncer(50);

    debouncer.debounce(fn);
    debouncer.cancel();

    await new Promise((r) => setTimeout(r, 100));

    expect(fn).not.toHaveBeenCalled();
  });
});
