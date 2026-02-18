/**
 * @ai-stack/memory-store-json - Factory
 *
 * Convenient factory function to create all JSON stores.
 */

import * as path from 'node:path';
import type {
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
} from '@ai-stack/memory-store-sqlite';
import { createJsonEventStore } from './stores/event.js';
import { createJsonTaskStateStore } from './stores/task-state.js';
import { createJsonSummaryStore } from './stores/summary.js';
import { createJsonProfileStore } from './stores/profile.js';
import { createJsonSemanticStore } from './stores/semantic.js';
import { ensureDir } from './utils/file-ops.js';

/**
 * Configuration for JSON stores
 */
export interface JsonStoresConfig {
  /**
   * Base path for all JSON storage files
   * @default '.ai-stack/memory'
   */
  basePath?: string;
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
 * Create all JSON stores with a single configuration
 *
 * @example
 * ```typescript
 * const stores = await createJsonStores({ basePath: './.agent-memory' });
 * await stores.initialize();
 *
 * // Use stores...
 * await stores.eventStore.add({ ... });
 *
 * // Cleanup
 * await stores.close();
 * ```
 */
export async function createJsonStores(config: JsonStoresConfig = {}): Promise<MemoryStores> {
  const basePath = config.basePath || '.ai-stack/memory';

  // Ensure base directory exists
  ensureDir(basePath);

  // Create all stores
  const eventStore = createJsonEventStore({ basePath });
  const taskStateStore = createJsonTaskStateStore({ basePath });
  const summaryStore = createJsonSummaryStore({ basePath });
  const profileStore = createJsonProfileStore({ basePath });
  const semanticStore = createJsonSemanticStore({ basePath });

  return {
    eventStore,
    taskStateStore,
    summaryStore,
    profileStore,
    semanticStore,

    async initialize(): Promise<void> {
      await Promise.all([
        eventStore.initialize(),
        taskStateStore.initialize(),
        summaryStore.initialize(),
        profileStore.initialize(),
        semanticStore.initialize(),
      ]);
    },

    async close(): Promise<void> {
      await Promise.all([
        eventStore.close(),
        taskStateStore.close(),
        summaryStore.close(),
        profileStore.close(),
        semanticStore.close(),
      ]);
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
