/**
 * @agent-stack/memory-store - Summary Store
 *
 * Stores rolling summaries for conversation compression.
 */

import type Database from 'better-sqlite3';
import type { ISummaryStore, Summary, SummaryInput, UUID, Timestamp } from '../types.js';
import { createDbOperations } from './db-operations.js';
import { DatabaseError } from '../errors.js';

/**
 * Database row type
 */
interface SummaryRow {
  id: string;
  timestamp: number;
  session_id: string;
  short: string;
  bullets: string;
  decisions: string;
  todos: string;
  covered_event_ids: string;
  token_count: number | null;
}

/**
 * Summary Store instance type (returned by factory)
 */
export interface SummaryStoreInstance extends ISummaryStore {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Check if store is initialized */
  isInitialized(): boolean;
}

/**
 * Create a Summary Store instance
 */
export function createSummaryStore(): SummaryStoreInstance {
  // Compose with shared db operations
  const ops = createDbOperations('SummaryStore');

  // Helper function
  function rowToSummary(row: SummaryRow): Summary {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sessionId: row.session_id,
      short: row.short,
      bullets: JSON.parse(row.bullets),
      decisions: JSON.parse(row.decisions),
      todos: JSON.parse(row.todos),
      coveredEventIds: JSON.parse(row.covered_event_ids),
      tokenCount: row.token_count ?? undefined,
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

      db.exec(`
        CREATE TABLE IF NOT EXISTS summaries (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          session_id TEXT NOT NULL,
          short TEXT NOT NULL,
          bullets TEXT NOT NULL DEFAULT '[]',
          decisions TEXT NOT NULL DEFAULT '[]',
          todos TEXT NOT NULL DEFAULT '[]',
          covered_event_ids TEXT NOT NULL DEFAULT '[]',
          token_count INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_summaries_session_id ON summaries(session_id);
        CREATE INDEX IF NOT EXISTS idx_summaries_timestamp ON summaries(timestamp);
      `);

      ops.setInitialized(true);
    },

    async clear(): Promise<void> {
      const db = ops.getDb();
      db.exec('DELETE FROM summaries');
    },

    async add(input: SummaryInput): Promise<Summary> {
      const db = ops.getDb();

      const summary: Summary = {
        id: ops.generateId(),
        timestamp: ops.now(),
        sessionId: input.sessionId,
        short: input.short,
        bullets: input.bullets || [],
        decisions: input.decisions || [],
        todos: input.todos || [],
        coveredEventIds: input.coveredEventIds || [],
        tokenCount: input.tokenCount,
      };

      try {
        const stmt = db.prepare(`
          INSERT INTO summaries (
            id, timestamp, session_id, short, bullets, decisions, todos,
            covered_event_ids, token_count
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          summary.id,
          summary.timestamp,
          summary.sessionId,
          summary.short,
          JSON.stringify(summary.bullets),
          JSON.stringify(summary.decisions),
          JSON.stringify(summary.todos),
          JSON.stringify(summary.coveredEventIds),
          summary.tokenCount ?? null
        );

        return summary;
      } catch (error) {
        throw new DatabaseError('add', (error as Error).message, error as Error);
      }
    },

    async get(id: UUID): Promise<Summary | null> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('SELECT * FROM summaries WHERE id = ?');
        const row = stmt.get(id) as SummaryRow | undefined;

        if (!row) return null;

        return rowToSummary(row);
      } catch (error) {
        throw new DatabaseError('get', (error as Error).message, error as Error);
      }
    },

    async getLatest(sessionId: string): Promise<Summary | null> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare(`
          SELECT * FROM summaries
          WHERE session_id = ?
          ORDER BY timestamp DESC
          LIMIT 1
        `);
        const row = stmt.get(sessionId) as SummaryRow | undefined;

        if (!row) return null;

        return rowToSummary(row);
      } catch (error) {
        throw new DatabaseError('getLatest', (error as Error).message, error as Error);
      }
    },

    async list(options?: {
      sessionId?: string;
      since?: Timestamp;
      limit?: number;
    }): Promise<Summary[]> {
      const db = ops.getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options?.sessionId) {
        conditions.push('session_id = ?');
        params.push(options.sessionId);
      }

      if (options?.since !== undefined) {
        conditions.push('timestamp >= ?');
        params.push(options.since);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

      try {
        const stmt = db.prepare(`
          SELECT * FROM summaries
          ${whereClause}
          ORDER BY timestamp DESC
          ${limitClause}
        `);

        const rows = stmt.all(...params) as SummaryRow[];
        return rows.map((row) => rowToSummary(row));
      } catch (error) {
        throw new DatabaseError('list', (error as Error).message, error as Error);
      }
    },
  };
}
