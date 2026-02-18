/**
 * @agent-stack/skill-memory - Store Context
 *
 * Manages database connection and store instances.
 * Implements singleton pattern for shared access.
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createEventStore,
  createTaskStateStore,
  createSummaryStore,
  createProfileStore,
  createSemanticStore,
  type EventStoreInstance,
  type TaskStateStoreInstance,
  type SummaryStoreInstance,
  type ProfileStoreInstance,
  type SemanticStoreInstance,
} from '@agent-stack/memory-store';

/**
 * Store context configuration
 */
export interface StoreContextConfig {
  /** Database file path */
  dbPath: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StoreContextConfig = {
  dbPath: '.agent-stack/memory.db',
  debug: false,
};

/**
 * Store context instance
 */
export interface StoreContext {
  /** Event store */
  events: EventStoreInstance;
  /** Task state store */
  tasks: TaskStateStoreInstance;
  /** Summary store */
  summaries: SummaryStoreInstance;
  /** Profile store */
  profiles: ProfileStoreInstance;
  /** Semantic store */
  semantic: SemanticStoreInstance;
  /** Close all stores */
  close(): Promise<void>;
  /** Check if initialized */
  isInitialized(): boolean;
}

// Singleton instance
let instance: StoreContext | null = null;
let db: Database.Database | null = null;

/**
 * Get or create the store context (singleton)
 */
export async function getStoreContext(
  config: Partial<StoreContextConfig> = {}
): Promise<StoreContext> {
  if (instance) {
    return instance;
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Ensure directory exists
  const dbDir = path.dirname(mergedConfig.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Open database
  db = new Database(mergedConfig.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create stores
  const events = createEventStore();
  const tasks = createTaskStateStore();
  const summaries = createSummaryStore();
  const profiles = createProfileStore();
  const semantic = createSemanticStore();

  // Initialize stores with database
  events.setDatabase(db);
  tasks.setDatabase(db);
  summaries.setDatabase(db);
  profiles.setDatabase(db);
  semantic.setDatabase(db);

  await events.initialize();
  await tasks.initialize();
  await summaries.initialize();
  await profiles.initialize();
  await semantic.initialize();

  if (mergedConfig.debug) {
    console.log(`[StoreContext] Initialized with database: ${mergedConfig.dbPath}`);
  }

  instance = {
    events,
    tasks,
    summaries,
    profiles,
    semantic,

    async close(): Promise<void> {
      await events.close();
      await tasks.close();
      await summaries.close();
      await profiles.close();
      await semantic.close();

      if (db) {
        db.close();
        db = null;
      }

      instance = null;

      if (mergedConfig.debug) {
        console.log('[StoreContext] Closed');
      }
    },

    isInitialized(): boolean {
      return (
        events.isInitialized() &&
        tasks.isInitialized() &&
        summaries.isInitialized() &&
        profiles.isInitialized() &&
        semantic.isInitialized()
      );
    },
  };

  return instance;
}

/**
 * Close the store context if open
 */
export async function closeStoreContext(): Promise<void> {
  if (instance) {
    await instance.close();
  }
}

/**
 * Reset the singleton (for testing)
 */
export function resetStoreContext(): void {
  if (db) {
    db.close();
    db = null;
  }
  instance = null;
}
