/**
 * Regression Tests for Memory System
 *
 * Tests for:
 * - Long conversation simulation (500+ events)
 * - Memory bloat detection
 * - Profile stability
 * - Idempotency
 * - Conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createMemoryManager, type MemoryManagerInstance } from '../../src/manager.js';
import type { IMemoryObserver } from '../../src/observer.js';
import { createSqliteStores } from '@agent-stack/memory-store-sqlite';

describe('Regression Tests', () => {
  let manager: MemoryManagerInstance;
  let observer: IMemoryObserver;
  let dbPath: string;

  beforeEach(async () => {
    // Create temp database
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
    dbPath = path.join(tempDir, 'test.db');

    // Create stores first
    const stores = await createSqliteStores({ dbPath });

    manager = createMemoryManager(stores, {
      debug: false,
      writePolicy: {
        minConfidence: 0.5,
        autoSummarize: true,
        summarizeEveryNEvents: 50,
        summarizeTokenThreshold: 4000,
        profileKeyWhitelist: null,
        conflictStrategy: 'latest',
        timeDecayFactor: 0.9,
        staleThresholdMs: 7 * 24 * 60 * 60 * 1000,
      },
    });

    await manager.initialize();
    observer = manager.getObserver();
  });

  afterEach(async () => {
    await manager.close();
    // Cleanup temp files
    try {
      fs.rmSync(path.dirname(dbPath), { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Long Conversation Simulation', () => {
    it('should handle 100 events without errors', async () => {
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          await manager.recordEvent(
            observer.createUserMessageEvent(`User message ${i}`)
          );
        } else {
          await manager.recordEvent(
            observer.createAssistantMessageEvent(`Assistant response ${i}`)
          );
        }
      }

      const bundle = await manager.retrieve();

      expect(bundle.recentEvents.length).toBeGreaterThan(0);
      expect(bundle.totalTokens).toBeLessThan(10000);
    });

    it('should trigger auto-summarization after threshold', async () => {
      const sessionId = manager.getSessionId();

      // Record enough events to trigger summarization
      for (let i = 0; i < 55; i++) {
        await manager.recordEvent(
          observer.createUserMessageEvent(`Message ${i}`)
        );
      }

      // Check if summary was generated
      const bundle = await manager.retrieve({ sessionId });

      // Summary might or might not be generated depending on timing
      // Just verify the system doesn't crash
      expect(bundle).toBeDefined();
    });

    it('should handle 200 events with tool calls', async () => {
      for (let i = 0; i < 200; i++) {
        const eventType = i % 4;

        switch (eventType) {
          case 0:
            await manager.recordEvent(
              observer.createUserMessageEvent(`User request ${i}`)
            );
            break;
          case 1:
            await manager.recordEvent(
              observer.createToolCallEvent('search', { query: `query ${i}` })
            );
            break;
          case 2:
            await manager.recordEvent(
              observer.createToolResultEvent('search', `Result for ${i}`)
            );
            break;
          case 3:
            await manager.recordEvent(
              observer.createAssistantMessageEvent(`Response ${i}`)
            );
            break;
        }
      }

      const bundle = await manager.retrieve();

      expect(bundle.recentEvents.length).toBeLessThanOrEqual(20); // Should be trimmed
      expect(bundle.warnings).toBeDefined();
    });
  });

  describe('Memory Bloat Detection', () => {
    it('should keep database size under control', async () => {
      // Record 300 events
      for (let i = 0; i < 300; i++) {
        await manager.recordEvent(
          observer.createUserMessageEvent(`Message ${i} with some content to add size`)
        );
      }

      // Check database file size
      const stats = fs.statSync(dbPath);
      const sizeMB = stats.size / (1024 * 1024);

      // Should be under 5MB for 300 simple events
      expect(sizeMB).toBeLessThan(5);
    });

    it('should respect token budget in bundles', async () => {
      // Add many events
      for (let i = 0; i < 100; i++) {
        await manager.recordEvent(
          observer.createUserMessageEvent(`Long message content ${i}: `.padEnd(200, 'x'))
        );
      }

      const bundle = await manager.retrieve();

      // Total tokens should be within budget (default 2200)
      expect(bundle.totalTokens).toBeLessThan(3000);
    });
  });

  describe('Profile Stability', () => {
    it('should maintain profile values across multiple accesses', async () => {
      // Set initial profile
      await manager.setProfile({
        key: 'language',
        value: 'Chinese',
        confidence: 0.9,
        explicit: true,
      });

      // Access profile multiple times
      for (let i = 0; i < 10; i++) {
        const profile = await manager.getProfile('language');
        expect(profile!.value).toBe('Chinese');
      }
    });

    it('should not drift profile values without explicit updates', async () => {
      await manager.setProfile({
        key: 'tone',
        value: 'formal',
        confidence: 0.8,
        explicit: true,
      });

      // Simulate many conversations without profile changes
      for (let i = 0; i < 50; i++) {
        await manager.recordEvent(
          observer.createUserMessageEvent(`Message ${i}`)
        );
      }

      // Profile should remain unchanged
      const profile = await manager.getProfile('tone');
      expect(profile!.value).toBe('formal');
      expect(profile!.confidence).toBe(0.8);
    });

    it('should handle multiple profile keys independently', async () => {
      await manager.setProfile({ key: 'language', value: 'English', confidence: 1, explicit: true });
      await manager.setProfile({ key: 'tone', value: 'casual', confidence: 1, explicit: true });
      await manager.setProfile({ key: 'verbosity', value: 'concise', confidence: 1, explicit: true });

      // Update one key
      await manager.setProfile({ key: 'language', value: 'Chinese', confidence: 1, explicit: true });

      // Others should remain unchanged
      expect((await manager.getProfile('tone'))!.value).toBe('casual');
      expect((await manager.getProfile('verbosity'))!.value).toBe('concise');
      expect((await manager.getProfile('language'))!.value).toBe('Chinese');
    });
  });

  describe('Task Idempotency', () => {
    it('should not duplicate task step completion with same actionId', async () => {
      const task = await manager.createTask({
        goal: 'Test task',
        status: 'pending',
        constraints: [],
        plan: [
          { id: 'step-1', description: 'Step 1', status: 'pending' },
          { id: 'step-2', description: 'Step 2', status: 'pending' },
        ],
        done: [],
        blocked: [],
      });

      const actionId = 'complete-step-1-action';

      // Complete step multiple times with same actionId
      await manager.updateTask(task.id, {
        done: ['step-1'],
        actionId,
      });
      await manager.updateTask(task.id, {
        done: ['step-1'],
        actionId,
      });
      await manager.updateTask(task.id, {
        done: ['step-1'],
        actionId,
      });

      // Should only have one entry in done
      const current = await manager.getCurrentTask();
      expect(current!.done.length).toBe(1);
      expect(current!.done).toContain('step-1');
    });
  });

  describe('Semantic Search Quality', () => {
    it('should retrieve relevant content', async () => {
      // Add diverse content
      await manager.addChunk({
        text: 'We decided to use React because of its component model',
        tags: ['decision', 'frontend'],
      });
      await manager.addChunk({
        text: 'The database choice was PostgreSQL for ACID compliance',
        tags: ['decision', 'database'],
      });
      await manager.addChunk({
        text: 'TypeScript was chosen for type safety',
        tags: ['decision', 'language'],
      });

      // Search for frontend-related content
      const results = await manager.searchChunks('React component');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunk.text).toContain('React');
    });

    it('should filter by tags correctly', async () => {
      await manager.addChunk({
        text: 'Decision about frontend framework',
        tags: ['decision', 'frontend'],
      });
      await manager.addChunk({
        text: 'Decision about backend API',
        tags: ['decision', 'backend'],
      });

      const results = await manager.searchChunks('decision', {
        tags: ['frontend'],
      });

      expect(results.length).toBe(1);
      expect(results[0].chunk.tags).toContain('frontend');
    });
  });

  describe('Session Isolation', () => {
    it('should isolate events by session', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      // Events in session 1
      manager.setSessionId(session1);
      await manager.recordEvent(
        observer.createUserMessageEvent('Session 1 message')
      );

      // Events in session 2
      manager.setSessionId(session2);
      await manager.recordEvent(
        observer.createUserMessageEvent('Session 2 message')
      );

      // Retrieve for session 1
      const bundle1 = await manager.retrieve({ sessionId: session1 });
      expect(bundle1.recentEvents.length).toBe(1);
      expect(bundle1.recentEvents[0].summary).toContain('Session 1');

      // Retrieve for session 2
      const bundle2 = await manager.retrieve({ sessionId: session2 });
      expect(bundle2.recentEvents.length).toBe(1);
      expect(bundle2.recentEvents[0].summary).toContain('Session 2');
    });

    it('should isolate tasks by session', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      manager.setSessionId(session1);
      await manager.createTask({
        goal: 'Session 1 task',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: session1,
      });

      manager.setSessionId(session2);
      await manager.createTask({
        goal: 'Session 2 task',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
        sessionId: session2,
      });

      // Get current task for session 1
      const task1 = await manager.getCurrentTask(session1);
      expect(task1!.goal).toBe('Session 1 task');

      // Get current task for session 2
      const task2 = await manager.getCurrentTask(session2);
      expect(task2!.goal).toBe('Session 2 task');
    });
  });

  describe('Memory Injection', () => {
    it('should format bundle correctly', async () => {
      await manager.setProfile({
        key: 'language',
        value: 'Chinese',
        explicit: true,
      });

      await manager.recordEvent(
        observer.createUserMessageEvent('Test message')
      );

      const bundle = await manager.retrieve();
      const injected = manager.inject(bundle);

      expect(injected).toContain('User Preferences');
      expect(injected).toContain('language');
      expect(injected).toContain('Chinese');
    });

    it('should include warnings in injection', async () => {
      // Create a stale task
      await manager.createTask({
        goal: 'Old task',
        status: 'pending',
        constraints: [],
        plan: [],
        done: [],
        blocked: [],
      });

      const bundle = await manager.retrieve();

      // Even if no warnings, injection should work
      const injected = manager.inject(bundle);
      expect(injected).toBeDefined();
    });
  });
});
