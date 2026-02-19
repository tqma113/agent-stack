/**
 * @ai-stack/memory-store-sqlite - Database Factory
 *
 * Provides factory functions for creating and configuring SQLite databases
 * with WAL mode and sqlite-vec extension support.
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  /** Path to the SQLite database file */
  path: string;
  /** Enable WAL (Write-Ahead Logging) mode (default: true) */
  wal?: boolean;
  /** Enable foreign key constraints (default: true) */
  foreignKeys?: boolean;
  /** Enable sqlite-vec extension for vector search (default: false) */
  enableVec?: boolean;
  /** Verbose mode for debugging */
  verbose?: boolean;
}

/**
 * Database instance wrapper with metadata
 */
export interface DatabaseInstance {
  /** The underlying better-sqlite3 database */
  db: DatabaseType;
  /** Whether sqlite-vec is enabled */
  vecEnabled: boolean;
  /** Close the database connection */
  close(): void;
}

/**
 * Create a configured SQLite database instance
 *
 * @param config - Database configuration options
 * @returns DatabaseInstance with the configured database
 *
 * @example
 * ```typescript
 * import { createDatabase } from '@ai-stack/memory-store-sqlite';
 *
 * const { db, vecEnabled, close } = createDatabase({
 *   path: 'data/sqlite.db',
 *   enableVec: true,
 * });
 *
 * // Use db for queries...
 *
 * close(); // Clean up when done
 * ```
 */
export function createDatabase(config: DatabaseConfig): DatabaseInstance {
  const { path, wal = true, foreignKeys = true, enableVec = false, verbose = false } = config;

  // Create database instance
  const db = new Database(path, { verbose: verbose ? console.log : undefined });

  // Configure pragmas
  if (wal) {
    db.pragma('journal_mode = WAL');
  }

  if (foreignKeys) {
    db.pragma('foreign_keys = ON');
  }

  // Try to load sqlite-vec extension if requested
  let vecEnabled = false;
  if (enableVec) {
    try {
      // Dynamic import is handled at the call site since this is synchronous
      // The caller should use loadVecExtension() after creating the database
      vecEnabled = false; // Will be set to true after loadVecExtension() is called
    } catch {
      // sqlite-vec not available
      vecEnabled = false;
    }
  }

  return {
    db,
    vecEnabled,
    close: () => db.close(),
  };
}

/**
 * Load the sqlite-vec extension into a database
 *
 * @param db - The better-sqlite3 database instance
 * @returns true if sqlite-vec was loaded successfully, false otherwise
 *
 * @example
 * ```typescript
 * import { createDatabase, loadVecExtension } from '@ai-stack/memory-store-sqlite';
 *
 * const { db } = createDatabase({ path: 'data/sqlite.db' });
 * const vecEnabled = await loadVecExtension(db);
 *
 * if (vecEnabled) {
 *   // Vector search is available
 * }
 * ```
 */
export async function loadVecExtension(db: DatabaseType): Promise<boolean> {
  try {
    const sqliteVec = await import('sqlite-vec');
    sqliteVec.load(db);
    return true;
  } catch (error) {
    console.warn('[Database] sqlite-vec not available:', (error as Error).message);
    return false;
  }
}

/**
 * Re-export the Database type for use in other packages
 */
export type { Database as DatabaseType } from 'better-sqlite3';
