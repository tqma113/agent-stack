/**
 * @ai-stack/assistant - Scheduler Types
 */

export type {
  SchedulerConfig,
  JobType,
  Job,
  JobSchedule,
  CronSchedule,
  ReminderSchedule,
  IntervalSchedule,
  WatcherSchedule,
  JobExecution,
  JobDelivery,
  JobRunResult,
} from '../types.js';

/**
 * Job creation input
 */
export interface CreateJobInput {
  name: string;
  type: JobType;
  schedule: JobSchedule;
  execution: JobExecution;
  delivery: JobDelivery;
  enabled?: boolean;
}

/**
 * Reminder creation input (simplified)
 */
export interface CreateReminderInput {
  /** When to trigger (Date or natural language like "in 5 minutes") */
  triggerAt: Date | string;
  /** Reminder message */
  message: string;
  /** Channels to deliver to */
  channels?: string[];
  /** Peer IDs to deliver to */
  peerIds?: string[];
}

/**
 * Cron job creation input (simplified)
 */
export interface CreateCronJobInput {
  name: string;
  /** Cron expression */
  expression: string;
  /** Timezone */
  timezone?: string;
  /** Prompt to execute */
  prompt: string;
  /** Channels to deliver to */
  channels?: string[];
}

import type { JobType, JobSchedule, JobExecution, JobDelivery } from '../types.js';
