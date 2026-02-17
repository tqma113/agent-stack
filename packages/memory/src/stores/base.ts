/**
 * @agent-stack/memory - Base Store
 *
 * Base class for all memory stores with SQLite support.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { BaseStore } from '../types.js';

/**
 * Base store class with SQLite database support
 */
export abstract class SQLiteStore implements BaseStore {
  protected db: Database.Database | null = null;
  protected initialized = false;

  constructor(protected readonly storeName: string) {}

  /**
   * Set the database instance (called by MemoryManager)
   */
  setDatabase(db: Database.Database): void {
    this.db = db;
  }

  /**
   * Get the database instance
   */
  protected getDb(): Database.Database {
    if (!this.db) {
      throw new Error(`Database not set for ${this.storeName}`);
    }
    return this.db;
  }

  /**
   * Initialize the store (create tables, indexes, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Close the store
   */
  async close(): Promise<void> {
    this.initialized = false;
    // Database is managed by MemoryManager, not closed here
  }

  /**
   * Clear all data in this store
   */
  abstract clear(): Promise<void>;

  /**
   * Check if store is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate a UUID v4
   */
  protected generateId(): string {
    return randomUUID();
  }

  /**
   * Get current timestamp
   */
  protected now(): number {
    return Date.now();
  }
}
