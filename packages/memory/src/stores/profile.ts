/**
 * @agent-stack/memory - Profile Store
 *
 * Stores user preferences and profile data.
 */

import type { IProfileStore, ProfileItem, ProfileItemInput, UUID } from '../types.js';
import { SQLiteStore } from './base.js';
import { ProfileError, DatabaseError } from '../errors.js';

/**
 * SQLite-based profile store for user preferences
 */
export class ProfileStore extends SQLiteStore implements IProfileStore {
  constructor() {
    super('ProfileStore');
  }

  async initialize(): Promise<void> {
    const db = this.getDb();

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

    this.initialized = true;
  }

  async clear(): Promise<void> {
    const db = this.getDb();
    db.exec('DELETE FROM profiles');
  }

  async set(input: ProfileItemInput): Promise<ProfileItem> {
    const db = this.getDb();

    const item: ProfileItem = {
      key: input.key,
      value: input.value,
      updatedAt: this.now(),
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
  }

  async get(key: string): Promise<ProfileItem | null> {
    const db = this.getDb();

    try {
      const stmt = db.prepare('SELECT * FROM profiles WHERE key = ?');
      const row = stmt.get(key) as ProfileRow | undefined;

      if (!row) return null;

      // Check expiration
      if (row.expires_at && row.expires_at < this.now()) {
        // Item expired, delete and return null
        await this.delete(key);
        return null;
      }

      return this.rowToProfileItem(row);
    } catch (error) {
      throw new DatabaseError('get', (error as Error).message, error as Error);
    }
  }

  async getAll(): Promise<ProfileItem[]> {
    const db = this.getDb();

    try {
      const now = this.now();
      const stmt = db.prepare(`
        SELECT * FROM profiles
        WHERE expires_at IS NULL OR expires_at > ?
      `);

      const rows = stmt.all(now) as ProfileRow[];
      return rows.map((row) => this.rowToProfileItem(row));
    } catch (error) {
      throw new DatabaseError('getAll', (error as Error).message, error as Error);
    }
  }

  async delete(key: string): Promise<boolean> {
    const db = this.getDb();

    try {
      const stmt = db.prepare('DELETE FROM profiles WHERE key = ?');
      const result = stmt.run(key);
      return result.changes > 0;
    } catch (error) {
      throw new DatabaseError('delete', (error as Error).message, error as Error);
    }
  }

  async has(key: string): Promise<boolean> {
    const item = await this.get(key);
    return item !== null;
  }

  async getBySourceEvent(eventId: UUID): Promise<ProfileItem[]> {
    const db = this.getDb();

    try {
      const stmt = db.prepare('SELECT * FROM profiles WHERE source_event_id = ?');
      const rows = stmt.all(eventId) as ProfileRow[];
      return rows.map((row) => this.rowToProfileItem(row));
    } catch (error) {
      throw new DatabaseError('getBySourceEvent', (error as Error).message, error as Error);
    }
  }

  /**
   * Clean up expired items
   */
  async cleanupExpired(): Promise<number> {
    const db = this.getDb();

    try {
      const stmt = db.prepare('DELETE FROM profiles WHERE expires_at IS NOT NULL AND expires_at < ?');
      const result = stmt.run(this.now());
      return result.changes;
    } catch (error) {
      throw new DatabaseError('cleanupExpired', (error as Error).message, error as Error);
    }
  }

  /**
   * Convert database row to ProfileItem
   */
  private rowToProfileItem(row: ProfileRow): ProfileItem {
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
}

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
