/**
 * Tests for Session Transcript
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSessionTranscript,
  formatTranscript,
  type ISessionTranscript,
  type TranscriptEntry,
} from '../../src/transcript/session-transcript.js';
import type { MemoryEvent } from '@agent-stack/memory-store-sqlite';

describe('createSessionTranscript', () => {
  let transcript: ISessionTranscript;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    transcript = createSessionTranscript(sessionId);
  });

  describe('metadata', () => {
    it('should initialize with correct metadata', () => {
      const metadata = transcript.getMetadata();

      expect(metadata.sessionId).toBe(sessionId);
      expect(metadata.entryCount).toBe(0);
      expect(metadata.active).toBe(true);
    });

    it('should update metadata', () => {
      transcript.updateMetadata({ title: 'Test Session', tags: ['test'] });

      const metadata = transcript.getMetadata();
      expect(metadata.title).toBe('Test Session');
      expect(metadata.tags).toContain('test');
    });
  });

  describe('append', () => {
    it('should append entries', () => {
      const entry: TranscriptEntry = {
        type: 'message',
        timestamp: Date.now(),
        message: {
          role: 'user',
          content: 'Hello, world!',
        },
      };

      transcript.append(entry);

      expect(transcript.getEntries()).toHaveLength(1);
      expect(transcript.getMetadata().entryCount).toBe(1);
    });

    it('should track token estimates', () => {
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'A'.repeat(100) },
      });

      expect(transcript.estimateTokens()).toBeGreaterThan(0);
    });
  });

  describe('appendFromEvent', () => {
    it('should convert MemoryEvent to TranscriptEntry', () => {
      const event: MemoryEvent = {
        id: 'event-1',
        timestamp: Date.now(),
        type: 'USER_MSG',
        summary: 'User said hello',
        payload: { content: 'Hello!' },
        entities: [],
        links: [],
        tags: ['greeting'],
      };

      transcript.appendFromEvent(event);

      const entries = transcript.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message.role).toBe('user');
      expect(entries[0].message.content).toBe('Hello!');
    });

    it('should handle different event types', () => {
      const events: MemoryEvent[] = [
        {
          id: '1',
          timestamp: Date.now(),
          type: 'USER_MSG',
          summary: 'User msg',
          payload: { content: 'User content' },
          entities: [],
          links: [],
          tags: [],
        },
        {
          id: '2',
          timestamp: Date.now(),
          type: 'ASSISTANT_MSG',
          summary: 'Assistant msg',
          payload: { content: 'Assistant content' },
          entities: [],
          links: [],
          tags: [],
        },
        {
          id: '3',
          timestamp: Date.now(),
          type: 'TOOL_CALL',
          summary: 'Tool call',
          payload: { toolName: 'search', args: {} },
          entities: [],
          links: [],
          tags: [],
        },
      ];

      for (const event of events) {
        transcript.appendFromEvent(event);
      }

      const entries = transcript.getEntries();
      expect(entries[0].message.role).toBe('user');
      expect(entries[1].message.role).toBe('assistant');
      expect(entries[2].message.role).toBe('tool');
    });
  });

  describe('getEntriesInRange', () => {
    it('should filter entries by time range', () => {
      const now = Date.now();

      transcript.append({ type: 'message', timestamp: now - 2000, message: { role: 'user', content: 'old' } });
      transcript.append({ type: 'message', timestamp: now - 1000, message: { role: 'user', content: 'middle' } });
      transcript.append({ type: 'message', timestamp: now, message: { role: 'user', content: 'new' } });

      const filtered = transcript.getEntriesInRange(now - 1500, now - 500);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].message.content).toBe('middle');
    });
  });

  describe('JSONL serialization', () => {
    it('should serialize to JSONL', () => {
      transcript.append({
        type: 'message',
        timestamp: 1000,
        message: { role: 'user', content: 'Hello' },
      });
      transcript.append({
        type: 'message',
        timestamp: 2000,
        message: { role: 'assistant', content: 'Hi!' },
      });

      const jsonl = transcript.toJSONL();
      const lines = jsonl.split('\n');

      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).message.role).toBe('user');
      expect(JSON.parse(lines[1]).message.role).toBe('assistant');
    });

    it('should parse from JSONL', () => {
      const jsonl = [
        JSON.stringify({ type: 'message', timestamp: 1000, message: { role: 'user', content: 'Hello' } }),
        JSON.stringify({ type: 'message', timestamp: 2000, message: { role: 'assistant', content: 'Hi!' } }),
      ].join('\n');

      transcript.fromJSONL(jsonl);

      expect(transcript.getEntries()).toHaveLength(2);
      expect(transcript.getMetadata().entryCount).toBe(2);
    });
  });

  describe('generateChunks', () => {
    it('should generate chunks from entries', () => {
      // Add enough content to create multiple chunks
      for (let i = 0; i < 10; i++) {
        transcript.append({
          type: 'message',
          timestamp: Date.now() + i * 1000,
          message: { role: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}: ${'x'.repeat(200)}` },
        });
      }

      const chunks = transcript.generateChunks({
        maxTokensPerChunk: 200,
        overlapTokens: 40,
      });

      expect(chunks.length).toBeGreaterThan(1);

      // Check chunk properties
      for (const chunk of chunks) {
        expect(chunk.sessionId).toBe(sessionId);
        expect(chunk.sourceType).toBe('transcript');
        expect(chunk.text.length).toBeGreaterThan(0);
      }
    });

    it('should include overlap between chunks', () => {
      for (let i = 0; i < 5; i++) {
        transcript.append({
          type: 'message',
          timestamp: Date.now() + i * 1000,
          message: { role: 'user', content: `Message${i}: ${'y'.repeat(100)}` },
        });
      }

      const chunks = transcript.generateChunks({
        maxTokensPerChunk: 100,
        overlapTokens: 30,
      });

      if (chunks.length > 1) {
        // Check for overlap - end lines should overlap with start lines
        expect(chunks[0].endLine).toBeGreaterThanOrEqual(chunks[1].startLine - 1);
      }
    });
  });

  describe('generateTitle', () => {
    it('should generate title from first user message', () => {
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'How do I implement a binary search algorithm?' },
      });

      const title = transcript.generateTitle();
      expect(title).toContain('binary search');
    });

    it('should truncate long titles', () => {
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'A'.repeat(100) },
      });

      const title = transcript.generateTitle();
      expect(title.length).toBeLessThanOrEqual(50);
    });

    it('should fallback to session ID for empty transcript', () => {
      const title = transcript.generateTitle();
      expect(title).toContain(sessionId.slice(0, 8));
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      transcript.append({
        type: 'message',
        timestamp: Date.now(),
        message: { role: 'user', content: 'Test' },
      });

      transcript.clear();

      expect(transcript.getEntries()).toHaveLength(0);
      expect(transcript.getMetadata().entryCount).toBe(0);
      expect(transcript.estimateTokens()).toBe(0);
    });
  });
});

describe('formatTranscript', () => {
  it('should format entries for display', () => {
    const entries: TranscriptEntry[] = [
      { type: 'message', timestamp: Date.now(), message: { role: 'user', content: 'Hello' } },
      { type: 'message', timestamp: Date.now(), message: { role: 'assistant', content: 'Hi!' } },
    ];

    const formatted = formatTranscript(entries);

    expect(formatted).toContain('[USER]: Hello');
    expect(formatted).toContain('[ASSISTANT]: Hi!');
  });

  it('should include timestamps when requested', () => {
    const entries: TranscriptEntry[] = [
      { type: 'message', timestamp: 1000000000000, message: { role: 'user', content: 'Test' } },
    ];

    const formatted = formatTranscript(entries, { includeTimestamps: true });

    expect(formatted).toMatch(/\[\d{4}-\d{2}-\d{2}/); // ISO date format
  });

  it('should truncate long output', () => {
    const entries: TranscriptEntry[] = [
      { type: 'message', timestamp: Date.now(), message: { role: 'user', content: 'A'.repeat(1000) } },
    ];

    const formatted = formatTranscript(entries, { maxLength: 100 });

    expect(formatted.length).toBeLessThanOrEqual(120); // Allow for truncation indicator
  });
});
