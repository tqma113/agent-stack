/**
 * @ai-stack/assistant - Sync Engine
 *
 * Synchronizes Markdown files with SQLite index.
 */

import { existsSync } from 'fs';
import { watch, type FSWatcher } from 'chokidar';
import { parseMemoryFile, loadDailyLogs, getTodayDateString } from './markdown-parser.js';
import { writeDailyLogEntry } from './markdown-writer.js';
import type { SqliteIndexInstance } from './sqlite-index.js';
import type { MarkdownMemoryConfig, DailyLogEntry, SyncStatus, MemoryDocument } from './types.js';

/**
 * Sync Engine Instance
 */
export interface SyncEngineInstance {
  /** Initialize and perform initial sync */
  initialize(): Promise<void>;
  /** Close and cleanup */
  close(): Promise<void>;
  /** Force a full sync */
  sync(): Promise<SyncStatus>;
  /** Get sync status */
  getStatus(): SyncStatus;
  /** Watch for file changes */
  startWatching(): void;
  /** Stop watching */
  stopWatching(): void;
  /** Log a conversation entry */
  logEntry(entry: DailyLogEntry): Promise<void>;
  /** Get current memory document */
  getMemoryDocument(): MemoryDocument | null;
}

/**
 * Sync engine configuration
 */
export interface SyncEngineConfig {
  memoryFile: string;
  logsDir: string;
  index: SqliteIndexInstance;
  syncOnStartup?: boolean;
  watchFiles?: boolean;
  onSyncComplete?: (status: SyncStatus) => void;
  onSyncError?: (error: Error) => void;
}

/**
 * Create a sync engine instance
 */
export function createSyncEngine(config: SyncEngineConfig): SyncEngineInstance {
  let status: SyncStatus = {
    itemCount: 0,
    inProgress: false,
  };

  let watcher: FSWatcher | null = null;
  let memoryDoc: MemoryDocument | null = null;
  let syncDebounceTimer: NodeJS.Timeout | null = null;

  const {
    memoryFile,
    logsDir,
    index,
    syncOnStartup = true,
    watchFiles = true,
    onSyncComplete,
    onSyncError,
  } = config;

  /**
   * Perform full sync
   */
  async function performSync(): Promise<SyncStatus> {
    if (status.inProgress) {
      return status;
    }

    status = { ...status, inProgress: true, lastError: undefined };

    try {
      // Clear existing index
      await index.clear();

      let itemCount = 0;

      // Parse and index MEMORY.md
      if (existsSync(memoryFile)) {
        memoryDoc = parseMemoryFile(memoryFile);

        // Index facts
        for (const fact of memoryDoc.facts) {
          await index.indexFact(fact, memoryFile);
          itemCount++;
        }

        // Index todos
        for (const todo of memoryDoc.todos) {
          await index.indexTodo(todo, memoryFile);
          itemCount++;
        }

        // Index notes
        if (memoryDoc.notes) {
          await index.indexNote(memoryDoc.notes, memoryFile);
          itemCount++;
        }
      }

      // Load and index daily logs (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const logs = loadDailyLogs(logsDir, { from: thirtyDaysAgo });
      for (const log of logs) {
        for (const entry of log.entries) {
          await index.indexLogEntry(entry, log.date, `${logsDir}/${log.date}.md`);
          itemCount++;
        }
      }

      status = {
        lastSyncAt: new Date(),
        itemCount,
        inProgress: false,
      };

      onSyncComplete?.(status);
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      status = {
        ...status,
        inProgress: false,
        lastError: errorMessage,
      };

      if (error instanceof Error) {
        onSyncError?.(error);
      }

      return status;
    }
  }

  /**
   * Debounced sync for file changes
   */
  function debouncedSync(): void {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(() => {
      performSync().catch((error) => {
        console.error('Sync error:', error);
      });
    }, 500); // 500ms debounce
  }

  return {
    async initialize(): Promise<void> {
      // Initialize index
      await index.initialize();

      // Perform initial sync if configured
      if (syncOnStartup) {
        await performSync();
      }

      // Start watching if configured
      if (watchFiles) {
        this.startWatching();
      }
    },

    async close(): Promise<void> {
      this.stopWatching();

      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
        syncDebounceTimer = null;
      }

      await index.close();
    },

    async sync(): Promise<SyncStatus> {
      return performSync();
    },

    getStatus(): SyncStatus {
      return { ...status };
    },

    startWatching(): void {
      if (watcher) {
        return;
      }

      // Watch MEMORY.md and logs directory
      const watchPaths = [memoryFile, logsDir];

      watcher = watch(watchPaths, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      watcher.on('change', (path) => {
        // Only sync on relevant file changes
        if (path.endsWith('.md')) {
          debouncedSync();
        }
      });

      watcher.on('add', (path) => {
        if (path.endsWith('.md')) {
          debouncedSync();
        }
      });

      watcher.on('error', (error: unknown) => {
        console.error('Watcher error:', error);
        if (error instanceof Error) {
          onSyncError?.(error);
        }
      });
    },

    stopWatching(): void {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    },

    async logEntry(entry: DailyLogEntry): Promise<void> {
      // Write to daily log file
      writeDailyLogEntry(logsDir, entry);

      // Index immediately
      await index.indexLogEntry(entry, getTodayDateString(), `${logsDir}/${getTodayDateString()}.md`);

      // Update item count
      status = { ...status, itemCount: status.itemCount + 1 };
    },

    getMemoryDocument(): MemoryDocument | null {
      // Return cached doc or parse fresh
      if (!memoryDoc && existsSync(memoryFile)) {
        memoryDoc = parseMemoryFile(memoryFile);
      }
      return memoryDoc;
    },
  };
}
