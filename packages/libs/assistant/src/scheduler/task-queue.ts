/**
 * @ai-stack/assistant - Task Queue
 *
 * Persistent task queue for scheduled jobs.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Job, JobRunResult } from './types.js';

/**
 * Task Queue Instance
 */
export interface TaskQueueInstance {
  /** Load jobs from persistence */
  load(): Job[];
  /** Save jobs to persistence */
  save(jobs: Job[]): void;
  /** Add a job */
  addJob(job: Job): void;
  /** Remove a job */
  removeJob(jobId: string): boolean;
  /** Update a job */
  updateJob(jobId: string, update: Partial<Job>): boolean;
  /** Get a job by ID */
  getJob(jobId: string): Job | null;
  /** Get all jobs */
  getAllJobs(): Job[];
  /** Log a job run result */
  logRun(result: JobRunResult): void;
  /** Get run history */
  getRunHistory(jobId?: string, limit?: number): JobRunResult[];
}

/**
 * Create a task queue
 */
export function createTaskQueue(persistencePath: string): TaskQueueInstance {
  const jobs = new Map<string, Job>();
  const runHistory: JobRunResult[] = [];
  const maxHistorySize = 100;

  // Ensure directory exists
  const dir = dirname(persistencePath);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  return {
    load(): Job[] {
      if (!existsSync(persistencePath)) {
        return [];
      }

      try {
        const content = readFileSync(persistencePath, 'utf-8');
        const data = JSON.parse(content) as { jobs: Job[]; history?: JobRunResult[] };

        // Load jobs
        jobs.clear();
        for (const job of data.jobs || []) {
          // Convert date strings back to Date objects
          job.createdAt = new Date(job.createdAt);
          if (job.lastRunAt) job.lastRunAt = new Date(job.lastRunAt);
          if (job.nextRunAt) job.nextRunAt = new Date(job.nextRunAt);
          if (job.schedule.type === 'reminder') {
            (job.schedule as any).triggerAt = new Date((job.schedule as any).triggerAt);
          }
          jobs.set(job.id, job);
        }

        // Load history
        runHistory.length = 0;
        for (const result of data.history || []) {
          result.timestamp = new Date(result.timestamp);
          runHistory.push(result);
        }

        return Array.from(jobs.values());
      } catch (error) {
        console.error('Failed to load task queue:', error);
        return [];
      }
    },

    save(jobsList: Job[]): void {
      jobs.clear();
      for (const job of jobsList) {
        jobs.set(job.id, job);
      }

      const data = {
        jobs: jobsList,
        history: runHistory.slice(-maxHistorySize),
      };

      writeFileSync(persistencePath, JSON.stringify(data, null, 2), 'utf-8');
    },

    addJob(job: Job): void {
      jobs.set(job.id, job);
      this.save(Array.from(jobs.values()));
    },

    removeJob(jobId: string): boolean {
      const result = jobs.delete(jobId);
      if (result) {
        this.save(Array.from(jobs.values()));
      }
      return result;
    },

    updateJob(jobId: string, update: Partial<Job>): boolean {
      const job = jobs.get(jobId);
      if (!job) return false;

      const updated = { ...job, ...update };
      jobs.set(jobId, updated);
      this.save(Array.from(jobs.values()));
      return true;
    },

    getJob(jobId: string): Job | null {
      return jobs.get(jobId) || null;
    },

    getAllJobs(): Job[] {
      return Array.from(jobs.values());
    },

    logRun(result: JobRunResult): void {
      runHistory.push(result);

      // Trim history if needed
      while (runHistory.length > maxHistorySize) {
        runHistory.shift();
      }

      // Save with updated history
      this.save(Array.from(jobs.values()));
    },

    getRunHistory(jobId?: string, limit: number = 20): JobRunResult[] {
      let results = runHistory;

      if (jobId) {
        results = results.filter((r) => r.jobId === jobId);
      }

      return results.slice(-limit).reverse();
    },
  };
}
