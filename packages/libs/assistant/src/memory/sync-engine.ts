/**
 * @ai-stack/assistant - Sync Engine
 *
 * Synchronizes Markdown files with SQLite index.
 * Supports incremental indexing based on file content hash.
 * Optional vector indexing via SemanticStore integration.
 */

import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { watch, type FSWatcher } from 'chokidar';
import { parseMemoryFile, loadDailyLogs, getTodayDateString, parseDailyLogFile } from './markdown-parser.js';
import { writeDailyLogEntry } from './markdown-writer.js';
import { getFileMetadata, type FileMetadata } from './hash-utils.js';
import type { SqliteIndexInstance } from './sqlite-index.js';
import type { DailyLogEntry, SyncStatus, MemoryDocument } from './types.js';
import type { SemanticStoreInstance, EmbedFunction } from '@ai-stack/memory-store-sqlite';

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
  // Vector search integration
  semanticStore?: SemanticStoreInstance;
  embedFunction?: EmbedFunction;
  embeddingProvider?: string;
  embeddingModel?: string;
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
    // Vector search
    semanticStore,
    embedFunction,
    embeddingProvider = 'default',
    embeddingModel = 'default',
  } = config;

  /**
   * Index content to semantic store (vector search)
   */
  async function indexToSemanticStore(
    id: string,
    text: string,
    type: 'fact' | 'todo' | 'log' | 'note',
    source: string
  ): Promise<void> {
    if (!semanticStore) return;

    try {
      await semanticStore.add({
        text,
        tags: [type],
        sourceType: type,
        metadata: {
          id,
          type,
          source,
        },
      });
    } catch (error) {
      console.warn(`[SyncEngine] Failed to index to semantic store: ${(error as Error).message}`);
    }
  }

  /**
   * Index a single memory file (MEMORY.md)
   */
  async function indexMemoryFile(filePath: string): Promise<number> {
    let itemCount = 0;

    memoryDoc = parseMemoryFile(filePath);

    // Index facts
    for (const fact of memoryDoc.facts) {
      await index.indexFact(fact, filePath);
      // Index to semantic store for vector search
      await indexToSemanticStore(fact.id, fact.content, 'fact', filePath);
      itemCount++;
    }

    // Index todos
    for (const todo of memoryDoc.todos) {
      await index.indexTodo(todo, filePath);
      // Index to semantic store for vector search
      await indexToSemanticStore(todo.id, todo.content, 'todo', filePath);
      itemCount++;
    }

    // Index notes
    if (memoryDoc.notes) {
      await index.indexNote(memoryDoc.notes, filePath);
      // Index to semantic store for vector search
      await indexToSemanticStore(`note-${Date.now()}`, memoryDoc.notes, 'note', filePath);
      itemCount++;
    }

    return itemCount;
  }

  /**
   * Index a single daily log file
   */
  async function indexLogFile(filePath: string): Promise<number> {
    let itemCount = 0;

    const log = parseDailyLogFile(filePath);
    if (log) {
      for (const entry of log.entries) {
        await index.indexLogEntry(entry, log.date, filePath);
        // Index to semantic store for vector search
        await indexToSemanticStore(`log-${entry.timestamp.getTime()}`, entry.content, 'log', filePath);
        itemCount++;
      }
    }

    return itemCount;
  }

  /**
   * Get all log files within date range
   */
  function getLogFilesInRange(): string[] {
    if (!existsSync(logsDir)) {
      return [];
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return readdirSync(logsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .map((f) => {
        const date = f.replace('.md', '');
        const fileDate = new Date(date);
        return { file: join(logsDir, f), date: fileDate };
      })
      .filter(({ date }) => date >= thirtyDaysAgo)
      .map(({ file }) => file);
  }

  /**
   * Perform incremental sync - only reindex changed files
   */
  async function performSync(forceFullReindex = false): Promise<SyncStatus> {
    if (status.inProgress) {
      return status;
    }

    status = { ...status, inProgress: true, lastError: undefined };

    try {
      let itemCount = 0;
      let filesChecked = 0;
      let filesReindexed = 0;
      let filesSkipped = 0;

      // Collect all files to check
      const filesToCheck: string[] = [];

      // Add MEMORY.md if exists
      if (existsSync(memoryFile)) {
        filesToCheck.push(memoryFile);
      }

      // Add daily log files within range
      filesToCheck.push(...getLogFilesInRange());

      // Get currently tracked files to detect deletions
      const trackedFiles = new Set(await index.getTrackedFiles());

      // Process each file
      for (const filePath of filesToCheck) {
        filesChecked++;

        // Get current file metadata
        const currentMetadata = getFileMetadata(filePath);
        if (!currentMetadata) {
          continue; // File doesn't exist or can't be read
        }

        // Check if file needs reindexing
        const needsReindex = forceFullReindex || await index.needsReindex(filePath, currentMetadata.hash);

        if (needsReindex) {
          // Delete old entries for this file
          await index.deleteFileEntries(filePath);

          // Delete old entries from semantic store
          if (semanticStore) {
            try {
              await semanticStore.deleteByMetadata([{ key: 'source', value: filePath }]);
            } catch {
              // Ignore errors cleaning up semantic store
            }
          }

          // Reindex the file
          if (filePath === memoryFile) {
            itemCount += await indexMemoryFile(filePath);
          } else {
            itemCount += await indexLogFile(filePath);
          }

          // Update file metadata
          await index.updateFileMetadata(currentMetadata);

          filesReindexed++;
        } else {
          // File unchanged, count existing entries
          const existingCount = await index.getCount();
          itemCount = existingCount; // Approximate - entries from unchanged files
          filesSkipped++;
        }

        // Remove from tracked set (remaining are deleted files)
        trackedFiles.delete(filePath);
      }

      // Clean up entries from deleted files
      for (const deletedFile of trackedFiles) {
        await index.deleteFileEntries(deletedFile);
      }

      // Get final item count
      const finalCount = await index.getCount();

      status = {
        lastSyncAt: new Date(),
        itemCount: finalCount,
        inProgress: false,
        filesChecked,
        filesReindexed,
        filesSkipped,
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
