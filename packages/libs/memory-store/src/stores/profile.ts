/**
 * @agent-stack/memory-store - Profile Store
 *
 * Stores user preferences and profile data.
 */

import type Database from 'better-sqlite3';
import type { IProfileStore, ProfileItem, ProfileItemInput, UUID } from '../types.js';
import { createDbOperations } from './db-operations.js';
import { ProfileError, DatabaseError } from '../errors.js';

/**
 * Database row type
 */
interface ProfileRow {
  key: string;
  value: string;
  updated_at: number;
  confidence: number;
  source_event_id: string | null;
  explicit: number;
  expires_at: number | null;
}

/**
 * Profile Store instance type (returned by factory)
 */
export interface ProfileStoreInstance extends IProfileStore {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Check if store is initialized */
  isInitialized(): boolean;
  /** Clean up expired items */
  cleanupExpired(): Promise<number>;
}

/**
 * Create a Profile Store instance
 */
export function createProfileStore(): ProfileStoreInstance {
  // Compose with shared db operations
  const ops = createDbOperations('ProfileStore');

  // Helper function
  function rowToProfileItem(row: ProfileRow): ProfileItem {
    return {
      key: row.key,
      value: JSON.parse(row.value),
      updatedAt: row.updated_at,
      confidence: row.confidence,
      sourceEventId: row.source_event_id || undefined,
      explicit: row.explicit === 1,
      expiresAt: row.expires_at || undefined,
    };
  }

  // Create instance object with self-reference for methods that call other methods
  const instance: ProfileStoreInstance = {
    // Delegate db operations
    setDatabase: ops.setDatabase,
    isInitialized: ops.isInitialized,
    close: ops.close,

    async initialize(): Promise<void> {
      const db = ops.getDb();

      db.exec(`
        CREATE TABLE IF NOT EXISTS profiles (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          confidence REAL NOT NULL DEFAULT 0.5,
          source_event_id TEXT,
          explicit INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_profiles_source_event_id ON profiles(source_event_id);
        CREATE INDEX IF NOT EXISTS idx_profiles_expires_at ON profiles(expires_at);
      `);

      ops.setInitialized(true);
    },

    async clear(): Promise<void> {
      const db = ops.getDb();
      db.exec('DELETE FROM profiles');
    },

    async set(input: ProfileItemInput): Promise<ProfileItem> {
      const db = ops.getDb();

      const item: ProfileItem = {
        key: input.key,
        value: input.value,
        updatedAt: ops.now(),
        confidence: input.confidence ?? 0.5,
        sourceEventId: input.sourceEventId,
        explicit: input.explicit ?? false,
        expiresAt: input.expiresAt,
      };

      try {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO profiles (
            key, value, updated_at, confidence, source_event_id, explicit, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          item.key,
          JSON.stringify(item.value),
          item.updatedAt,
          item.confidence,
          item.sourceEventId || null,
          item.explicit ? 1 : 0,
          item.expiresAt || null
        );

        return item;
      } catch (error) {
        throw new ProfileError(
          `Failed to set profile item: ${(error as Error).message}`,
          input.key,
          error as Error
        );
      }
    },

    async get(key: string): Promise<ProfileItem | null> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('SELECT * FROM profiles WHERE key = ?');
        const row = stmt.get(key) as ProfileRow | undefined;

        if (!row) return null;

        // Check expiration
        if (row.expires_at && row.expires_at < ops.now()) {
          // Item expired, delete and return null
          await instance.delete(key);
          return null;
        }

        return rowToProfileItem(row);
      } catch (error) {
        throw new DatabaseError('get', (error as Error).message, error as Error);
      }
    },

    async getAll(): Promise<ProfileItem[]> {
      const db = ops.getDb();

      try {
        const now = ops.now();
        const stmt = db.prepare(`
          SELECT * FROM profiles
          WHERE expires_at IS NULL OR expires_at > ?
        `);

        const rows = stmt.all(now) as ProfileRow[];
        return rows.map((row) => rowToProfileItem(row));
      } catch (error) {
        throw new DatabaseError('getAll', (error as Error).message, error as Error);
      }
    },

    async delete(key: string): Promise<boolean> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('DELETE FROM profiles WHERE key = ?');
        const result = stmt.run(key);
        return result.changes > 0;
      } catch (error) {
        throw new DatabaseError('delete', (error as Error).message, error as Error);
      }
    },

    async has(key: string): Promise<boolean> {
      const item = await instance.get(key);
      return item !== null;
    },

    async getBySourceEvent(eventId: UUID): Promise<ProfileItem[]> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('SELECT * FROM profiles WHERE source_event_id = ?');
        const rows = stmt.all(eventId) as ProfileRow[];
        return rows.map((row) => rowToProfileItem(row));
      } catch (error) {
        throw new DatabaseError('getBySourceEvent', (error as Error).message, error as Error);
      }
    },

    async cleanupExpired(): Promise<number> {
      const db = ops.getDb();

      try {
        const stmt = db.prepare('DELETE FROM profiles WHERE expires_at IS NOT NULL AND expires_at < ?');
        const result = stmt.run(ops.now());
        return result.changes;
      } catch (error) {
        throw new DatabaseError('cleanupExpired', (error as Error).message, error as Error);
      }
    },
  };

  return instance;
}
