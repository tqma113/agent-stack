/**
 * @agent-stack/memory-store-json - Event Store
 *
 * JSON-based event storage for episodic memory.
 */

import * as path from 'node:path';
import type {
  IEventStore,
  MemoryEvent,
  EventInput,
  EventType,
  UUID,
  Timestamp,
} from '@agent-stack/memory-store-sqlite';
import {
  readJsonFile,
  writeJsonFile,
  ensureDir,
  deleteDir,
  listDirs,
  generateId,
  now,
} from '../utils/file-ops.js';

/**
 * Events data structure stored in JSON
 */
interface EventsData {
  events: MemoryEvent[];
}

/**
 * JSON Event Store configuration
 */
export interface JsonEventStoreConfig {
  basePath: string;
}

/**
 * Create a JSON Event Store instance
 */
export function createJsonEventStore(config: JsonEventStoreConfig): IEventStore {
  const eventsDir = path.join(config.basePath, 'events');
  let initialized = false;

  /**
   * Get events file path for a session
   */
  function getEventsPath(sessionId: string): string {
    return path.join(eventsDir, sessionId, 'events.json');
  }

  /**
   * Get global events file (for events without session)
   */
  function getGlobalEventsPath(): string {
    return path.join(eventsDir, '_global', 'events.json');
  }

  /**
   * Read events for a session
   */
  function readEvents(sessionId?: string): MemoryEvent[] {
    const filePath = sessionId ? getEventsPath(sessionId) : getGlobalEventsPath();
    const data = readJsonFile<EventsData>(filePath, { events: [] });
    return data.events;
  }

  /**
   * Write events for a session
   */
  function writeEvents(events: MemoryEvent[], sessionId?: string): void {
    const filePath = sessionId ? getEventsPath(sessionId) : getGlobalEventsPath();
    writeJsonFile(filePath, { events });
  }

  /**
   * Get all session IDs
   */
  function getAllSessionIds(): string[] {
    return listDirs(eventsDir);
  }

  /**
   * Get all events across all sessions
   */
  function getAllEvents(): MemoryEvent[] {
    const allEvents: MemoryEvent[] = [];
    const sessionIds = getAllSessionIds();

    for (const sessionId of sessionIds) {
      const events = readEvents(sessionId === '_global' ? undefined : sessionId);
      allEvents.push(...events);
    }

    return allEvents.sort((a, b) => b.timestamp - a.timestamp);
  }

  return {
    async initialize(): Promise<void> {
      ensureDir(eventsDir);
      initialized = true;
    },

    async close(): Promise<void> {
      initialized = false;
    },

    async clear(): Promise<void> {
      deleteDir(eventsDir);
      ensureDir(eventsDir);
    },

    async add(input: EventInput): Promise<MemoryEvent> {
      const event: MemoryEvent = {
        id: input.id || generateId(),
        timestamp: input.timestamp || now(),
        type: input.type,
        sessionId: input.sessionId,
        intent: input.intent,
        entities: input.entities || [],
        summary: input.summary,
        payload: input.payload,
        links: input.links || [],
        parentId: input.parentId,
        tags: input.tags || [],
      };

      const events = readEvents(event.sessionId);
      events.push(event);
      writeEvents(events, event.sessionId);

      return event;
    },

    async addBatch(inputs: EventInput[]): Promise<MemoryEvent[]> {
      // Group by session
      const bySession = new Map<string | undefined, EventInput[]>();
      for (const input of inputs) {
        const sessionId = input.sessionId;
        if (!bySession.has(sessionId)) {
          bySession.set(sessionId, []);
        }
        bySession.get(sessionId)!.push(input);
      }

      const results: MemoryEvent[] = [];

      // Process each session batch
      for (const [sessionId, sessionInputs] of bySession) {
        const events = readEvents(sessionId);
        const newEvents: MemoryEvent[] = sessionInputs.map(input => ({
          id: input.id || generateId(),
          timestamp: input.timestamp || now(),
          type: input.type,
          sessionId: input.sessionId,
          intent: input.intent,
          entities: input.entities || [],
          summary: input.summary,
          payload: input.payload,
          links: input.links || [],
          parentId: input.parentId,
          tags: input.tags || [],
        }));

        events.push(...newEvents);
        writeEvents(events, sessionId);
        results.push(...newEvents);
      }

      return results;
    },

    async get(id: UUID): Promise<MemoryEvent | null> {
      const allEvents = getAllEvents();
      return allEvents.find(e => e.id === id) || null;
    },

    async query(options: {
      sessionId?: string;
      types?: EventType[];
      since?: Timestamp;
      until?: Timestamp;
      limit?: number;
      offset?: number;
      tags?: string[];
    }): Promise<MemoryEvent[]> {
      let events: MemoryEvent[];

      if (options.sessionId) {
        events = readEvents(options.sessionId);
      } else {
        events = getAllEvents();
      }

      // Filter by types
      if (options.types && options.types.length > 0) {
        events = events.filter(e => options.types!.includes(e.type));
      }

      // Filter by time range
      if (options.since !== undefined) {
        events = events.filter(e => e.timestamp >= options.since!);
      }
      if (options.until !== undefined) {
        events = events.filter(e => e.timestamp <= options.until!);
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        events = events.filter(e =>
          options.tags!.some(tag => e.tags.includes(tag))
        );
      }

      // Sort by timestamp descending
      events.sort((a, b) => b.timestamp - a.timestamp);

      // Apply offset
      if (options.offset) {
        events = events.slice(options.offset);
      }

      // Apply limit
      if (options.limit) {
        events = events.slice(0, options.limit);
      }

      return events;
    },

    async getRecent(limit: number, sessionId?: string): Promise<MemoryEvent[]> {
      return this.query({ sessionId, limit });
    },

    async count(sessionId?: string): Promise<number> {
      if (sessionId) {
        return readEvents(sessionId).length;
      }
      return getAllEvents().length;
    },

    async delete(id: UUID): Promise<boolean> {
      const sessionIds = getAllSessionIds();

      for (const sessionId of sessionIds) {
        const events = readEvents(sessionId === '_global' ? undefined : sessionId);
        const index = events.findIndex(e => e.id === id);

        if (index !== -1) {
          events.splice(index, 1);
          writeEvents(events, sessionId === '_global' ? undefined : sessionId);
          return true;
        }
      }

      return false;
    },

    async deleteBatch(ids: UUID[]): Promise<number> {
      if (ids.length === 0) return 0;

      const idSet = new Set(ids);
      const sessionIds = getAllSessionIds();
      let deleted = 0;

      for (const sessionId of sessionIds) {
        const events = readEvents(sessionId === '_global' ? undefined : sessionId);
        const originalLength = events.length;
        const filtered = events.filter(e => !idSet.has(e.id));

        if (filtered.length < originalLength) {
          deleted += originalLength - filtered.length;
          writeEvents(filtered, sessionId === '_global' ? undefined : sessionId);
        }
      }

      return deleted;
    },

    async deleteBySession(sessionId: string): Promise<number> {
      const events = readEvents(sessionId);
      const count = events.length;

      if (count > 0) {
        deleteDir(path.join(eventsDir, sessionId));
      }

      return count;
    },

    async deleteBeforeTimestamp(timestamp: Timestamp): Promise<number> {
      const sessionIds = getAllSessionIds();
      let deleted = 0;

      for (const sessionId of sessionIds) {
        const events = readEvents(sessionId === '_global' ? undefined : sessionId);
        const originalLength = events.length;
        const filtered = events.filter(e => e.timestamp >= timestamp);

        if (filtered.length < originalLength) {
          deleted += originalLength - filtered.length;
          writeEvents(filtered, sessionId === '_global' ? undefined : sessionId);
        }
      }

      return deleted;
    },
  };
}
