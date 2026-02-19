/**
 * @ai-stack/code - Undo Tool
 *
 * Reverts the last file change.
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, relative } from 'path';
import type { Tool } from '@ai-stack/agent';
import type { UndoResult, ToolContext } from '../types.js';
import type { FileHistoryStore } from '../file-history/store.js';
import { HistoryError } from '../errors.js';

/**
 * Create the Undo tool
 */
export function createUndoTool(
  context: ToolContext,
  historyStore: FileHistoryStore
): Tool {
  return {
    name: 'Undo',
    description: `Undo the last file change. Reverts the most recent write or edit operation.
Returns information about what was undone.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_args: Record<string, unknown>): Promise<string> {
      const result = await performUndo(context, historyStore);

      if (!result) {
        return 'No changes to undo';
      }

      const relativePath = relative(context.safety.workingDir, result.file_path);
      switch (result.restored_to) {
        case 'previous_version':
          return `Undone: restored ${relativePath} to previous version`;
        case 'deleted':
          return `Undone: deleted ${relativePath} (was newly created)`;
        case 'created':
          return `Undone: restored deleted file ${relativePath}`;
      }
    },
  };
}

/**
 * Perform undo operation
 */
export async function performUndo(
  context: ToolContext,
  historyStore: FileHistoryStore
): Promise<UndoResult | null> {
  // Get the last undoable change
  const change = historyStore.getLastUndoableChange();
  if (!change) {
    return null;
  }

  // Apply the undo
  switch (change.changeType) {
    case 'create':
      // File was created - delete it
      if (existsSync(change.filePath)) {
        unlinkSync(change.filePath);
      }
      historyStore.markUndone(change.id);
      return {
        file_path: change.filePath,
        restored_to: 'deleted',
        change_id: change.id,
      };

    case 'modify':
      // File was modified - restore previous content
      if (change.beforeContent === null) {
        throw new HistoryError('Cannot undo: no previous content recorded');
      }
      const dir = dirname(change.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(change.filePath, change.beforeContent, 'utf-8');
      historyStore.markUndone(change.id);
      return {
        file_path: change.filePath,
        restored_to: 'previous_version',
        change_id: change.id,
      };

    case 'delete':
      // File was deleted - restore it
      if (change.beforeContent === null) {
        throw new HistoryError('Cannot undo delete: no content recorded');
      }
      const deleteDir = dirname(change.filePath);
      if (!existsSync(deleteDir)) {
        mkdirSync(deleteDir, { recursive: true });
      }
      writeFileSync(change.filePath, change.beforeContent, 'utf-8');
      historyStore.markUndone(change.id);
      return {
        file_path: change.filePath,
        restored_to: 'created',
        change_id: change.id,
      };
  }
}
