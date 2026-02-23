/**
 * @ai-stack/assistant - Scheduler
 *
 * Main scheduler that manages all scheduled jobs.
 */

import type {
  SchedulerConfig,
  Job,
  JobSchedule,
  JobRunResult,
  CreateJobInput,
  CreateReminderInput,
  CreateCronJobInput,
} from './types.js';
import { createTaskQueue, type TaskQueueInstance } from './task-queue.js';
import { getNextCronTime, describeCronSchedule, createCronSchedule } from './cron-job.js';
import { createReminderSchedule, formatReminder, parseNaturalTime } from './reminder.js';
import { createWatcher, type WatcherInstance, createWatcherSchedule } from './watcher.js';

/**
 * Job executor function type
 */
export type JobExecutor = (job: Job) => Promise<string>;

/**
 * Scheduler Instance
 */
export interface SchedulerInstance {
  /** Initialize the scheduler */
  initialize(): Promise<void>;
  /** Close the scheduler */
  close(): Promise<void>;

  /** Set the job executor */
  setExecutor(executor: JobExecutor): void;

  /** Start the scheduler */
  start(): void;
  /** Stop the scheduler */
  stop(): void;
  /** Check if running */
  isRunning(): boolean;

  // Job Management
  /** Create a job */
  createJob(input: CreateJobInput): Job;
  /** Create a reminder (simplified) */
  createReminder(input: CreateReminderInput): Job;
  /** Create a cron job (simplified) */
  createCronJob(input: CreateCronJobInput): Job;
  /** Get a job */
  getJob(jobId: string): Job | null;
  /** Get all jobs */
  getAllJobs(): Job[];
  /** Update a job */
  updateJob(jobId: string, update: Partial<Job>): boolean;
  /** Delete a job */
  deleteJob(jobId: string): boolean;
  /** Enable/disable a job */
  setJobEnabled(jobId: string, enabled: boolean): boolean;

  // Run History
  /** Get run history */
  getRunHistory(jobId?: string, limit?: number): JobRunResult[];

  // Tools for Agent
  /** Get tools for agent to control scheduler */
  getAgentTools(): AgentSchedulerTool[];
}

/**
 * Agent tool definition for scheduler
 */
export interface AgentSchedulerTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Create a scheduler instance
 */
export function createScheduler(config: SchedulerConfig = {}): SchedulerInstance {
  const {
    enabled = true,
    allowAgentControl = true,
    persistencePath = 'scheduler/jobs.json',
  } = config;

  const taskQueue = createTaskQueue(persistencePath);
  const watchers = new Map<string, WatcherInstance>();
  let executor: JobExecutor | null = null;
  let running = false;
  let checkInterval: NodeJS.Timeout | null = null;

  /**
   * Generate a unique job ID
   */
  function generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Calculate next run time for a job
   */
  function calculateNextRun(schedule: JobSchedule): Date | null {
    switch (schedule.type) {
      case 'cron':
        return getNextCronTime(schedule);
      case 'reminder':
        return schedule.triggerAt;
      case 'interval':
        return new Date(Date.now() + schedule.intervalMs);
      case 'watcher':
        return null; // Event-driven, no scheduled time
      default:
        return null;
    }
  }

  /**
   * Check and run due jobs
   */
  async function checkDueJobs(): Promise<void> {
    if (!executor) return;

    const now = Date.now();
    const jobs = taskQueue.getAllJobs();

    for (const job of jobs) {
      if (!job.enabled) continue;
      if (job.schedule.type === 'watcher') continue; // Handled by file watcher
      if (!job.nextRunAt) continue;

      if (job.nextRunAt.getTime() <= now) {
        await runJob(job);
      }
    }
  }

  /**
   * Run a job
   */
  async function runJob(job: Job): Promise<void> {
    if (!executor) return;

    const startTime = Date.now();
    let success = false;
    let output: string | undefined;
    let error: string | undefined;

    try {
      output = await executor(job);
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const duration = Date.now() - startTime;

    // Log the run
    taskQueue.logRun({
      jobId: job.id,
      success,
      output,
      error,
      duration,
      timestamp: new Date(),
    });

    // Update job
    const nextRun = calculateNextRun(job.schedule);

    // For one-time reminders, disable after run
    if (job.schedule.type === 'reminder') {
      taskQueue.updateJob(job.id, {
        lastRunAt: new Date(),
        nextRunAt: undefined,
        enabled: false,
      });
    } else if (nextRun) {
      taskQueue.updateJob(job.id, {
        lastRunAt: new Date(),
        nextRunAt: nextRun,
      });
    }
  }

  /**
   * Start watcher for a job
   */
  function startWatcher(job: Job): void {
    if (job.schedule.type !== 'watcher') return;
    if (watchers.has(job.id)) return;

    const watcher = createWatcher(job.schedule, async () => {
      await runJob(job);
    });

    watcher.start();
    watchers.set(job.id, watcher);
  }

  /**
   * Stop watcher for a job
   */
  function stopWatcher(jobId: string): void {
    const watcher = watchers.get(jobId);
    if (watcher) {
      watcher.stop();
      watchers.delete(jobId);
    }
  }

  const instance: SchedulerInstance = {
    async initialize(): Promise<void> {
      // Load existing jobs
      taskQueue.load();

      // Recalculate next run times for cron jobs
      for (const job of taskQueue.getAllJobs()) {
        if (job.enabled && job.schedule.type === 'cron') {
          const nextRun = calculateNextRun(job.schedule);
          if (nextRun) {
            taskQueue.updateJob(job.id, { nextRunAt: nextRun });
          }
        }
      }
    },

    async close(): Promise<void> {
      instance.stop();

      // Stop all watchers
      for (const watcher of watchers.values()) {
        watcher.stop();
      }
      watchers.clear();
    },

    setExecutor(exec: JobExecutor): void {
      executor = exec;
    },

    start(): void {
      if (running || !enabled) return;

      running = true;

      // Start periodic check (every 10 seconds)
      checkInterval = setInterval(() => {
        checkDueJobs().catch(console.error);
      }, 10000);

      // Start watchers for existing watcher jobs
      for (const job of taskQueue.getAllJobs()) {
        if (job.enabled && job.schedule.type === 'watcher') {
          startWatcher(job);
        }
      }

      // Initial check
      checkDueJobs().catch(console.error);
    },

    stop(): void {
      if (!running) return;

      running = false;

      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }

      // Stop all watchers
      for (const watcher of watchers.values()) {
        watcher.stop();
      }
    },

    isRunning(): boolean {
      return running;
    },

    createJob(input: CreateJobInput): Job {
      const job: Job = {
        id: generateJobId(),
        name: input.name,
        type: input.type,
        enabled: input.enabled ?? true,
        schedule: input.schedule,
        execution: input.execution,
        delivery: input.delivery,
        createdAt: new Date(),
        nextRunAt: calculateNextRun(input.schedule) || undefined,
      };

      taskQueue.addJob(job);

      // Start watcher if applicable
      if (running && job.enabled && job.schedule.type === 'watcher') {
        startWatcher(job);
      }

      return job;
    },

    createReminder(input: CreateReminderInput): Job {
      const triggerAt = typeof input.triggerAt === 'string'
        ? parseNaturalTime(input.triggerAt) || new Date(input.triggerAt)
        : input.triggerAt;

      return instance.createJob({
        name: `Reminder: ${input.message.slice(0, 30)}...`,
        type: 'reminder',
        schedule: createReminderSchedule(triggerAt, input.message),
        execution: {
          mode: 'template',
          template: input.message,
        },
        delivery: {
          channels: input.channels || ['cli'],
          peerIds: input.peerIds,
        },
      });
    },

    createCronJob(input: CreateCronJobInput): Job {
      return instance.createJob({
        name: input.name,
        type: 'cron',
        schedule: createCronSchedule(input.expression, input.timezone),
        execution: {
          mode: 'agent',
          prompt: input.prompt,
        },
        delivery: {
          channels: input.channels || ['cli'],
        },
      });
    },

    getJob(jobId: string): Job | null {
      return taskQueue.getJob(jobId);
    },

    getAllJobs(): Job[] {
      return taskQueue.getAllJobs();
    },

    updateJob(jobId: string, update: Partial<Job>): boolean {
      return taskQueue.updateJob(jobId, update);
    },

    deleteJob(jobId: string): boolean {
      stopWatcher(jobId);
      return taskQueue.removeJob(jobId);
    },

    setJobEnabled(jobId: string, enabled: boolean): boolean {
      const result = taskQueue.updateJob(jobId, { enabled });

      if (result) {
        const job = taskQueue.getJob(jobId);
        if (job?.schedule.type === 'watcher') {
          if (enabled && running) {
            startWatcher(job);
          } else {
            stopWatcher(jobId);
          }
        }
      }

      return result;
    },

    getRunHistory(jobId?: string, limit?: number): JobRunResult[] {
      return taskQueue.getRunHistory(jobId, limit);
    },

    getAgentTools(): AgentSchedulerTool[] {
      if (!allowAgentControl) return [];

      return [
        {
          name: 'create_reminder',
          description: 'Create a reminder for the user',
          parameters: {
            type: 'object',
            properties: {
              time: {
                type: 'string',
                description: 'When to remind (e.g., "in 5 minutes", "tomorrow at 9:00", "2024-01-15T10:00:00")',
              },
              message: {
                type: 'string',
                description: 'The reminder message',
              },
            },
            required: ['time', 'message'],
          },
          execute: async (args) => {
            const job = instance.createReminder({
              triggerAt: args.time as string,
              message: args.message as string,
            });
            return `Reminder created: ${job.name} (ID: ${job.id}). Will trigger ${formatReminder(job.schedule as any)}.`;
          },
        },
        {
          name: 'list_scheduled_tasks',
          description: 'List all scheduled tasks and reminders',
          parameters: {
            type: 'object',
            properties: {},
          },
          execute: async () => {
            const jobs = instance.getAllJobs();
            if (jobs.length === 0) {
              return 'No scheduled tasks.';
            }

            const lines = jobs.map((job) => {
              const status = job.enabled ? '✓' : '✗';
              const next = job.nextRunAt ? job.nextRunAt.toLocaleString() : 'N/A';
              return `[${status}] ${job.name} (${job.type}) - Next: ${next}`;
            });

            return `Scheduled tasks:\n${lines.join('\n')}`;
          },
        },
        {
          name: 'cancel_task',
          description: 'Cancel a scheduled task or reminder',
          parameters: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'The task ID to cancel',
              },
            },
            required: ['task_id'],
          },
          execute: async (args) => {
            const deleted = instance.deleteJob(args.task_id as string);
            if (deleted) {
              return `Task ${args.task_id} has been cancelled.`;
            }
            return `Task ${args.task_id} not found.`;
          },
        },
      ];
    },
  };

  return instance;
}
