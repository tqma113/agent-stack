/**
 * @ai-stack/code - Read Tool
 *
 * Reads file content with line numbers.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import type { Tool } from '@ai-stack/agent';
import type { ReadParams, ToolContext } from '../types.js';
import { FileNotFoundError, FileTooLargeError } from '../errors.js';

/**
 * Default maximum lines to read
 */
const DEFAULT_LIMIT = 2000;

/**
 * Maximum line length before truncation
 */
const MAX_LINE_LENGTH = 2000;

/**
 * Create the Read tool
 */
export function createReadTool(context: ToolContext): Tool {
  return {
    name: 'Read',
    description: `Read a file from the filesystem. Returns content with line numbers.
Usage:
- file_path: Absolute path to the file (required)
- offset: Line number to start from (1-based, optional)
- limit: Number of lines to read (default: ${DEFAULT_LIMIT})

The output format shows line numbers: "   1→content of line 1"`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to read',
        },
        offset: {
          type: 'number',
          description: 'Line number to start reading from (1-based)',
        },
        limit: {
          type: 'number',
          description: `Number of lines to read (default: ${DEFAULT_LIMIT})`,
        },
      },
      required: ['file_path'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as ReadParams;
      const { file_path, offset = 1, limit = DEFAULT_LIMIT } = params;

      // Validate path
      const { normalizedPath } = context.safety.workingDir
        ? validatePath(file_path, context)
        : { normalizedPath: file_path };

      // Check if file exists
      if (!existsSync(normalizedPath)) {
        throw new FileNotFoundError(file_path);
      }

      // Check file size
      const stats = statSync(normalizedPath);
      if (stats.size > context.safety.maxFileSize) {
        throw new FileTooLargeError(file_path, stats.size, context.safety.maxFileSize);
      }

      // Read file content
      const content = readFileSync(normalizedPath, 'utf-8');

      // Mark file as read
      context.markFileRead(normalizedPath);

      // Split into lines and apply offset/limit
      const lines = content.split('\n');
      const startIndex = Math.max(0, offset - 1);
      const endIndex = Math.min(lines.length, startIndex + limit);
      const selectedLines = lines.slice(startIndex, endIndex);

      // Format with line numbers
      const maxLineNum = endIndex;
      const lineNumWidth = String(maxLineNum).length;

      const formattedLines = selectedLines.map((line, i) => {
        const lineNum = startIndex + i + 1;
        const paddedNum = String(lineNum).padStart(lineNumWidth, ' ');
        // Truncate long lines
        const truncatedLine =
          line.length > MAX_LINE_LENGTH
            ? line.slice(0, MAX_LINE_LENGTH) + '... (truncated)'
            : line;
        return `${paddedNum}→${truncatedLine}`;
      });

      // Add info header if paginated
      let result = formattedLines.join('\n');
      if (startIndex > 0 || endIndex < lines.length) {
        const info = `[Lines ${offset}-${endIndex} of ${lines.length}]`;
        result = `${info}\n${result}`;
      }

      return result;
    },
  };
}

/**
 * Validate path against safety constraints
 */
function validatePath(
  filePath: string,
  context: ToolContext
): { normalizedPath: string } {
  // Import path validator dynamically to avoid circular deps
  const { resolve, relative, isAbsolute, normalize } = require('path');
  const picomatch = require('picomatch');

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
    throw new Error(`Path is outside working directory: ${filePath}`);
  }

  // Check blocked patterns
  for (const pattern of context.safety.blockedPaths) {
    const matcher = picomatch(pattern, { dot: true });
    if (matcher(relativePath)) {
      throw new Error(`Path is blocked: ${filePath}`);
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
    throw new Error(`Path is not in allowed list: ${filePath}`);
  }

  return { normalizedPath };
}
