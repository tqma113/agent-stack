/**
 * @ai-stack/code - Task Store (SQLite)
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { TaskItem, TaskStatus, TaskConfig } from '../types.js';
import { TaskError } from '../errors.js';

/**
 * Task Store configuration
 */
export interface TaskStoreConfig {
  /** SQLite database path */
  dbPath: string;
}

/**
 * Task Store instance
 */
export interface TaskStoreInstance {
  /** Initialize the store */
  initialize(): void;
  /** Close the database */
  close(): void;

  /** Create a new task */
  createTask(task: Omit<TaskItem, 'id' | 'status' | 'blocks' | 'blockedBy' | 'createdAt' | 'updatedAt'>): TaskItem;
  /** Get a task by ID */
  getTask(id: string): TaskItem | null;
  /** Update a task */
  updateTask(id: string, updates: Partial<TaskItem>): TaskItem;
  /** Delete a task */
  deleteTask(id: string): boolean;
  /** List all tasks */
  listTasks(): TaskItem[];
  /** Add a block relationship */
  addBlock(taskId: string, blocksId: string): void;
  /** Add a blockedBy relationship */
  addBlockedBy(taskId: string, blockedById: string): void;
}

/**
 * Create a task store
 */
export function createTaskStore(config: TaskStoreConfig): TaskStoreInstance {
  const { dbPath } = config;
  let db: Database.Database | null = null;

  function getDb(): Database.Database {
    if (!db) {
      throw new TaskError('Database not initialized');
    }
    return db;
  }

  const instance: TaskStoreInstance = {
    initialize(): void {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');

      // Create tasks table
      db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          subject TEXT NOT NULL,
          description TEXT NOT NULL,
          active_form TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          owner TEXT,
          metadata TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS task_blocks (
          task_id TEXT NOT NULL,
          blocks_id TEXT NOT NULL,
          PRIMARY KEY (task_id, blocks_id),
          FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
          FOREIGN KEY (blocks_id) REFERENCES tasks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
      `);
    },

    close(): void {
      if (db) {
        db.close();
        db = null;
      }
    },

    createTask(task): TaskItem {
      const id = randomUUID();
      const now = Date.now();

      const stmt = getDb().prepare(`
        INSERT INTO tasks (id, subject, description, active_form, status, owner, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        task.subject,
        task.description,
        task.activeForm || null,
        task.owner || null,
        task.metadata ? JSON.stringify(task.metadata) : null,
        now,
        now
      );

      return {
        id,
        subject: task.subject,
        description: task.description,
        activeForm: task.activeForm,
        status: 'pending',
        blocks: [],
        blockedBy: [],
        owner: task.owner,
        metadata: task.metadata,
        createdAt: now,
        updatedAt: now,
      };
    },

    getTask(id): TaskItem | null {
      const taskStmt = getDb().prepare(`
        SELECT id, subject, description, active_form, status, owner, metadata, created_at, updated_at
        FROM tasks WHERE id = ?
      `);

      const row = taskStmt.get(id) as any;
      if (!row) return null;

      // Get blocks
      const blocksStmt = getDb().prepare(`
        SELECT blocks_id FROM task_blocks WHERE task_id = ?
      `);
      const blocks = (blocksStmt.all(id) as any[]).map((r) => r.blocks_id);

      // Get blockedBy
      const blockedByStmt = getDb().prepare(`
        SELECT task_id FROM task_blocks WHERE blocks_id = ?
      `);
      const blockedBy = (blockedByStmt.all(id) as any[]).map((r) => r.task_id);

      return {
        id: row.id,
        subject: row.subject,
        description: row.description,
        activeForm: row.active_form || undefined,
        status: row.status as TaskStatus,
        blocks,
        blockedBy,
        owner: row.owner || undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    updateTask(id, updates): TaskItem {
      const task = instance.getTask(id);
      if (!task) {
        throw new TaskError(`Task not found: ${id}`);
      }

      const now = Date.now();
      const sets: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.subject !== undefined) {
        sets.push('subject = ?');
        values.push(updates.subject);
      }
      if (updates.description !== undefined) {
        sets.push('description = ?');
        values.push(updates.description);
      }
      if (updates.activeForm !== undefined) {
        sets.push('active_form = ?');
        values.push(updates.activeForm);
      }
      if (updates.status !== undefined) {
        sets.push('status = ?');
        values.push(updates.status);
      }
      if (updates.owner !== undefined) {
        sets.push('owner = ?');
        values.push(updates.owner);
      }
      if (updates.metadata !== undefined) {
        // Merge metadata
        const merged = { ...task.metadata, ...updates.metadata };
        // Remove null values
        Object.keys(merged).forEach((k) => {
          if (merged[k] === null) delete merged[k];
        });
        sets.push('metadata = ?');
        values.push(Object.keys(merged).length > 0 ? JSON.stringify(merged) : null);
      }

      values.push(id);

      const stmt = getDb().prepare(`
        UPDATE tasks SET ${sets.join(', ')} WHERE id = ?
      `);
      stmt.run(...values);

      return instance.getTask(id)!;
    },

    deleteTask(id): boolean {
      const stmt = getDb().prepare('DELETE FROM tasks WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    },

    listTasks(): TaskItem[] {
      const stmt = getDb().prepare(`
        SELECT id FROM tasks WHERE status != 'deleted' ORDER BY created_at ASC
      `);

      const rows = stmt.all() as any[];
      return rows.map((r) => instance.getTask(r.id)!).filter(Boolean);
    },

    addBlock(taskId, blocksId): void {
      const stmt = getDb().prepare(`
        INSERT OR IGNORE INTO task_blocks (task_id, blocks_id) VALUES (?, ?)
      `);
      stmt.run(taskId, blocksId);
    },

    addBlockedBy(taskId, blockedById): void {
      const stmt = getDb().prepare(`
        INSERT OR IGNORE INTO task_blocks (task_id, blocks_id) VALUES (?, ?)
      `);
      stmt.run(blockedById, taskId);
    },
  };

  return instance;
}

export type TaskStore = TaskStoreInstance;
