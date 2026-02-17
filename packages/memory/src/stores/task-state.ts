/**
 * @agent-stack/memory - Task State Store
 *
 * Stores working memory for task execution state.
 */

import type {
  ITaskStateStore,
  TaskState,
  TaskStateUpdate,
  TaskStateSnapshot,
  TaskStatus,
  UUID,
} from '../types.js';
import { SQLiteStore } from './base.js';
import { TaskStateError, TaskStateConflictError, DatabaseError } from '../errors.js';

/**
 * SQLite-based task state store for working memory
 */
export class TaskStateStore extends SQLiteStore implements ITaskStateStore {
  /** Map of action IDs to prevent duplicate operations */
  private processedActions = new Map<string, UUID>();

  constructor() {
    super('TaskStateStore');
  }

  async initialize(): Promise<void> {
    const db = this.getDb();

    // Create task states table
    db.exec(`
      CREATE TABLE IF NOT EXISTS task_states (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        constraints TEXT NOT NULL DEFAULT '[]',
        plan TEXT NOT NULL DEFAULT '[]',
        done TEXT NOT NULL DEFAULT '[]',
        blocked TEXT NOT NULL DEFAULT '[]',
        next_action TEXT,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        session_id TEXT,
        metadata TEXT,
        is_current INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_task_states_session_id ON task_states(session_id);
      CREATE INDEX IF NOT EXISTS idx_task_states_status ON task_states(status);
      CREATE INDEX IF NOT EXISTS idx_task_states_is_current ON task_states(is_current);

      -- Task state snapshots for rollback
      CREATE TABLE IF NOT EXISTS task_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        state TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES task_states(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_task_snapshots_task_id ON task_snapshots(task_id);

      -- Processed actions for idempotency
      CREATE TABLE IF NOT EXISTS processed_actions (
        action_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);

    // Load processed actions into memory
    const actions = db.prepare('SELECT action_id, task_id FROM processed_actions').all() as Array<{
      action_id: string;
      task_id: string;
    }>;
    for (const action of actions) {
      this.processedActions.set(action.action_id, action.task_id);
    }

    this.initialized = true;
  }

  async clear(): Promise<void> {
    const db = this.getDb();
    db.exec(`
      DELETE FROM task_snapshots;
      DELETE FROM processed_actions;
      DELETE FROM task_states;
    `);
    this.processedActions.clear();
  }

  async create(input: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState> {
    const db = this.getDb();

    const task: TaskState = {
      id: this.generateId(),
      goal: input.goal,
      status: input.status || 'pending',
      constraints: input.constraints || [],
      plan: input.plan || [],
      done: input.done || [],
      blocked: input.blocked || [],
      nextAction: input.nextAction,
      updatedAt: this.now(),
      version: 1,
      sessionId: input.sessionId,
      metadata: input.metadata,
    };

    try {
      // Set all other tasks in session as not current
      if (input.sessionId) {
        db.prepare('UPDATE task_states SET is_current = 0 WHERE session_id = ?').run(
          input.sessionId
        );
      }

      const stmt = db.prepare(`
        INSERT INTO task_states (
          id, goal, status, constraints, plan, done, blocked, next_action,
          updated_at, version, session_id, metadata, is_current
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);

      stmt.run(
        task.id,
        task.goal,
        task.status,
        JSON.stringify(task.constraints),
        JSON.stringify(task.plan),
        JSON.stringify(task.done),
        JSON.stringify(task.blocked),
        task.nextAction || null,
        task.updatedAt,
        task.version,
        task.sessionId || null,
        task.metadata ? JSON.stringify(task.metadata) : null
      );

      return task;
    } catch (error) {
      throw new TaskStateError(
        `Failed to create task: ${(error as Error).message}`,
        undefined,
        error as Error
      );
    }
  }

  async get(id: UUID): Promise<TaskState | null> {
    const db = this.getDb();

    try {
      const stmt = db.prepare('SELECT * FROM task_states WHERE id = ?');
      const row = stmt.get(id) as TaskStateRow | undefined;

      if (!row) return null;

      return this.rowToTaskState(row);
    } catch (error) {
      throw new DatabaseError('get', (error as Error).message, error as Error);
    }
  }

  async update(id: UUID, update: TaskStateUpdate): Promise<TaskState> {
    const db = this.getDb();

    // Check for idempotency
    if (update.actionId) {
      const existingTaskId = this.processedActions.get(update.actionId);
      if (existingTaskId === id) {
        // Already processed this action, return current state
        const current = await this.get(id);
        if (current) return current;
      }
    }

    try {
      const current = await this.get(id);
      if (!current) {
        throw new TaskStateError(`Task not found: ${id}`, id);
      }

      // Create snapshot before update
      await this.snapshot(id);

      const updated: TaskState = {
        ...current,
        ...update,
        updatedAt: this.now(),
        version: current.version + 1,
      };

      const stmt = db.prepare(`
        UPDATE task_states SET
          goal = ?, status = ?, constraints = ?, plan = ?, done = ?,
          blocked = ?, next_action = ?, updated_at = ?, version = ?,
          session_id = ?, metadata = ?
        WHERE id = ? AND version = ?
      `);

      const result = stmt.run(
        updated.goal,
        updated.status,
        JSON.stringify(updated.constraints),
        JSON.stringify(updated.plan),
        JSON.stringify(updated.done),
        JSON.stringify(updated.blocked),
        updated.nextAction || null,
        updated.updatedAt,
        updated.version,
        updated.sessionId || null,
        updated.metadata ? JSON.stringify(updated.metadata) : null,
        id,
        current.version
      );

      if (result.changes === 0) {
        // Version conflict
        const actual = await this.get(id);
        throw new TaskStateConflictError(id, current.version, actual?.version || 0);
      }

      // Record action for idempotency
      if (update.actionId) {
        db.prepare(
          'INSERT OR REPLACE INTO processed_actions (action_id, task_id, timestamp) VALUES (?, ?, ?)'
        ).run(update.actionId, id, this.now());
        this.processedActions.set(update.actionId, id);
      }

      return updated;
    } catch (error) {
      if (error instanceof TaskStateError || error instanceof TaskStateConflictError) {
        throw error;
      }
      throw new TaskStateError(
        `Failed to update task: ${(error as Error).message}`,
        id,
        error as Error
      );
    }
  }

  async getCurrent(sessionId?: string): Promise<TaskState | null> {
    const db = this.getDb();

    try {
      let stmt;
      if (sessionId) {
        stmt = db.prepare(
          'SELECT * FROM task_states WHERE session_id = ? AND is_current = 1 LIMIT 1'
        );
        const row = stmt.get(sessionId) as TaskStateRow | undefined;
        return row ? this.rowToTaskState(row) : null;
      } else {
        stmt = db.prepare('SELECT * FROM task_states WHERE is_current = 1 ORDER BY updated_at DESC LIMIT 1');
        const row = stmt.get() as TaskStateRow | undefined;
        return row ? this.rowToTaskState(row) : null;
      }
    } catch (error) {
      throw new DatabaseError('getCurrent', (error as Error).message, error as Error);
    }
  }

  async list(options?: {
    sessionId?: string;
    status?: TaskStatus[];
    limit?: number;
  }): Promise<TaskState[]> {
    const db = this.getDb();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.sessionId) {
      conditions.push('session_id = ?');
      params.push(options.sessionId);
    }

    if (options?.status && options.status.length > 0) {
      conditions.push(`status IN (${options.status.map(() => '?').join(', ')})`);
      params.push(...options.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = options?.limit ? `LIMIT ${options.limit}` : '';

    try {
      const stmt = db.prepare(`
        SELECT * FROM task_states
        ${whereClause}
        ORDER BY updated_at DESC
        ${limitClause}
      `);

      const rows = stmt.all(...params) as TaskStateRow[];
      return rows.map((row) => this.rowToTaskState(row));
    } catch (error) {
      throw new DatabaseError('list', (error as Error).message, error as Error);
    }
  }

  async snapshot(id: UUID): Promise<TaskStateSnapshot> {
    const db = this.getDb();

    const current = await this.get(id);
    if (!current) {
      throw new TaskStateError(`Task not found: ${id}`, id);
    }

    const snapshot: TaskStateSnapshot = {
      taskId: id,
      version: current.version,
      state: current,
      timestamp: this.now(),
    };

    try {
      db.prepare(`
        INSERT INTO task_snapshots (task_id, version, state, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(id, snapshot.version, JSON.stringify(snapshot.state), snapshot.timestamp);

      // Keep only last 10 snapshots
      db.prepare(`
        DELETE FROM task_snapshots
        WHERE task_id = ? AND id NOT IN (
          SELECT id FROM task_snapshots WHERE task_id = ? ORDER BY timestamp DESC LIMIT 10
        )
      `).run(id, id);

      return snapshot;
    } catch (error) {
      throw new DatabaseError('snapshot', (error as Error).message, error as Error);
    }
  }

  async rollback(taskId: UUID, version: number): Promise<TaskState> {
    const db = this.getDb();

    try {
      const stmt = db.prepare(
        'SELECT * FROM task_snapshots WHERE task_id = ? AND version = ? LIMIT 1'
      );
      const row = stmt.get(taskId, version) as SnapshotRow | undefined;

      if (!row) {
        throw new TaskStateError(`Snapshot not found for task ${taskId} version ${version}`, taskId);
      }

      const snapshot: TaskStateSnapshot = {
        taskId: row.task_id,
        version: row.version,
        state: JSON.parse(row.state),
        timestamp: row.timestamp,
      };

      // Restore state with new version
      const restored: TaskState = {
        ...snapshot.state,
        updatedAt: this.now(),
        version: (await this.get(taskId))!.version + 1,
      };

      const updateStmt = db.prepare(`
        UPDATE task_states SET
          goal = ?, status = ?, constraints = ?, plan = ?, done = ?,
          blocked = ?, next_action = ?, updated_at = ?, version = ?,
          session_id = ?, metadata = ?
        WHERE id = ?
      `);

      updateStmt.run(
        restored.goal,
        restored.status,
        JSON.stringify(restored.constraints),
        JSON.stringify(restored.plan),
        JSON.stringify(restored.done),
        JSON.stringify(restored.blocked),
        restored.nextAction || null,
        restored.updatedAt,
        restored.version,
        restored.sessionId || null,
        restored.metadata ? JSON.stringify(restored.metadata) : null,
        taskId
      );

      return restored;
    } catch (error) {
      if (error instanceof TaskStateError) throw error;
      throw new DatabaseError('rollback', (error as Error).message, error as Error);
    }
  }

  async getSnapshots(taskId: UUID, limit = 10): Promise<TaskStateSnapshot[]> {
    const db = this.getDb();

    try {
      const stmt = db.prepare(`
        SELECT * FROM task_snapshots
        WHERE task_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(taskId, limit) as SnapshotRow[];
      return rows.map((row) => ({
        taskId: row.task_id,
        version: row.version,
        state: JSON.parse(row.state),
        timestamp: row.timestamp,
      }));
    } catch (error) {
      throw new DatabaseError('getSnapshots', (error as Error).message, error as Error);
    }
  }

  /**
   * Convert database row to TaskState
   */
  private rowToTaskState(row: TaskStateRow): TaskState {
    return {
      id: row.id,
      goal: row.goal,
      status: row.status as TaskStatus,
      constraints: JSON.parse(row.constraints),
      plan: JSON.parse(row.plan),
      done: JSON.parse(row.done),
      blocked: JSON.parse(row.blocked),
      nextAction: row.next_action || undefined,
      updatedAt: row.updated_at,
      version: row.version,
      sessionId: row.session_id || undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    };
  }
}

/**
 * Database row types
 */
interface TaskStateRow {
  id: string;
  goal: string;
  status: string;
  constraints: string;
  plan: string;
  done: string;
  blocked: string;
  next_action: string | null;
  updated_at: number;
  version: number;
  session_id: string | null;
  metadata: string | null;
  is_current: number;
}

interface SnapshotRow {
  id: number;
  task_id: string;
  version: number;
  state: string;
  timestamp: number;
}
