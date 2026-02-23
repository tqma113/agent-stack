/**
 * @ai-stack/tree-index - Task Tree Builder
 *
 * Builds hierarchical tree structure from task states and their steps.
 */

import type Database from 'better-sqlite3';
import type {
  UUID,
  TreeRoot,
  TreeSyncChange,
  TreeSyncResult,
  ITreeBuilder,
} from '../types.js';
import { TreeBuilderError } from '../errors.js';
import { createTreeStore, type TreeStoreInstance } from '../tree-store.js';
import { joinPath } from '../utils/path-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

/**
 * Task step input
 */
export interface TaskStepInput {
  /** Step ID */
  id: string;
  /** Step description */
  description: string;
  /** Step status */
  status: TaskStatus;
  /** Step order */
  order: number;
  /** Step output/result */
  output?: string;
  /** Semantic chunk ID (if indexed) */
  chunkId?: string;
  /** Nested sub-steps */
  subSteps?: TaskStepInput[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task state input
 */
export interface TaskStateInput {
  /** Task ID */
  taskId: string;
  /** Task goal/description */
  goal: string;
  /** Task status */
  status: TaskStatus;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Completed timestamp */
  completedAt?: number;
  /** Task steps */
  steps: TaskStepInput[];
  /** Related context */
  context?: string;
  /** Semantic chunk ID for goal */
  chunkId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task tree builder configuration
 */
export interface TaskTreeBuilderConfig {
  /** Include completed tasks */
  includeCompleted?: boolean;
  /** Include cancelled tasks */
  includeCancelled?: boolean;
  /** Maximum step depth */
  maxStepDepth?: number;
}

const DEFAULT_CONFIG: TaskTreeBuilderConfig = {
  includeCompleted: true,
  includeCancelled: false,
  maxStepDepth: 10,
};

/**
 * Task tree builder instance
 */
export interface TaskTreeBuilderInstance extends ITreeBuilder<TaskStateInput, TaskTreeBuilderConfig> {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Get the tree store instance */
  getTreeStore(): TreeStoreInstance;
  /** Update task status */
  updateTaskStatus(rootId: UUID, taskNodeId: UUID, status: TaskStatus): Promise<void>;
  /** Add step to task */
  addStep(rootId: UUID, parentNodeId: UUID, step: TaskStepInput): Promise<UUID>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a task tree builder
 */
export function createTaskTreeBuilder(): TaskTreeBuilderInstance {
  // Private state
  const treeStore = createTreeStore();

  // ============================================================================
  // Build Implementation
  // ============================================================================

  async function build(
    source: TaskStateInput,
    config?: TaskTreeBuilderConfig
  ): Promise<TreeRoot> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // Check if task should be included
    if (!cfg.includeCompleted && source.status === 'completed') {
      throw new TreeBuilderError('TaskTreeBuilder', 'Task excluded by configuration (completed)');
    }
    if (!cfg.includeCancelled && source.status === 'cancelled') {
      throw new TreeBuilderError('TaskTreeBuilder', 'Task excluded by configuration (cancelled)');
    }

    try {
      // Ensure store is initialized
      await treeStore.initialize();

      // Create tree root
      const root = await treeStore.createRoot({
        treeType: 'task',
        name: `Task: ${source.goal.slice(0, 50)}`,
        rootPath: `/${source.taskId}`,
        metadata: {
          taskId: source.taskId,
          status: source.status,
          createdAt: source.createdAt,
          updatedAt: source.updatedAt,
          completedAt: source.completedAt,
          ...source.metadata,
        },
      });

      // Create task node
      const taskNode = await treeStore.createNode({
        treeType: 'task',
        treeRootId: root.id,
        nodeType: 'task',
        name: source.goal,
        path: '/',
        chunkId: source.chunkId,
        metadata: {
          taskId: source.taskId,
          taskStatus: source.status,
          context: source.context,
          createdAt: source.createdAt,
          updatedAt: source.updatedAt,
          completedAt: source.completedAt,
          stepCount: source.steps.length,
          ...source.metadata,
        },
      });

      // Build step nodes hierarchically
      async function createStepsRecursively(
        steps: TaskStepInput[],
        parentPath: string,
        parentId: UUID,
        depth: number
      ): Promise<void> {
        if (depth >= (cfg.maxStepDepth ?? 10)) {
          return;
        }

        for (const step of steps) {
          const stepPath = joinPath(parentPath, step.id);

          const stepNode = await treeStore.createNode({
            treeType: 'task',
            treeRootId: root.id,
            nodeType: step.subSteps && step.subSteps.length > 0 ? 'subtask' : 'step',
            name: step.description.slice(0, 100),
            path: stepPath,
            parentId,
            sortOrder: step.order,
            chunkId: step.chunkId,
            metadata: {
              stepId: step.id,
              taskStatus: step.status,
              output: step.output,
              ...step.metadata,
            },
          });

          // Recursively create sub-steps
          if (step.subSteps && step.subSteps.length > 0) {
            await createStepsRecursively(step.subSteps, stepPath, stepNode.id, depth + 1);
          }
        }
      }

      // Sort steps by order
      const sortedSteps = [...source.steps].sort((a, b) => a.order - b.order);

      await createStepsRecursively(sortedSteps, '/', taskNode.id, 0);

      return root;
    } catch (error) {
      if (error instanceof TreeBuilderError) {
        throw error;
      }
      throw new TreeBuilderError(
        'TaskTreeBuilder',
        `Failed to build task tree: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function updateTaskStatus(
    _rootId: UUID,
    taskNodeId: UUID,
    status: TaskStatus
  ): Promise<void> {
    try {
      const node = await treeStore.getNode(taskNodeId);
      if (!node) {
        throw new Error(`Task node not found: ${taskNodeId}`);
      }

      const updatedMetadata = {
        ...node.metadata,
        taskStatus: status,
        updatedAt: Date.now(),
      };

      if (status === 'completed') {
        updatedMetadata.completedAt = Date.now();
      }

      await treeStore.updateNode(taskNodeId, {
        metadata: updatedMetadata,
      });
    } catch (error) {
      throw new TreeBuilderError(
        'TaskTreeBuilder',
        `Failed to update task status: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function addStep(
    rootId: UUID,
    parentNodeId: UUID,
    step: TaskStepInput
  ): Promise<UUID> {
    try {
      const parentNode = await treeStore.getNode(parentNodeId);
      if (!parentNode) {
        throw new Error(`Parent node not found: ${parentNodeId}`);
      }

      const stepPath = joinPath(parentNode.path, step.id);

      const stepNode = await treeStore.createNode({
        treeType: 'task',
        treeRootId: rootId,
        nodeType: step.subSteps && step.subSteps.length > 0 ? 'subtask' : 'step',
        name: step.description.slice(0, 100),
        path: stepPath,
        parentId: parentNodeId,
        sortOrder: step.order,
        chunkId: step.chunkId,
        metadata: {
          stepId: step.id,
          taskStatus: step.status,
          output: step.output,
          ...step.metadata,
        },
      });

      return stepNode.id;
    } catch (error) {
      throw new TreeBuilderError(
        'TaskTreeBuilder',
        `Failed to add step: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function sync(
    rootId: UUID,
    changes: TreeSyncChange[]
  ): Promise<TreeSyncResult> {
    const result: TreeSyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      moved: 0,
      errors: [],
    };

    try {
      for (const change of changes) {
        try {
          switch (change.type) {
            case 'add':
              if (change.node) {
                await treeStore.createNode({
                  ...change.node,
                  treeRootId: rootId,
                });
                result.added++;
              }
              break;

            case 'update':
              if (change.node) {
                const existing = await treeStore.getNodeByPath(rootId, change.path);
                if (existing) {
                  await treeStore.updateNode(existing.id, change.node);
                  result.updated++;
                }
              }
              break;

            case 'delete':
              const toDelete = await treeStore.getNodeByPath(rootId, change.path);
              if (toDelete) {
                await treeStore.deleteNode(toDelete.id);
                result.deleted++;
              }
              break;

            case 'move':
              result.errors.push({
                path: change.path,
                error: 'Move operation not supported for tasks',
              });
              break;
          }
        } catch (error) {
          result.errors.push({
            path: change.path,
            error: (error as Error).message,
          });
        }
      }

      return result;
    } catch (error) {
      throw new TreeBuilderError(
        'TaskTreeBuilder',
        `Sync failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function rebuild(
    rootId: UUID,
    source: TaskStateInput,
    config?: TaskTreeBuilderConfig
  ): Promise<TreeRoot> {
    try {
      // Delete existing root
      await treeStore.deleteRoot(rootId);

      // Build fresh
      return build(source, config);
    } catch (error) {
      throw new TreeBuilderError(
        'TaskTreeBuilder',
        `Rebuild failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // Return Instance
  // ============================================================================

  return {
    setDatabase: (database: Database.Database) => {
      treeStore.setDatabase(database);
    },
    getTreeStore: () => treeStore,
    build,
    sync,
    rebuild,
    updateTaskStatus,
    addStep,
  };
}
