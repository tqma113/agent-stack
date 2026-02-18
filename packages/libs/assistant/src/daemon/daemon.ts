/**
 * @ai-stack/assistant - Daemon
 *
 * Background process management.
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { DaemonConfig, DaemonStatus } from './types.js';

/**
 * Daemon Instance
 */
export interface DaemonInstance {
  /** Get daemon status */
  getStatus(): DaemonStatus;
  /** Write PID file */
  writePidFile(): void;
  /** Remove PID file */
  removePidFile(): void;
  /** Check if daemon is running */
  isRunning(): boolean;
  /** Log a message */
  log(message: string): void;
  /** Get recent logs */
  getLogs(lines?: number): string[];
  /** Health check */
  healthCheck(): void;
  /** Start health check timer */
  startHealthCheck(): void;
  /** Stop health check timer */
  stopHealthCheck(): void;
}

/**
 * Create a daemon manager
 */
export function createDaemon(config: DaemonConfig = {}): DaemonInstance {
  const {
    pidFile = 'daemon.pid',
    logFile = 'daemon.log',
    healthCheckInterval = 30000, // 30 seconds
  } = config;

  let healthCheckTimer: NodeJS.Timeout | null = null;
  let lastHealthCheck: Date | null = null;
  let startedAt: Date | null = null;
  let connectedChannels: string[] = [];
  let activeJobs = 0;

  // Ensure directories exist
  function ensureDir(filePath: string): void {
    const dir = dirname(filePath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  return {
    getStatus(): DaemonStatus {
      const isRunning = this.isRunning();

      if (!isRunning) {
        return { running: false };
      }

      const pid = existsSync(pidFile)
        ? parseInt(readFileSync(pidFile, 'utf-8').trim(), 10)
        : undefined;

      const uptime = startedAt
        ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
        : undefined;

      return {
        running: true,
        pid,
        uptime,
        startedAt: startedAt || undefined,
        connectedChannels,
        activeJobs,
        lastHealthCheck: lastHealthCheck || undefined,
      };
    },

    writePidFile(): void {
      ensureDir(pidFile);
      writeFileSync(pidFile, String(process.pid), 'utf-8');
      startedAt = new Date();
    },

    removePidFile(): void {
      if (existsSync(pidFile)) {
        unlinkSync(pidFile);
      }
    },

    isRunning(): boolean {
      if (!existsSync(pidFile)) {
        return false;
      }

      try {
        const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);

        // Check if process is running
        process.kill(pid, 0);
        return true;
      } catch {
        // Process not running, clean up stale PID file
        if (existsSync(pidFile)) {
          unlinkSync(pidFile);
        }
        return false;
      }
    },

    log(message: string): void {
      ensureDir(logFile);
      const timestamp = new Date().toISOString();
      const line = `[${timestamp}] ${message}\n`;
      appendFileSync(logFile, line);
    },

    getLogs(lines: number = 50): string[] {
      if (!existsSync(logFile)) {
        return [];
      }

      const content = readFileSync(logFile, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    },

    healthCheck(): void {
      lastHealthCheck = new Date();
      this.log('Health check: OK');
    },

    startHealthCheck(): void {
      if (healthCheckTimer) return;

      healthCheckTimer = setInterval(() => {
        this.healthCheck();
      }, healthCheckInterval);

      // Initial check
      this.healthCheck();
    },

    stopHealthCheck(): void {
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
      }
    },
  };
}

/**
 * Update daemon metrics (called by assistant)
 */
export function updateDaemonMetrics(
  daemon: DaemonInstance,
  metrics: {
    connectedChannels?: string[];
    activeJobs?: number;
  }
): void {
  // This is a bit hacky but allows updating internal state
  const status = daemon.getStatus();
  if (metrics.connectedChannels !== undefined) {
    (daemon as any).connectedChannels = metrics.connectedChannels;
  }
  if (metrics.activeJobs !== undefined) {
    (daemon as any).activeJobs = metrics.activeJobs;
  }
}
