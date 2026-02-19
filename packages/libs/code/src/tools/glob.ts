/**
 * @ai-stack/code - Glob Tool
 *
 * Searches for files matching glob patterns.
 */

import { glob } from 'glob';
import { resolve, relative, join } from 'path';
import { statSync } from 'fs';
import type { Tool } from '@ai-stack/agent';
import type { GlobParams, ToolContext } from '../types.js';

/**
 * Maximum files to return
 */
const MAX_FILES = 500;

/**
 * Create the Glob tool
 */
export function createGlobTool(context: ToolContext): Tool {
  return {
    name: 'Glob',
    description: `Search for files matching glob patterns.
Usage:
- pattern: Glob pattern like "**/*.ts" or "src/**/*.js" (required)
- path: Directory to search in (default: working directory)

Common patterns:
- "**/*.ts" - All TypeScript files
- "src/**/*" - All files in src
- "*.json" - JSON files in current directory
- "**/*.{ts,tsx}" - TypeScript and TSX files

Returns file paths sorted by modification time (newest first).`,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files',
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: working directory)',
        },
      },
      required: ['pattern'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as GlobParams;
      const { pattern, path } = params;

      // Determine search directory
      const searchDir = path
        ? resolve(context.safety.workingDir, path)
        : context.safety.workingDir;

      // Validate search directory is within working directory
      const relativeSearchDir = relative(context.safety.workingDir, searchDir);
      if (relativeSearchDir.startsWith('..')) {
        throw new Error(`Search path is outside working directory: ${path}`);
      }

      // Run glob search
      const files = await glob(pattern, {
        cwd: searchDir,
        nodir: true,
        dot: true,
        ignore: context.safety.blockedPaths,
        absolute: false,
      });

      if (files.length === 0) {
        return `No files matching "${pattern}" found in ${path || '.'}`;
      }

      // Get file stats for sorting by mtime
      const filesWithStats = files.map((file) => {
        const fullPath = join(searchDir, file);
        try {
          const stats = statSync(fullPath);
          return { file, mtime: stats.mtime.getTime() };
        } catch {
          return { file, mtime: 0 };
        }
      });

      // Sort by modification time (newest first)
      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      // Limit results
      const limited = filesWithStats.slice(0, MAX_FILES);
      const truncated = filesWithStats.length > MAX_FILES;

      // Format output
      const fileList = limited.map((f) => f.file).join('\n');

      let result = fileList;
      if (truncated) {
        result += `\n\n... and ${filesWithStats.length - MAX_FILES} more files`;
      }

      const header = `Found ${filesWithStats.length} file(s) matching "${pattern}":\n`;
      return header + result;
    },
  };
}
