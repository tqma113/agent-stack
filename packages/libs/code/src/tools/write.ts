/**
 * @ai-stack/code - Write Tool
 *
 * Writes content to a file.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, relative, isAbsolute, normalize } from 'path';
import picomatch from 'picomatch';
import type { Tool } from '@ai-stack/agent';
import type { WriteParams, ToolContext } from '../types.js';
import { FileNotReadError, PathError } from '../errors.js';
import { createContentValidator } from '../safety/content-validator.js';
import { showDiffView } from '@ai-stack/tui';

/**
 * Create the Write tool
 */
export function createWriteTool(context: ToolContext): Tool {
  const contentValidator = createContentValidator(context.safety);

  return {
    name: 'Write',
    description: `Write content to a file. Creates parent directories automatically.
Usage:
- file_path: Absolute path to the file (required)
- content: Content to write (required)

IMPORTANT: You MUST read the file first before overwriting an existing file.
New files can be created without reading first.`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to write',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['file_path', 'content'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as WriteParams;
      const { file_path, content } = params;

      // Validate path
      const { normalizedPath, relativePath } = validatePath(file_path, context);

      // Check if file exists
      const fileExists = existsSync(normalizedPath);

      // If file exists, must have been read first
      if (fileExists && !context.wasFileRead(normalizedPath)) {
        throw new FileNotReadError(file_path);
      }

      // Validate content for secrets
      contentValidator.validateOrThrow(content, file_path);

      // Get old content for history
      const beforeContent = fileExists ? readFileSync(normalizedPath, 'utf-8') : null;

      // Show diff preview if confirmDestructive is enabled and file exists
      if (context.safety.confirmDestructive && fileExists && beforeContent !== null) {
        const confirmed = await showDiffView(relativePath, beforeContent, content);
        if (!confirmed) {
          return `Write operation cancelled by user: ${relativePath}`;
        }
      }

      // Create parent directories if needed
      const dir = dirname(normalizedPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write the file
      writeFileSync(normalizedPath, content, 'utf-8');

      // Record change for undo
      const changeId = await context.recordChange({
        filePath: normalizedPath,
        changeType: fileExists ? 'modify' : 'create',
        beforeContent,
        afterContent: content,
      });

      // Mark file as read (it's now known)
      context.markFileRead(normalizedPath);

      // Return result
      const action = fileExists ? 'Updated' : 'Created';
      const lines = content.split('\n').length;
      return `${action} ${relativePath} (${lines} lines)`;
    },
  };
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
