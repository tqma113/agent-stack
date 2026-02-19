/**
 * @ai-stack/code - Task Management Tools
 */

import type { Tool } from '@ai-stack/agent';
import type { TaskItem, TaskCreateParams, TaskUpdateParams, ToolContext } from '../types.js';
import type { TaskStore } from '../task/store.js';
import { TaskError } from '../errors.js';

/**
 * Create TaskCreate tool
 */
export function createTaskCreateTool(taskStore: TaskStore): Tool {
  return {
    name: 'TaskCreate',
    description: `Create a new task to track work progress.
Usage:
- subject: Brief task title (required)
- description: Detailed description of what needs to be done (required)
- activeForm: Present continuous form for spinner, e.g., "Running tests" (optional)
- metadata: Additional data to attach to the task (optional)`,
    parameters: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          description: 'Brief title for the task',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done',
        },
        activeForm: {
          type: 'string',
          description: 'Present continuous form shown while task is in progress',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the task',
        },
      },
      required: ['subject', 'description'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as TaskCreateParams;

      const task = taskStore.createTask({
        subject: params.subject,
        description: params.description,
        activeForm: params.activeForm,
        metadata: params.metadata,
      });

      return `Created task #${task.id.slice(0, 8)}: ${task.subject}`;
    },
  };
}

/**
 * Create TaskUpdate tool
 */
export function createTaskUpdateTool(taskStore: TaskStore): Tool {
  return {
    name: 'TaskUpdate',
    description: `Update an existing task.
Usage:
- taskId: ID of the task to update (required)
- status: New status ('pending', 'in_progress', 'completed', or 'deleted')
- subject: New subject
- description: New description
- activeForm: New active form
- owner: New owner
- metadata: Metadata to merge (set key to null to remove)
- addBlocks: Task IDs that this task blocks
- addBlockedBy: Task IDs that block this task`,
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'deleted'],
          description: 'New status',
        },
        subject: {
          type: 'string',
          description: 'New subject',
        },
        description: {
          type: 'string',
          description: 'New description',
        },
        activeForm: {
          type: 'string',
          description: 'New active form',
        },
        owner: {
          type: 'string',
          description: 'New owner',
        },
        metadata: {
          type: 'object',
          description: 'Metadata to merge',
        },
        addBlocks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs to add to blocks list',
        },
        addBlockedBy: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs to add to blockedBy list',
        },
      },
      required: ['taskId'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as TaskUpdateParams;
      const { taskId, addBlocks, addBlockedBy, status, ...restUpdates } = params;

      // Handle deletion
      if (status === 'deleted') {
        const deleted = taskStore.deleteTask(taskId);
        if (!deleted) {
          throw new TaskError(`Task not found: ${taskId}`);
        }
        return `Deleted task #${taskId.slice(0, 8)}`;
      }

      // Update task
      const updates = status ? { ...restUpdates, status } : restUpdates;
      const task = taskStore.updateTask(taskId, updates);

      // Add block relationships
      if (addBlocks) {
        for (const blockId of addBlocks) {
          taskStore.addBlock(taskId, blockId);
        }
      }

      if (addBlockedBy) {
        for (const blockedById of addBlockedBy) {
          taskStore.addBlockedBy(taskId, blockedById);
        }
      }

      return `Updated task #${taskId.slice(0, 8)}: ${task.subject} (${task.status})`;
    },
  };
}

/**
 * Create TaskList tool
 */
export function createTaskListTool(taskStore: TaskStore): Tool {
  return {
    name: 'TaskList',
    description: `List all tasks in the task list. Shows task ID, subject, status, owner, and blockedBy relationships.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_args: Record<string, unknown>): Promise<string> {
      const tasks = taskStore.listTasks();

      if (tasks.length === 0) {
        return 'No tasks';
      }

      const lines = tasks.map((task) => {
        const id = task.id.slice(0, 8);
        const statusIcon =
          task.status === 'completed'
            ? '✓'
            : task.status === 'in_progress'
            ? '→'
            : '○';
        const owner = task.owner ? ` [${task.owner}]` : '';
        const blocked =
          task.blockedBy.length > 0
            ? ` (blocked by: ${task.blockedBy.map((b) => b.slice(0, 8)).join(', ')})`
            : '';
        return `#${id} ${statusIcon} ${task.subject}${owner}${blocked}`;
      });

      return `Tasks (${tasks.length}):\n${lines.join('\n')}`;
    },
  };
}

/**
 * Create TaskGet tool
 */
export function createTaskGetTool(taskStore: TaskStore): Tool {
  return {
    name: 'TaskGet',
    description: `Get detailed information about a specific task.
Usage:
- taskId: ID of the task to retrieve (required)`,
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'ID of the task to retrieve',
        },
      },
      required: ['taskId'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const { taskId } = args as { taskId: string };

      const task = taskStore.getTask(taskId);
      if (!task) {
        throw new TaskError(`Task not found: ${taskId}`);
      }

      const parts = [
        `Task #${task.id.slice(0, 8)}`,
        `Subject: ${task.subject}`,
        `Status: ${task.status}`,
        `Description: ${task.description}`,
      ];

      if (task.activeForm) {
        parts.push(`Active Form: ${task.activeForm}`);
      }
      if (task.owner) {
        parts.push(`Owner: ${task.owner}`);
      }
      if (task.blocks.length > 0) {
        parts.push(`Blocks: ${task.blocks.map((b) => b.slice(0, 8)).join(', ')}`);
      }
      if (task.blockedBy.length > 0) {
        parts.push(`Blocked By: ${task.blockedBy.map((b) => b.slice(0, 8)).join(', ')}`);
      }
      if (task.metadata) {
        parts.push(`Metadata: ${JSON.stringify(task.metadata)}`);
      }

      return parts.join('\n');
    },
  };
}

/**
 * Create all task tools
 */
export function createTaskTools(taskStore: TaskStore): Tool[] {
  return [
    createTaskCreateTool(taskStore),
    createTaskUpdateTool(taskStore),
    createTaskListTool(taskStore),
    createTaskGetTool(taskStore),
  ];
}
