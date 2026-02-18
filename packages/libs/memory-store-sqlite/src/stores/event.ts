/**
 * @agent-stack/memory-store-sqlite - Event Store
 *
 * Stores episodic memory events (conversations, tool calls, decisions).
 */

import type Database from 'better-sqlite3';
import type {
  IEventStore,
  MemoryEvent,
  EventInput,
  EventType,
  UUID,
  Timestamp,
} from '../types.js';
import { createDbOperations } from './db-operations.js';
import { EventRecordError, DatabaseError } from '../errors.js';

/**
 * Database row type
 */
interface EventRow {
  id: string;
  timestamp: number;
  type: string;
  session_id: string | null;
  intent: string | null;
  summary: string;
  payload: string;
  parent_id: string | null;
  entities: string;
  links: string;
  tags: string;
}

/**
 * Event Store instance type (returned by factory)
 */
export interface EventStoreInstance extends IEventStore {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Check if store is initialized */
  isInitialized(): boolean;
}

/**
 * Create an Event Store instance
 */
export function createEventStore(): EventStoreInstance {
  // Compose with shared db operations
  const ops = createDbOperations('EventStore');

  // Helper function
  function rowToEvent(row: EventRow): MemoryEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      type: row.type as EventType,
      sessionId: row.session_id || undefined,
      intent: row.intent || undefined,
      entities: JSON.parse(row.entities),
      summary: row.summary,
      payload: JSON.parse(row.payload),
      links: JSON.parse(row.links),
      parentId: row.parent_id || undefined,
      tags: JSON.parse(row.tags),
    };
  }

  // Return instance object
  return {
    // Delegate db operations
    setDatabase: ops.setDatabase,
    isInitialized: ops.isInitialized,
    close: ops.close,

    async initialize(): Promise<void> {
      const db = ops.getDb();

      // Create events table
      db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          type TEXT NOT NULL,
          session_id TEXT,
          intent TEXT,
          summary TEXT NOT NULL,
          payload TEXT NOT NULL,
          parent_id TEXT,
          entities TEXT NOT NULL DEFAULT '[]',
          links TEXT NOT NULL DEFAULT '[]',
          tags TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        );

        CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
        CREATE INDEX IF NOT EXISTS idx_events_parent_id ON events(parent_id);
      `);

      ops.setInitialized(true);
    },

    async clear(): Promise<void> {
      const db = ops.getDb();
      db.exec('DELETE FROM events');
    },

    async add(input: EventInput): Promise<MemoryEvent> {
      const db = ops.getDb();

      const event: MemoryEvent = {
        id: input.id || ops.generateId(),
        timestamp: input.timestamp || ops.now(),
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

      try {
        const stmt = db.prepare(`
          INSERT INTO events (id, timestamp, type, session_id, intent, summary, payload, parent_id, entities, links, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          event.id,
          event.timestamp,
          event.type,
          event.sessionId || null,
          event.intent || null,
          event.summary,
          JSON.stringify(event.payload),
          event.parentId || null,
          JSON.stringify(event.entities),
          JSON.stringify(event.links),
          JSON.stringify(event.tags)
        );

        return event;
      } catch (error) {
        throw new EventRecordError(
          `Failed to add event: ${(error as Error).message}`,
          event.type,
          error as Error
        );
      }
    },

    async get(id: UUID): Promise<MemoryEvent | null> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
        const row = stmt.get(id) as EventRow | undefined;

        if (!row) return null;

        return rowToEvent(row);
      } catch (error) {
        throw new DatabaseError('get', (error as Error).message, error as Error);
      }
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
      const db = ops.getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.sessionId) {
        conditions.push('session_id = ?');
        params.push(options.sessionId);
      }

      if (options.types && options.types.length > 0) {
        conditions.push(`type IN (${options.types.map(() => '?').join(', ')})`);
        params.push(...options.types);
      }

      if (options.since !== undefined) {
        conditions.push('timestamp >= ?');
        params.push(options.since);
      }

      if (options.until !== undefined) {
        conditions.push('timestamp <= ?');
        params.push(options.until);
      }

      // Tags filtering (JSON array contains)
      if (options.tags && options.tags.length > 0) {
        const tagConditions = options.tags.map(() => 'tags LIKE ?');
        conditions.push(`(${tagConditions.join(' OR ')})`);
        params.push(...options.tags.map((tag) => `%"${tag}"%`));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
      const offsetClause = options.offset ? `OFFSET ${options.offset}` : '';

      try {
        const stmt = db.prepare(`
          SELECT * FROM events
          ${whereClause}
          ORDER BY timestamp DESC
          ${limitClause}
          ${offsetClause}
        `);

        const rows = stmt.all(...params) as EventRow[];
        return rows.map((row) => rowToEvent(row));
      } catch (error) {
        throw new DatabaseError('query', (error as Error).message, error as Error);
      }
    },

    async getRecent(limit: number, sessionId?: string): Promise<MemoryEvent[]> {
      return this.query({ sessionId, limit });
    },

    async count(sessionId?: string): Promise<number> {
      const db = ops.getDb();

      try {
        let stmt;
        if (sessionId) {
          stmt = db.prepare('SELECT COUNT(*) as count FROM events WHERE session_id = ?');
          const result = stmt.get(sessionId) as { count: number };
          return result.count;
        } else {
          stmt = db.prepare('SELECT COUNT(*) as count FROM events');
          const result = stmt.get() as { count: number };
          return result.count;
        }
      } catch (error) {
        throw new DatabaseError('count', (error as Error).message, error as Error);
      }
    },

    async addBatch(inputs: EventInput[]): Promise<MemoryEvent[]> {
      const db = ops.getDb();
      const events: MemoryEvent[] = [];

      const stmt = db.prepare(`
        INSERT INTO events (id, timestamp, type, session_id, intent, summary, payload, parent_id, entities, links, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((inputList: EventInput[]) => {
        for (const input of inputList) {
          const event: MemoryEvent = {
            id: input.id || ops.generateId(),
            timestamp: input.timestamp || ops.now(),
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

          stmt.run(
            event.id,
            event.timestamp,
            event.type,
            event.sessionId || null,
            event.intent || null,
            event.summary,
            JSON.stringify(event.payload),
            event.parentId || null,
            JSON.stringify(event.entities),
            JSON.stringify(event.links),
            JSON.stringify(event.tags)
          );

          events.push(event);
        }
      });

      try {
        insertMany(inputs);
        return events;
      } catch (error) {
        throw new EventRecordError(
          `Failed to add batch events: ${(error as Error).message}`,
          'BATCH',
          error as Error
        );
      }
    },

    async deleteBySession(sessionId: string): Promise<number> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('DELETE FROM events WHERE session_id = ?');
        const result = stmt.run(sessionId);
        return result.changes;
      } catch (error) {
        throw new DatabaseError('deleteBySession', (error as Error).message, error as Error);
      }
    },

    async deleteBeforeTimestamp(timestamp: Timestamp): Promise<number> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('DELETE FROM events WHERE timestamp < ?');
        const result = stmt.run(timestamp);
        return result.changes;
      } catch (error) {
        throw new DatabaseError('deleteBeforeTimestamp', (error as Error).message, error as Error);
      }
    },

    async delete(id: UUID): Promise<boolean> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('DELETE FROM events WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
      } catch (error) {
        throw new DatabaseError('delete', (error as Error).message, error as Error);
      }
    },

    async deleteBatch(ids: UUID[]): Promise<number> {
      if (ids.length === 0) return 0;

      const db = ops.getDb();

      try {
        const placeholders = ids.map(() => '?').join(', ');
        const stmt = db.prepare(`DELETE FROM events WHERE id IN (${placeholders})`);
        const result = stmt.run(...ids);
        return result.changes;
      } catch (error) {
        throw new DatabaseError('deleteBatch', (error as Error).message, error as Error);
      }
    },
  };
}
