/**
 * File Watcher
 *
 * Watches for file changes and triggers incremental indexing.
 */

import { watch, type FSWatcher } from 'chokidar';
import type { CodeIndexerConfig } from '../types.js';

/**
 * File change event
 */
export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  filePath: string;
  timestamp: number;
}

/**
 * Watcher callback
 */
export type WatcherCallback = (events: FileChangeEvent[]) => void | Promise<void>;

/**
 * Watcher instance interface
 */
export interface WatcherInstance {
  /** Start watching */
  start(): void;

  /** Stop watching */
  stop(): Promise<void>;

  /** Check if watching */
  isWatching(): boolean;

  /** Get pending changes */
  getPendingChanges(): FileChangeEvent[];

  /** Clear pending changes */
  clearPendingChanges(): void;
}

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  /** Root directory */
  rootDir: string;
  /** Include patterns */
  include: string[];
  /** Exclude patterns */
  exclude: string[];
  /** Debounce delay (ms) */
  debounceMs: number;
  /** Callback for batched changes */
  onChanges?: WatcherCallback;
}

/**
 * Create a file watcher
 */
export function createWatcher(config: WatcherConfig): WatcherInstance {
  let watcher: FSWatcher | null = null;
  let isActive = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingChanges: FileChangeEvent[] = [];

  /**
   * Add a change event
   */
  function addChange(type: FileChangeEvent['type'], filePath: string): void {
    // Remove any existing event for the same file
    const existingIndex = pendingChanges.findIndex((e) => e.filePath === filePath);
    if (existingIndex !== -1) {
      pendingChanges.splice(existingIndex, 1);
    }

    pendingChanges.push({
      type,
      filePath,
      timestamp: Date.now(),
    });

    // Debounce callback
    if (config.onChanges) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(async () => {
        const changes = [...pendingChanges];
        pendingChanges.length = 0;

        try {
          await config.onChanges!(changes);
        } catch (error) {
          console.error('[Watcher] Error in callback:', error);
        }
      }, config.debounceMs);
    }
  }

  /**
   * Start watching
   */
  function start(): void {
    if (isActive) return;

    const watchPatterns = config.include.map((pattern) => {
      if (pattern.startsWith('/') || pattern.startsWith('./')) {
        return pattern;
      }
      return `${config.rootDir}/${pattern}`;
    });

    watcher = watch(watchPatterns, {
      ignored: config.exclude,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    watcher
      .on('add', (path) => addChange('add', path))
      .on('change', (path) => addChange('change', path))
      .on('unlink', (path) => addChange('unlink', path))
      .on('error', (error) => console.error('[Watcher] Error:', error));

    isActive = true;
  }

  /**
   * Stop watching
   */
  async function stop(): Promise<void> {
    if (!isActive || !watcher) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    await watcher.close();
    watcher = null;
    isActive = false;
  }

  /**
   * Check if watching
   */
  function isWatching(): boolean {
    return isActive;
  }

  /**
   * Get pending changes
   */
  function getPendingChanges(): FileChangeEvent[] {
    return [...pendingChanges];
  }

  /**
   * Clear pending changes
   */
  function clearPendingChanges(): void {
    pendingChanges.length = 0;
  }

  return {
    start,
    stop,
    isWatching,
    getPendingChanges,
    clearPendingChanges,
  };
}

/**
 * Create watcher config from code indexer config
 */
export function createWatcherConfig(
  indexerConfig: CodeIndexerConfig,
  onChanges?: WatcherCallback
): WatcherConfig {
  return {
    rootDir: indexerConfig.rootDir,
    include: indexerConfig.include || ['**/*'],
    exclude: indexerConfig.exclude || [],
    debounceMs: indexerConfig.watchDebounceMs || 1000,
    onChanges,
  };
}
