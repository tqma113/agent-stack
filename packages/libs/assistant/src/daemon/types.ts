/**
 * @ai-stack/assistant - Daemon Types
 */

export type { DaemonStatus } from '../types.js';

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** PID file path */
  pidFile?: string;
  /** Log file path */
  logFile?: string;
  /** Health check interval (ms) */
  healthCheckInterval?: number;
}
