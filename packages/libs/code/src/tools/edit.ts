/**
 * @ai-stack/code - Edit Tool
 *
 * Performs search-and-replace operations on files.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, relative, isAbsolute, normalize } from 'path';
import picomatch from 'picomatch';
import type { Tool } from '@ai-stack/agent';
import type { EditParams, ToolContext } from '../types.js';
import { EditError, FileNotFoundError, FileNotReadError, PathError } from '../errors.js';
import { createContentValidator } from '../safety/content-validator.js';
import { getDiffSummary } from '../file-history/diff-engine.js';

/**
 * Create the Edit tool
 */
export function createEditTool(context: ToolContext): Tool {
  const contentValidator = createContentValidator(context.safety);

  return {
    name: 'Edit',
    description: `Edit a file using search-and-replace.
Usage:
- file_path: Absolute path to the file (required)
- old_string: Text to find and replace (required, must match exactly)
- new_string: Replacement text (required)
- replace_all: Replace all occurrences (default: false)

IMPORTANT:
- You MUST read the file first before editing.
- old_string must match exactly, including whitespace and indentation.
- If old_string is not unique, provide more context to make it unique.`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        old_string: {
          type: 'string',
          description: 'Text to replace (must match exactly)',
        },
        new_string: {
          type: 'string',
          description: 'Replacement text',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: false)',
        },
      },
      required: ['file_path', 'old_string', 'new_string'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as EditParams;
      const { file_path, old_string, new_string, replace_all = false } = params;

      // Validate path
      const { normalizedPath, relativePath } = validatePath(file_path, context);

      // Check if file exists
      if (!existsSync(normalizedPath)) {
        throw new FileNotFoundError(file_path);
      }

      // Must have read the file first
      if (!context.wasFileRead(normalizedPath)) {
        throw new FileNotReadError(file_path);
      }

      // Read current content
      const beforeContent = readFileSync(normalizedPath, 'utf-8');

      // Check if old_string exists
      const occurrences = countOccurrences(beforeContent, old_string);
      if (occurrences === 0) {
        throw new EditError(
          `old_string not found in file. Make sure it matches exactly including whitespace.`,
          file_path
        );
      }

      // Check for uniqueness if not replace_all
      if (!replace_all && occurrences > 1) {
        throw new EditError(
          `old_string matches ${occurrences} locations. Provide more context to make it unique, or use replace_all: true.`,
          file_path
        );
      }

      // Perform replacement
      let afterContent: string;
      if (replace_all) {
        afterContent = beforeContent.split(old_string).join(new_string);
      } else {
        afterContent = beforeContent.replace(old_string, new_string);
      }

      // Validate new content for secrets
      contentValidator.validateOrThrow(afterContent, file_path);

      // Write the file
      writeFileSync(normalizedPath, afterContent, 'utf-8');

      // Record change for undo
      await context.recordChange({
        filePath: normalizedPath,
        changeType: 'modify',
        beforeContent,
        afterContent,
      });

      // Return result
      const diffSummary = getDiffSummary(beforeContent, afterContent);
      const replacementCount = replace_all ? occurrences : 1;
      return `Edited ${relativePath}: ${replacementCount} replacement(s) (${diffSummary})`;
    },
  };
}

/**
 * Count occurrences of a substring
 */
function countOccurrences(str: string, substr: string): number {
  if (substr.length === 0) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = str.indexOf(substr, pos)) !== -1) {
    count++;
    pos += substr.length;
  }
  return count;
}

/**
 * Validate path against safety constraints
 */
function validatePath(
  filePath: string,
  context: ToolContext
): { normalizedPath: string; relativePath: string } {
  const workingDir = resolve(context.safety.workingDir);

  // Normalize the path
  let normalizedPath: string;
  if (isAbsolute(filePath)) {
    normalizedPath = normalize(filePath);
  } else {
    normalizedPath = resolve(workingDir, filePath);
  }

  // Get relative path
  const relativePath = relative(workingDir, normalizedPath);

  // Check if outside working directory
  if (relativePath.startsWith('..')) {
    throw new PathError(`Path is outside working directory: ${filePath}`, filePath);
  }

  // Check blocked patterns
  for (const pattern of context.safety.blockedPaths) {
    const matcher = picomatch(pattern, { dot: true });
    if (matcher(relativePath)) {
      throw new PathError(`Path is blocked: ${filePath}`, filePath);
    }
  }

  // Check allowed patterns
  let isAllowed = false;
  for (const pattern of context.safety.allowedPaths) {
    const matcher = picomatch(pattern, { dot: true });
    if (matcher(relativePath)) {
      isAllowed = true;
      break;
    }
  }

  if (!isAllowed) {
    throw new PathError(`Path is not in allowed list: ${filePath}`, filePath);
  }

  return { normalizedPath, relativePath };
}
