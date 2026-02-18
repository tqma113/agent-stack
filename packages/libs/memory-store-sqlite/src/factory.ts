/**
 * @agent-stack/memory-store-sqlite - Factory
 *
 * Convenient factory function to create all SQLite stores.
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
} from './types.js';
import { createEventStore, type EventStoreInstance } from './stores/event.js';
import { createTaskStateStore, type TaskStateStoreInstance } from './stores/task-state.js';
import { createSummaryStore, type SummaryStoreInstance } from './stores/summary.js';
import { createProfileStore, type ProfileStoreInstance } from './stores/profile.js';
import { createSemanticStore, type SemanticStoreInstance, type SemanticStoreConfig } from './stores/semantic.js';
import { StoreInitializationError } from './errors.js';

/**
 * Configuration for SQLite stores
 */
export interface SqliteStoresConfig {
  /**
   * Path to the SQLite database file
   * @default '.agent-stack/memory.db'
   */
  dbPath?: string;

  /**
   * Semantic store configuration (optional)
   */
  semanticConfig?: Partial<SemanticStoreConfig>;
}

/**
 * Memory stores collection
 */
export interface MemoryStores {
  eventStore: IEventStore;
  taskStateStore: ITaskStateStore;
  summaryStore: ISummaryStore;
  profileStore: IProfileStore;
  semanticStore: ISemanticStore;

  /** Initialize all stores */
  initialize(): Promise<void>;

  /** Close all stores */
  close(): Promise<void>;

  /** Clear all stores */
  clear(): Promise<void>;
}

/**
 * Extended stores with SQLite-specific features
 */
export interface SqliteMemoryStores extends MemoryStores {
  /** Get the underlying database instance */
  getDatabase(): Database.Database;

  /** Extended event store with setDatabase */
  eventStore: EventStoreInstance;

  /** Extended task state store with setDatabase */
  taskStateStore: TaskStateStoreInstance;

  /** Extended summary store with setDatabase */
  summaryStore: SummaryStoreInstance;

  /** Extended profile store with setDatabase */
  profileStore: ProfileStoreInstance;

  /** Extended semantic store with setDatabase */
  semanticStore: SemanticStoreInstance;
}

/**
 * Create all SQLite stores with a single configuration
 *
 * @example
 * ```typescript
 * const stores = await createSqliteStores({ dbPath: './memory.db' });
 * await stores.initialize();
 *
 * // Use stores...
 * await stores.eventStore.add({ ... });
 *
 * // Cleanup
 * await stores.close();
 * ```
 */
export async function createSqliteStores(config: SqliteStoresConfig = {}): Promise<SqliteMemoryStores> {
  const dbPath = config.dbPath || '.agent-stack/memory.db';

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  let db: Database.Database | null = null;

  // Create all stores
  const eventStore = createEventStore();
  const taskStateStore = createTaskStateStore();
  const summaryStore = createSummaryStore();
  const profileStore = createProfileStore();
  const semanticStore = createSemanticStore(config.semanticConfig);

  return {
    eventStore,
    taskStateStore,
    summaryStore,
    profileStore,
    semanticStore,

    getDatabase(): Database.Database {
      if (!db) {
        throw new StoreInitializationError('SqliteStores', 'Database not initialized. Call initialize() first.');
      }
      return db;
    },

    async initialize(): Promise<void> {
      try {
        // Open database
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        // Set database for all stores
        const stores = [
          eventStore,
          taskStateStore,
          summaryStore,
          profileStore,
          semanticStore,
        ];

        for (const store of stores) {
          store.setDatabase(db);
          await store.initialize();
        }
      } catch (error) {
        throw new StoreInitializationError(
          'SqliteStores',
          (error as Error).message,
          error as Error
        );
      }
    },

    async close(): Promise<void> {
      await Promise.all([
        eventStore.close(),
        taskStateStore.close(),
        summaryStore.close(),
        profileStore.close(),
        semanticStore.close(),
      ]);

      if (db) {
        db.close();
        db = null;
      }
    },

    async clear(): Promise<void> {
      await Promise.all([
        eventStore.clear(),
        taskStateStore.clear(),
        summaryStore.clear(),
        profileStore.clear(),
        semanticStore.clear(),
      ]);
    },
  };
}
