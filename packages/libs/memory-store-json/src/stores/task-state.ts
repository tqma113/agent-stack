/**
 * @agent-stack/memory-store-json - Task State Store
 *
 * JSON-based task state storage for working memory.
 */

import * as path from 'node:path';
import type {
  ITaskStateStore,
  TaskState,
  TaskStateUpdate,
  TaskStateSnapshot,
  TaskStatus,
  UUID,
} from '@agent-stack/memory-store-sqlite';
import {
  readJsonFile,
  writeJsonFile,
  ensureDir,
  deleteDir,
  listFiles,
  generateId,
  now,
} from '../utils/file-ops.js';

/**
 * JSON Task State Store configuration
 */
export interface JsonTaskStateStoreConfig {
  basePath: string;
}

/**
 * Snapshots data structure
 */
interface SnapshotsData {
  snapshots: TaskStateSnapshot[];
}

/**
 * Create a JSON Task State Store instance
 */
export function createJsonTaskStateStore(config: JsonTaskStateStoreConfig): ITaskStateStore {
  const tasksDir = path.join(config.basePath, 'tasks');
  const snapshotsDir = path.join(config.basePath, 'snapshots');
  let initialized = false;

  /**
   * Get task file path
   */
  function getTaskPath(id: UUID): string {
    return path.join(tasksDir, `${id}.json`);
  }

  /**
   * Get snapshots file path
   */
  function getSnapshotsPath(taskId: UUID): string {
    return path.join(snapshotsDir, `${taskId}.json`);
  }

  /**
   * Read all tasks
   */
  function readAllTasks(): TaskState[] {
    const files = listFiles(tasksDir, '.json');
    const tasks: TaskState[] = [];

    for (const file of files) {
      const task = readJsonFile<TaskState | null>(path.join(tasksDir, file), null);
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  return {
    async initialize(): Promise<void> {
      ensureDir(tasksDir);
      ensureDir(snapshotsDir);
      initialized = true;
    },

    async close(): Promise<void> {
      initialized = false;
    },

    async clear(): Promise<void> {
      deleteDir(tasksDir);
      deleteDir(snapshotsDir);
      ensureDir(tasksDir);
      ensureDir(snapshotsDir);
    },

    async create(task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState> {
      const newTask: TaskState = {
        ...task,
        id: generateId(),
        version: 1,
        updatedAt: now(),
      };

      writeJsonFile(getTaskPath(newTask.id), newTask);
      return newTask;
    },

    async get(id: UUID): Promise<TaskState | null> {
      return readJsonFile<TaskState | null>(getTaskPath(id), null);
    },

    async update(id: UUID, update: TaskStateUpdate): Promise<TaskState> {
      const task = await this.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const updatedTask: TaskState = {
        ...task,
        ...update,
        id: task.id, // Preserve ID
        version: task.version + 1,
        updatedAt: now(),
      };

      writeJsonFile(getTaskPath(id), updatedTask);
      return updatedTask;
    },

    async getCurrent(sessionId?: string): Promise<TaskState | null> {
      const tasks = readAllTasks();

      // Filter by session if provided
      let filtered = tasks;
      if (sessionId) {
        filtered = tasks.filter(t => t.sessionId === sessionId);
      }

      // Find active task (in_progress or pending)
      const activeStatuses: TaskStatus[] = ['in_progress', 'pending'];
      const activeTasks = filtered.filter(t => activeStatuses.includes(t.status));

      if (activeTasks.length === 0) return null;

      // Return most recently updated
      activeTasks.sort((a, b) => b.updatedAt - a.updatedAt);
      return activeTasks[0];
    },

    async list(options?: {
      sessionId?: string;
      status?: TaskStatus[];
      limit?: number;
    }): Promise<TaskState[]> {
      let tasks = readAllTasks();

      // Filter by session
      if (options?.sessionId) {
        tasks = tasks.filter(t => t.sessionId === options.sessionId);
      }

      // Filter by status
      if (options?.status && options.status.length > 0) {
        tasks = tasks.filter(t => options.status!.includes(t.status));
      }

      // Sort by updatedAt descending
      tasks.sort((a, b) => b.updatedAt - a.updatedAt);

      // Apply limit
      if (options?.limit) {
        tasks = tasks.slice(0, options.limit);
      }

      return tasks;
    },

    async snapshot(id: UUID): Promise<TaskStateSnapshot> {
      const task = await this.get(id);
      if (!task) {
        throw new Error(`Task not found: ${id}`);
      }

      const snapshot: TaskStateSnapshot = {
        taskId: id,
        version: task.version,
        state: { ...task },
        timestamp: now(),
      };

      // Append to snapshots file
      const snapshotsData = readJsonFile<SnapshotsData>(getSnapshotsPath(id), { snapshots: [] });
      snapshotsData.snapshots.push(snapshot);
      writeJsonFile(getSnapshotsPath(id), snapshotsData);

      return snapshot;
    },

    async rollback(taskId: UUID, version: number): Promise<TaskState> {
      const snapshotsData = readJsonFile<SnapshotsData>(getSnapshotsPath(taskId), { snapshots: [] });
      const snapshot = snapshotsData.snapshots.find(s => s.version === version);

      if (!snapshot) {
        throw new Error(`Snapshot not found for task ${taskId} version ${version}`);
      }

      const task = await this.get(taskId);
      const restoredTask: TaskState = {
        ...snapshot.state,
        version: (task?.version || 0) + 1,
        updatedAt: now(),
      };

      writeJsonFile(getTaskPath(taskId), restoredTask);
      return restoredTask;
    },

    async getSnapshots(taskId: UUID, limit?: number): Promise<TaskStateSnapshot[]> {
      const snapshotsData = readJsonFile<SnapshotsData>(getSnapshotsPath(taskId), { snapshots: [] });
      let snapshots = snapshotsData.snapshots.sort((a, b) => b.timestamp - a.timestamp);

      if (limit) {
        snapshots = snapshots.slice(0, limit);
      }

      return snapshots;
    },
  };
}
