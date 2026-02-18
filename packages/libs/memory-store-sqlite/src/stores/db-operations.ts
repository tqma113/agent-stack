/**
 * @ai-stack/memory-store-sqlite - Database Operations
 *
 * Shared database operations for all stores.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';

/**
 * Database operations instance type
 */
export interface DbOperationsInstance {
  /** Set the database instance (called by MemoryManager) */
  setDatabase(db: Database.Database): void;
  /** Get the database instance */
  getDb(): Database.Database;
  /** Check if store is initialized */
  isInitialized(): boolean;
  /** Set initialized flag */
  setInitialized(value: boolean): void;
  /** Generate a UUID v4 */
  generateId(): string;
  /** Get current timestamp */
  now(): number;
  /** Close the store */
  close(): Promise<void>;
}

/**
 * Create shared database operations for a store
 */
export function createDbOperations(storeName: string): DbOperationsInstance {
  // Private state via closure
  let db: Database.Database | null = null;
  let initialized = false;

  return {
    setDatabase(database: Database.Database): void {
      db = database;
    },

    getDb(): Database.Database {
      if (!db) {
        throw new Error(`Database not set for ${storeName}`);
      }
      return db;
    },

    isInitialized(): boolean {
      return initialized;
    },

    setInitialized(value: boolean): void {
      initialized = value;
    },

    generateId(): string {
      return randomUUID();
    },

    now(): number {
      return Date.now();
    },

    async close(): Promise<void> {
      initialized = false;
      // Database is managed by the caller, not closed here
    },
  };
}
