/**
 * @ai-stack/code - Read Tool
 *
 * Reads file content with line numbers.
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, relative, isAbsolute, normalize } from 'path';
import picomatch from 'picomatch';
import type { Tool, ToolExample } from '@ai-stack/agent';
import type { ReadParams, ReadFormat, ToolContext } from '../types.js';
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
 * Create the Read tool (enhanced with multiple output formats)
 */
export function createReadTool(context: ToolContext): Tool {
  return {
    name: 'Read',
    description: `Read a file from the filesystem. Output includes line numbers for easy reference.

**Output Formats**:
- \`numbered\` (default): Line numbers with separator, ideal for subsequent edits
- \`plain\`: Raw content without line numbers, for understanding content only`,
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
        format: {
          type: 'string',
          enum: ['numbered', 'plain'],
          description: 'Output format (default: numbered)',
        },
      },
      required: ['file_path'],
    },

    // Enhanced documentation (Anthropic's Poka-yoke principle)
    examples: [
      {
        input: { file_path: '/src/index.ts' },
        output: '  1 | import { foo } from "./foo";\n  2 | \n  3 | export function main() {',
        description: 'Read file with numbered format (default)',
      },
      {
        input: { file_path: '/src/index.ts', offset: 10, limit: 5 },
        output: '[Lines 10-14 of 100]\n 10 | function helper() {\n 11 |   return 42;',
        description: 'Read specific line range',
      },
      {
        input: { file_path: '/src/index.ts', format: 'plain' },
        output: 'import { foo } from "./foo";\n\nexport function main() {',
        description: 'Read with plain format (no line numbers)',
      },
    ] as ToolExample[],

    hints: [
      'Always use absolute paths, not relative paths',
      'Use numbered format when you need to make subsequent edits',
      'Use plain format for quick content review',
      'For large files, use offset/limit to read in chunks',
      'Line numbers in output correspond directly to Edit tool parameters',
    ],

    edgeCases: [
      'Returns error message if file does not exist',
      'Binary files return "[Binary file - content not displayed]"',
      'Empty files return empty string with no line numbers',
      'Lines longer than 2000 characters are truncated with "... (truncated)"',
    ],

    returnFormat: 'Line-numbered content: "  N | content" or plain text based on format',

    constraints: [
      `Max lines per request: ${DEFAULT_LIMIT}`,
      `Max line length: ${MAX_LINE_LENGTH} characters`,
    ],

    relatedTools: ['Edit', 'Write', 'Glob', 'Grep'],

    antiPatterns: [
      'Do not use for binary files (images, executables)',
      'Do not read entire large files - use offset/limit to paginate',
      'Prefer Grep for searching content instead of reading and parsing manually',
    ],
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as ReadParams;
      const { file_path, offset = 1, limit = DEFAULT_LIMIT, format = 'numbered' } = params;

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

      // Plain format - no line numbers
      if (format === 'plain') {
        const plainLines = selectedLines.map((line) => {
          return line.length > MAX_LINE_LENGTH
            ? line.slice(0, MAX_LINE_LENGTH) + '... (truncated)'
            : line;
        });

        let result = plainLines.join('\n');
        if (startIndex > 0 || endIndex < lines.length) {
          result = `[Lines ${offset}-${endIndex} of ${lines.length}]\n${result}`;
        }
        return result;
      }

      // Numbered format (default) - with clear visual separator
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
        // Use ' | ' separator for better readability (natural text format)
        return `${paddedNum} | ${truncatedLine}`;
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
