/**
 * @ai-stack/code - Redo Tool
 *
 * Re-applies an undone change.
 */

import { existsSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { dirname, relative } from 'path';
import type { Tool } from '@ai-stack/agent';
import type { RedoResult, ToolContext } from '../types.js';
import type { FileHistoryStore } from '../file-history/store.js';
import { HistoryError } from '../errors.js';

/**
 * Create the Redo tool
 */
export function createRedoTool(
  context: ToolContext,
  historyStore: FileHistoryStore
): Tool {
  return {
    name: 'Redo',
    description: `Redo the last undone file change. Re-applies a previously undone operation.
Returns information about what was redone.`,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_args: Record<string, unknown>): Promise<string> {
      const result = await performRedo(context, historyStore);

      if (!result) {
        return 'No changes to redo';
      }

      const relativePath = relative(context.safety.workingDir, result.file_path);
      switch (result.action) {
        case 'create':
          return `Redone: recreated ${relativePath}`;
        case 'modify':
          return `Redone: reapplied changes to ${relativePath}`;
        case 'delete':
          return `Redone: deleted ${relativePath} again`;
      }
    },
  };
}

/**
 * Perform redo operation
 */
export async function performRedo(
  context: ToolContext,
  historyStore: FileHistoryStore
): Promise<RedoResult | null> {
  // Get the last redoable change
  const change = historyStore.getLastRedoableChange();
  if (!change) {
    return null;
  }

  // Apply the redo
  switch (change.changeType) {
    case 'create':
      // Re-create the file
      if (change.afterContent === null) {
        throw new HistoryError('Cannot redo: no content recorded');
      }
      const createDir = dirname(change.filePath);
      if (!existsSync(createDir)) {
        mkdirSync(createDir, { recursive: true });
      }
      writeFileSync(change.filePath, change.afterContent, 'utf-8');
      historyStore.markRedone(change.id);
      return {
        file_path: change.filePath,
        action: 'create',
        change_id: change.id,
      };

    case 'modify':
      // Re-apply the modification
      if (change.afterContent === null) {
        throw new HistoryError('Cannot redo: no after content recorded');
      }
      const modifyDir = dirname(change.filePath);
      if (!existsSync(modifyDir)) {
        mkdirSync(modifyDir, { recursive: true });
      }
      writeFileSync(change.filePath, change.afterContent, 'utf-8');
      historyStore.markRedone(change.id);
      return {
        file_path: change.filePath,
        action: 'modify',
        change_id: change.id,
      };

    case 'delete':
      // Re-delete the file
      if (existsSync(change.filePath)) {
        unlinkSync(change.filePath);
      }
      historyStore.markRedone(change.id);
      return {
        file_path: change.filePath,
        action: 'delete',
        change_id: change.id,
      };
  }
}
