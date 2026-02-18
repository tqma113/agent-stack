/**
 * Tests for Compaction Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCompactionManager,
  type ICompactionManager,
} from '../../src/compaction/compaction-manager.js';
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

describe('createCompactionManager', () => {
  let manager: ICompactionManager;

  beforeEach(() => {
    manager = createCompactionManager();
  });

  describe('state management', () => {
    it('should track token count', () => {
      manager.updateTokenCount(5000);

      const state = manager.getState();
      expect(state.currentTokens).toBe(5000);
    });

    it('should track events', () => {
      manager.recordEvent(createMockEvent('USER_MSG', 'Test', {}));
      manager.recordEvent(createMockEvent('ASSISTANT_MSG', 'Response', {}));

      const state = manager.getState();
      expect(state.eventCount).toBe(2);
      expect(state.eventsSinceFlush).toBe(2);
    });

    it('should reset state', () => {
      manager.updateTokenCount(5000);
      manager.recordEvent(createMockEvent('USER_MSG', 'Test', {}));

      manager.resetState();

      const state = manager.getState();
      expect(state.currentTokens).toBe(0);
      expect(state.eventCount).toBe(0);
    });
  });

  describe('checkHealth', () => {
    it('should report healthy when usage is low', () => {
      manager.updateTokenCount(10000);

      const health = manager.checkHealth();
      expect(health.healthy).toBe(true);
      expect(health.recommendation).toBe('none');
    });

    it('should recommend flush_soon at moderate usage', () => {
      // Default maxContextTokens is 128000, reserve is 4000
      // Available is 124000, 60% is 74400
      manager.updateTokenCount(75000);

      const health = manager.checkHealth();
      expect(health.recommendation).toBe('flush_soon');
    });

    it('should recommend flush_now at high usage', () => {
      // 80% of available (124000) is 99200
      manager.updateTokenCount(100000);

      const health = manager.checkHealth();
      expect(health.healthy).toBe(false);
      expect(health.recommendation).toBe('flush_now');
    });

    it('should report critical at very high usage', () => {
      // 95% of available (124000) is 117800
      manager.updateTokenCount(120000);

      const health = manager.checkHealth();
      expect(health.recommendation).toBe('critical');
    });
  });

  describe('shouldCompact', () => {
    it('should not compact when disabled', () => {
      manager.setConfig({ autoCompact: false });
      manager.updateTokenCount(100000);

      expect(manager.shouldCompact()).toBe(false);
    });

    it('should not compact when tokens are low', () => {
      manager.updateTokenCount(1000);
      for (let i = 0; i < 10; i++) {
        manager.recordEvent(createMockEvent('USER_MSG', 'Test', {}));
      }

      expect(manager.shouldCompact()).toBe(false);
    });

    it('should compact at high token usage with enough events', () => {
      // Configure lower thresholds for testing
      manager.setConfig({
        flush: { softThresholdTokens: 1000, hardThresholdTokens: 2000 },
        maxContextTokens: 4000,
        reserveTokens: 500,
      });

      manager.updateTokenCount(2800); // 80% of 3500 available
      for (let i = 0; i < 10; i++) {
        manager.recordEvent(createMockEvent('USER_MSG', 'Test', {}));
      }

      expect(manager.shouldCompact()).toBe(true);
    });
  });

  describe('performFlush', () => {
    it('should skip flush when not needed', async () => {
      manager.updateTokenCount(100);

      const result = await manager.performFlush([]);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not needed');
    });

    it('should flush when forced', async () => {
      const events = [
        createMockEvent('DECISION', 'Use TypeScript', {}),
      ];

      const result = await manager.performFlush(events, { force: true });

      expect(result.success).toBe(true);
      expect(result.content.decisions.length).toBeGreaterThanOrEqual(1);
    });

    it('should reset eventsSinceFlush after flush', async () => {
      for (let i = 0; i < 10; i++) {
        manager.recordEvent(createMockEvent('USER_MSG', 'Test', {}));
      }

      await manager.performFlush([], { force: true });

      const state = manager.getState();
      expect(state.eventsSinceFlush).toBe(0);
    });
  });

  describe('compact', () => {
    it('should prevent concurrent compaction', async () => {
      // Start first compaction
      const promise1 = manager.compact([], { force: true } as never);

      // Try to start second compaction immediately
      const result2 = await manager.compact([], { force: true } as never);

      await promise1;

      expect(result2.success).toBe(false);
      expect(result2.error?.message).toContain('already in progress');
    });

    it('should record compaction in history', async () => {
      manager.updateTokenCount(5000);

      await manager.compact([createMockEvent('DECISION', 'Test', {})], {
        sessionId: 'test',
      });

      const state = manager.getState();
      expect(state.history.length).toBe(1);
      expect(state.history[0].tokensBefore).toBe(5000);
    });

    it('should call onCompaction callback', async () => {
      let callbackCalled = false;
      manager.setConfig({
        onCompaction: () => {
          callbackCalled = true;
        },
      });

      await manager.compact([createMockEvent('USER_MSG', 'Test', {})]);

      expect(callbackCalled).toBe(true);
    });

    it('should estimate token reduction after compaction', async () => {
      manager.updateTokenCount(10000);

      const result = await manager.compact([]);

      expect(result.tokensAfter).toBeLessThan(result.tokensBefore);
      expect(manager.getState().currentTokens).toBeLessThan(10000);
    });
  });

  describe('getFlush', () => {
    it('should return the underlying flush instance', () => {
      const flush = manager.getFlush();

      expect(flush).toBeDefined();
      expect(typeof flush.checkFlush).toBe('function');
    });
  });
});
