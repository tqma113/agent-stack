/**
 * @ai-stack/assistant - Watcher
 *
 * File/event watcher-based scheduling.
 */

import { watch, type FSWatcher } from 'chokidar';
import type { WatcherSchedule } from './types.js';

/**
 * Watcher Instance
 */
export interface WatcherInstance {
  /** Start watching */
  start(): void;
  /** Stop watching */
  stop(): void;
  /** Check if watching */
  isWatching(): boolean;
  /** Get watched patterns */
  getPatterns(): string[];
}

/**
 * Create a file watcher
 */
export function createWatcher(
  schedule: WatcherSchedule,
  onTrigger: (path: string, event: string) => void
): WatcherInstance {
  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  const debounceMs = schedule.debounceMs || 500;

  // Track pending events for debouncing
  const pendingEvents: Array<{ path: string; event: string }> = [];

  function processPendingEvents(): void {
    if (pendingEvents.length === 0) return;

    // Get unique events (dedupe by path)
    const uniqueEvents = new Map<string, string>();
    for (const { path, event } of pendingEvents) {
      uniqueEvents.set(path, event);
    }

    pendingEvents.length = 0;

    // Trigger for each unique path
    for (const [path, event] of uniqueEvents) {
      onTrigger(path, event);
    }
  }

  function debouncedTrigger(path: string, event: string): void {
    pendingEvents.push({ path, event });

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(processPendingEvents, debounceMs);
  }

  return {
    start(): void {
      if (watcher) return;

      watcher = watch(schedule.patterns, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100,
        },
      });

      watcher.on('add', (path) => debouncedTrigger(path, 'add'));
      watcher.on('change', (path) => debouncedTrigger(path, 'change'));
      watcher.on('unlink', (path) => debouncedTrigger(path, 'unlink'));
    },

    stop(): void {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      pendingEvents.length = 0;
    },

    isWatching(): boolean {
      return watcher !== null;
    },

    getPatterns(): string[] {
      return schedule.patterns;
    },
  };
}

/**
 * Create a WatcherSchedule
 */
export function createWatcherSchedule(patterns: string[], debounceMs?: number): WatcherSchedule {
  return {
    type: 'watcher',
    patterns,
    debounceMs,
  };
}
