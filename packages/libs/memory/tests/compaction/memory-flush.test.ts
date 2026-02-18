/**
 * Tests for Memory Flush module
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryFlush,
  parseLLMFlushResponse,
  type IMemoryFlush,
} from '../../src/compaction/memory-flush.js';
import type { MemoryEvent } from '@ai-stack/memory-store-sqlite';

// Helper to create mock events
function createMockEvent(
  type: MemoryEvent['type'],
  summary: string,
  payload: Record<string, unknown> = {}
): MemoryEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type,
    summary,
    payload,
    entities: [],
    links: [],
    tags: [],
  };
}

describe('createMemoryFlush', () => {
  let flush: IMemoryFlush;

  beforeEach(() => {
    flush = createMemoryFlush();
  });

  describe('checkFlush', () => {
    it('should not trigger when disabled', () => {
      flush.setConfig({ enabled: false });
      const result = flush.checkFlush(10000, 100);

      expect(result.shouldFlush).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should not trigger when below threshold', () => {
      const result = flush.checkFlush(1000, 10);

      expect(result.shouldFlush).toBe(false);
      expect(result.reason).toBe('threshold_not_reached');
    });

    it('should not trigger with too few events', () => {
      const result = flush.checkFlush(5000, 2);

      expect(result.shouldFlush).toBe(false);
      expect(result.reason).toBe('too_few_events');
    });

    it('should trigger at soft threshold', () => {
      const result = flush.checkFlush(4000, 10);

      expect(result.shouldFlush).toBe(true);
      expect(result.reason).toBe('soft_threshold_exceeded');
    });

    it('should trigger at hard threshold', () => {
      const result = flush.checkFlush(8000, 10);

      expect(result.shouldFlush).toBe(true);
      expect(result.reason).toBe('hard_threshold_exceeded');
      expect(result.urgency).toBe(1.0);
    });
  });

  describe('calculateUrgency', () => {
    it('should return 0 for no tokens', () => {
      expect(flush.calculateUrgency(0)).toBe(0);
    });

    it('should return < 0.5 below soft threshold', () => {
      const urgency = flush.calculateUrgency(2000);
      expect(urgency).toBeLessThan(0.5);
    });

    it('should return between 0.5 and 1 between thresholds', () => {
      const urgency = flush.calculateUrgency(6000);
      expect(urgency).toBeGreaterThanOrEqual(0.5);
      expect(urgency).toBeLessThan(1.0);
    });

    it('should return 1.0 at hard threshold', () => {
      expect(flush.calculateUrgency(8000)).toBe(1.0);
    });
  });

  describe('extractFlushContent', () => {
    it('should extract decisions from DECISION events', async () => {
      const events = [
        createMockEvent('DECISION', 'Decided to use TypeScript', {
          reasoning: 'Better type safety',
        }),
      ];

      const content = await flush.extractFlushContent(events);

      expect(content.decisions).toHaveLength(1);
      expect(content.decisions[0].decision).toBe('Decided to use TypeScript');
      expect(content.decisions[0].reasoning).toBe('Better type safety');
    });

    it('should extract facts from TOOL_RESULT events', async () => {
      const events = [
        createMockEvent('TOOL_RESULT', 'Found 10 matching files', {
          toolName: 'search',
          result: 'Found 10 matching files in the codebase with the pattern you specified.',
        }),
      ];

      const content = await flush.extractFlushContent(events);

      expect(content.facts.length).toBeGreaterThanOrEqual(1);
      expect(content.facts[0].source).toContain('tool:');
    });

    it('should extract todos from USER_MSG events', async () => {
      const events = [
        createMockEvent('USER_MSG', 'User request', {
          content: "Please don't forget to update the documentation",
        }),
      ];

      const content = await flush.extractFlushContent(events);

      expect(content.todos.length).toBeGreaterThanOrEqual(1);
      expect(content.todos[0].description).toContain('update the documentation');
    });

    it('should extract preferences from USER_MSG events', async () => {
      const events = [
        createMockEvent('USER_MSG', 'User preference', {
          content: 'Please respond in Chinese from now on',
        }),
      ];

      const content = await flush.extractFlushContent(events);

      expect(content.preferences.length).toBeGreaterThanOrEqual(1);
      expect(content.preferences.some((p) => p.key === 'language')).toBe(true);
    });

    it('should generate summary when enabled', async () => {
      const events = [
        createMockEvent('USER_MSG', 'User asked about TypeScript', {}),
        createMockEvent('ASSISTANT_MSG', 'Explained TypeScript basics', {}),
      ];

      const content = await flush.extractFlushContent(events);

      expect(content.summary).toBeDefined();
      expect(content.summary!.length).toBeGreaterThan(0);
    });

    it('should create chunks from extracted content', async () => {
      const events = [
        createMockEvent('DECISION', 'Use TypeScript', {}),
        createMockEvent('USER_MSG', 'Remember to test', {
          content: 'Please remember to add tests',
        }),
      ];

      const content = await flush.extractFlushContent(events, {
        sessionId: 'test-session',
      });

      expect(content.chunks.length).toBeGreaterThan(0);
      expect(content.chunks.some((c) => c.tags.includes('auto-flush'))).toBe(true);
    });

    it('should use custom extractor when provided', async () => {
      const customContent = {
        decisions: [{ decision: 'Custom decision', timestamp: Date.now() }],
        facts: [],
        todos: [],
        preferences: [],
        chunks: [],
      };

      const content = await flush.extractFlushContent([], {
        customExtractor: async () => customContent,
      });

      expect(content.decisions[0].decision).toBe('Custom decision');
    });
  });

  describe('state management', () => {
    it('should track flush state', () => {
      const result = {
        success: true,
        content: {
          decisions: [],
          facts: [],
          todos: [],
          preferences: [],
          chunks: [],
        },
        chunksWritten: 5,
        timestamp: Date.now(),
      };

      flush.recordFlush(result);

      const state = flush.getState();
      expect(state.lastFlushTimestamp).toBe(result.timestamp);
      expect(state.totalEventsSinceFlush).toBe(0);
      expect(state.flushHistory).toHaveLength(1);
    });

    it('should reset state correctly', () => {
      flush.recordFlush({
        success: true,
        content: { decisions: [], facts: [], todos: [], preferences: [], chunks: [] },
        chunksWritten: 1,
        timestamp: Date.now(),
      });

      flush.resetState();

      const state = flush.getState();
      expect(state.lastFlushTimestamp).toBe(0);
      expect(state.flushHistory).toHaveLength(0);
    });

    it('should track time since last flush', () => {
      expect(flush.getTimeSinceLastFlush()).toBe(Infinity);

      flush.recordFlush({
        success: true,
        content: { decisions: [], facts: [], todos: [], preferences: [], chunks: [] },
        chunksWritten: 1,
        timestamp: Date.now() - 1000,
      });

      expect(flush.getTimeSinceLastFlush()).toBeGreaterThanOrEqual(1000);
    });
  });
});

describe('parseLLMFlushResponse', () => {
  it('should return null for NO_FLUSH_NEEDED', () => {
    expect(parseLLMFlushResponse('NO_FLUSH_NEEDED')).toBeNull();
  });

  it('should parse valid JSON response', () => {
    const response = `Here's the extracted content:
    {
      "decisions": [{"decision": "Use React", "reasoning": "Popular framework"}],
      "facts": [{"fact": "Project uses TypeScript", "source": "config"}],
      "todos": [],
      "preferences": [],
      "summary": "Session about React setup"
    }`;

    const content = parseLLMFlushResponse(response);

    expect(content).not.toBeNull();
    expect(content!.decisions).toHaveLength(1);
    expect(content!.facts).toHaveLength(1);
    expect(content!.summary).toBe('Session about React setup');
  });

  it('should return null for invalid JSON', () => {
    expect(parseLLMFlushResponse('Not valid json at all')).toBeNull();
  });
});
