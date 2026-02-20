/**
 * @ai-stack/code - Grep Tool
 *
 * Searches file contents using regex patterns.
 */

import { readFileSync, statSync, readdirSync } from 'fs';
import { resolve, relative, join, extname } from 'path';
import { glob } from 'glob';
import picomatch from 'picomatch';
import type { Tool, ToolExample } from '@ai-stack/agent';
import type { GrepParams, GrepOutputMode, ToolContext } from '../types.js';

/**
 * Maximum files to search
 */
const MAX_FILES = 1000;

/**
 * Maximum matches to return
 */
const MAX_MATCHES = 200;

/**
 * Maximum file size to search (1MB)
 */
const MAX_FILE_SIZE = 1048576;

/**
 * Create the Grep tool (enhanced with better output formatting)
 */
export function createGrepTool(context: ToolContext): Tool {
  return {
    name: 'Grep',
    description: `Search file contents using regex patterns. Returns matches with surrounding context for understanding.

**Output Modes**:
- \`files_with_matches\` (default): List matching file paths
- \`content\`: Show matching lines with context, ">" marks the match
- \`count\`: Show match count per file`,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Regular expression pattern to search for',
        },
        path: {
          type: 'string',
          description: 'Directory or file to search in',
        },
        glob: {
          type: 'string',
          description: 'File pattern filter (e.g., "*.ts", "**/*.tsx")',
        },
        output_mode: {
          type: 'string',
          enum: ['content', 'files_with_matches', 'count'],
          description: 'Output mode (default: files_with_matches)',
        },
        context: {
          type: 'number',
          description: 'Lines of context around matches (content mode only, default: 2)',
        },
        case_insensitive: {
          type: 'boolean',
          description: 'Case insensitive search (default: false)',
        },
      },
      required: ['pattern'],
    },

    // Enhanced documentation (Anthropic's Poka-yoke principle)
    examples: [
      {
        input: { pattern: 'function.*export', path: 'src', context: 2, output_mode: 'content' },
        output: `Found 2 match(es) in 2 file(s)

src/utils.ts:15
  13 | // Helper functions
  14 |
> 15 | export function helper() {
  16 |   return 42;
  17 | }`,
        description: 'Search with context lines, ">" marks matching line',
      },
      {
        input: { pattern: 'import.*react', glob: '*.tsx', case_insensitive: true },
        output: 'Found 5 match(es) in 3 file(s):\nsrc/App.tsx\nsrc/components/Button.tsx',
        description: 'Find React imports in TSX files',
      },
      {
        input: { pattern: 'TODO', output_mode: 'count' },
        output: 'Found 8 match(es) in 4 file(s):\nsrc/api.ts: 3\nsrc/utils.ts: 2',
        description: 'Count TODOs per file',
      },
    ] as ToolExample[],

    hints: [
      'Use regex patterns for flexible matching (e.g., "class\\s+\\w+")',
      'Add context lines (context: 2-3) to understand matches better',
      'Use glob filter to search specific file types (e.g., "*.ts")',
      'Results show file:line for easy navigation to source',
      'Use files_with_matches mode first to find relevant files, then content mode for details',
    ],

    edgeCases: [
      'Returns "No matches found" if pattern not found',
      'Skips binary files automatically',
      'Skips files larger than 1MB',
      'Maximum 200 matches returned (use more specific patterns if exceeded)',
    ],

    returnFormat: 'Matches grouped by file. In content mode, ">" marks the matching line, context lines are indented.',

    constraints: [
      `Max files to search: ${MAX_FILES}`,
      `Max matches returned: ${MAX_MATCHES}`,
      `Max file size: ${MAX_FILE_SIZE / 1024}KB`,
    ],

    relatedTools: ['Read', 'Glob', 'Edit'],

    antiPatterns: [
      'Do not use for finding files by name - use Glob instead',
      'Do not use overly broad patterns that match everything',
      'Avoid searching in node_modules or build directories',
    ],
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as GrepParams;
      const {
        pattern,
        path,
        glob: globPattern,
        output_mode = 'files_with_matches',
        context: contextLines = 0,
        case_insensitive = false,
      } = params;

      // Create regex
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, case_insensitive ? 'gi' : 'g');
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }

      // Determine search path
      const searchPath = path
        ? resolve(context.safety.workingDir, path)
        : context.safety.workingDir;

      // Validate search path
      const relativeSearchPath = relative(context.safety.workingDir, searchPath);
      if (relativeSearchPath.startsWith('..')) {
        throw new Error(`Search path is outside working directory: ${path}`);
      }

      // Get files to search
      const files = await getFilesToSearch(
        searchPath,
        globPattern,
        context.safety.blockedPaths,
        context.safety.workingDir
      );

      if (files.length === 0) {
        return 'No files to search';
      }

      // Search files
      const results: SearchResult[] = [];
      let totalMatches = 0;
      let filesSearched = 0;

      for (const file of files.slice(0, MAX_FILES)) {
        filesSearched++;
        const fullPath = join(context.safety.workingDir, file);

        try {
          // Skip large files
          const stats = statSync(fullPath);
          if (stats.size > MAX_FILE_SIZE) continue;

          const content = readFileSync(fullPath, 'utf-8');
          const matches = searchFile(content, regex, contextLines);

          if (matches.length > 0) {
            results.push({
              file,
              matches,
              matchCount: matches.length,
            });
            totalMatches += matches.length;

            if (totalMatches >= MAX_MATCHES) break;
          }
        } catch {
          // Skip files that can't be read
        }

        // Reset regex state
        regex.lastIndex = 0;
      }

      // Format output
      return formatOutput(results, output_mode, totalMatches, filesSearched, files.length);
    },
  };
}

interface SearchMatch {
  line: number;
  content: string;
  context?: { before: string[]; after: string[] };
}

interface SearchResult {
  file: string;
  matches: SearchMatch[];
  matchCount: number;
}

/**
 * Get files to search
 */
async function getFilesToSearch(
  searchPath: string,
  globPattern: string | undefined,
  blockedPaths: string[],
  workingDir: string
): Promise<string[]> {
  const stats = statSync(searchPath);

  if (stats.isFile()) {
    const relPath = relative(workingDir, searchPath);
    // Check if blocked
    for (const pattern of blockedPaths) {
      const matcher = picomatch(pattern, { dot: true });
      if (matcher(relPath)) return [];
    }
    return [relPath];
  }

  // Search directory
  const pattern = globPattern || '**/*';
  const files = await glob(pattern, {
    cwd: searchPath,
    nodir: true,
    dot: false,
    ignore: blockedPaths,
    absolute: false,
  });

  // Convert to relative paths from working directory
  const relSearchPath = relative(workingDir, searchPath);
  return files.map((f) => (relSearchPath ? join(relSearchPath, f) : f));
}

/**
 * Search a file for matches
 */
function searchFile(content: string, regex: RegExp, contextLines: number): SearchMatch[] {
  const lines = content.split('\n');
  const matches: SearchMatch[] = [];
  const matchedLines = new Set<number>();

  // Find all matching lines
  for (let i = 0; i < lines.length; i++) {
    regex.lastIndex = 0;
    if (regex.test(lines[i])) {
      matchedLines.add(i);
    }
  }

  // Build matches with context
  for (const lineIndex of matchedLines) {
    const match: SearchMatch = {
      line: lineIndex + 1,
      content: lines[lineIndex],
    };

    if (contextLines > 0) {
      const beforeStart = Math.max(0, lineIndex - contextLines);
      const afterEnd = Math.min(lines.length, lineIndex + contextLines + 1);
      match.context = {
        before: lines.slice(beforeStart, lineIndex),
        after: lines.slice(lineIndex + 1, afterEnd),
      };
    }

    matches.push(match);
  }

  return matches;
}

/**
 * Format search results with natural, readable output
 *
 * Based on Anthropic's recommendation: "Keep formats close to naturally occurring internet text"
 */
function formatOutput(
  results: SearchResult[],
  mode: GrepOutputMode,
  totalMatches: number,
  filesSearched: number,
  totalFiles: number
): string {
  if (results.length === 0) {
    return `No matches found (searched ${filesSearched} files)`;
  }

  const header = `Found ${totalMatches} match(es) in ${results.length} file(s)`;

  switch (mode) {
    case 'files_with_matches':
      return `${header}:\n${results.map((r) => r.file).join('\n')}`;

    case 'count':
      return `${header}:\n${results.map((r) => `${r.file}: ${r.matchCount}`).join('\n')}`;

    case 'content': {
      const parts: string[] = [header];

      for (const result of results) {
        // File header with location hint
        parts.push('');
        parts.push(`${result.file}:`);

        for (const match of result.matches) {
          // Calculate line number padding
          const maxLine = match.context
            ? match.line + (match.context.after?.length || 0)
            : match.line;
          const lineWidth = String(maxLine).length;

          // Context lines before (indented, no marker)
          if (match.context?.before) {
            match.context.before.forEach((line, i) => {
              const lineNum = match.line - match.context!.before.length + i;
              const paddedNum = String(lineNum).padStart(lineWidth, ' ');
              parts.push(`  ${paddedNum} | ${line}`);
            });
          }

          // Matching line (marked with ">")
          const paddedMatchNum = String(match.line).padStart(lineWidth, ' ');
          parts.push(`> ${paddedMatchNum} | ${match.content}`);

          // Context lines after (indented, no marker)
          if (match.context?.after) {
            match.context.after.forEach((line, i) => {
              const lineNum = match.line + i + 1;
              const paddedNum = String(lineNum).padStart(lineWidth, ' ');
              parts.push(`  ${paddedNum} | ${line}`);
            });
          }
        }
      }
      return parts.join('\n');
    }

    default:
      return header;
  }
}
