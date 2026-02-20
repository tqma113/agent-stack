/**
 * @ai-stack/code - Edit Tool (Enhanced)
 *
 * Performs search-and-replace operations on files with multiple edit modes.
 * Based on Anthropic's recommendation to provide flexible, natural interfaces.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, relative, isAbsolute, normalize } from 'path';
import picomatch from 'picomatch';
import type { Tool, ToolExample } from '@ai-stack/agent';
import type { EditParams, EditMode, ToolContext } from '../types.js';
import { EditError, FileNotFoundError, FileNotReadError, PathError } from '../errors.js';
import { createContentValidator } from '../safety/content-validator.js';
import { getDiffSummary, createPatch } from '../file-history/diff-engine.js';
import { showDiffView } from '@ai-stack/tui';

/**
 * Create the Edit tool (enhanced with multiple modes)
 *
 * Based on Anthropic's recommendation:
 * - Provide multiple ways to express the same operation
 * - Avoid requiring exact string matches when possible
 * - Support natural language instructions for complex changes
 */
export function createEditTool(context: ToolContext): Tool {
  const contentValidator = createContentValidator(context.safety);

  return {
    name: 'Edit',
    description: `Edit a file with multiple modes for flexibility.

**Edit Modes**:
1. **Exact Match** (default): Replace exact string
   - Use \`old_string\` + \`new_string\`
   - Most precise, requires exact whitespace match

2. **Line-Based**: Replace lines by number
   - Use \`start_line\`, \`end_line\`, \`new_content\`
   - Good when you know the exact line numbers from Read output

3. **Fuzzy Match**: Flexible string matching
   - Use \`search_pattern\` + \`replacement\`
   - Supports * wildcards, ignores minor whitespace differences

**IMPORTANT**: You MUST read the file first before editing.`,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to the file to edit',
        },
        // Mode 1: Exact
        old_string: {
          type: 'string',
          description: 'Text to replace (exact match mode)',
        },
        new_string: {
          type: 'string',
          description: 'Replacement text',
        },
        // Mode 2: Line-based
        start_line: {
          type: 'number',
          description: 'Starting line number (1-indexed, line mode)',
        },
        end_line: {
          type: 'number',
          description: 'Ending line number (inclusive, line mode)',
        },
        new_content: {
          type: 'string',
          description: 'New content to replace the lines',
        },
        // Mode 3: Fuzzy
        search_pattern: {
          type: 'string',
          description: 'Pattern to search (supports * wildcard, fuzzy mode)',
        },
        replacement: {
          type: 'string',
          description: 'Replacement for fuzzy match',
        },
        // Options
        mode: {
          type: 'string',
          enum: ['exact', 'fuzzy', 'line'],
          description: 'Edit mode (auto-detected if not specified)',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences (default: false)',
        },
        preview_only: {
          type: 'boolean',
          description: 'Show diff without applying (default: false)',
        },
      },
      required: ['file_path'],
    },

    // Enhanced documentation (Anthropic's Poka-yoke principle)
    examples: [
      {
        input: {
          file_path: '/src/index.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 2;',
        },
        output: 'Edited src/index.ts: 1 replacement(s) (+0 -0 ~1)',
        description: 'Exact string replacement',
      },
      {
        input: {
          file_path: '/src/index.ts',
          start_line: 10,
          end_line: 12,
          new_content: 'function newImpl() {\n  return 42;\n}',
        },
        output: 'Edited src/index.ts: replaced lines 10-12 (+3 -3 ~0)',
        description: 'Line-based replacement using line numbers from Read',
      },
      {
        input: {
          file_path: '/src/index.ts',
          search_pattern: 'function * {',
          replacement: 'const $1 = () => {',
          replace_all: true,
        },
        output: 'Edited src/index.ts: 3 replacement(s)',
        description: 'Fuzzy pattern replacement with wildcards',
      },
    ] as ToolExample[],

    hints: [
      'Always read the file first to understand current content and get line numbers',
      'Use line mode when exact string matching is difficult (complex whitespace)',
      'Use fuzzy mode when the target text might have minor variations',
      'Use preview_only: true to verify changes before applying',
      'Line numbers from Read tool output correspond directly to start_line/end_line',
    ],

    edgeCases: [
      'Returns error if old_string not found (exact mode)',
      'Returns error if line range is out of bounds (line mode)',
      'Creates file if it does not exist (with warning)',
      'Multiple matches require replace_all: true or more context',
    ],

    returnFormat: 'Success message with change summary (+added -removed ~modified)',

    constraints: [
      'File must be read first before editing',
      'old_string must be unique unless replace_all is true',
    ],

    relatedTools: ['Read', 'Write', 'Undo', 'Redo'],

    antiPatterns: [
      'Do not edit without reading the file first',
      'Do not use exact mode for code with inconsistent formatting',
      'Do not make multiple small edits - combine into one larger edit',
    ],
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as EditParams;
      const {
        file_path,
        old_string,
        new_string,
        start_line,
        end_line,
        new_content,
        search_pattern,
        replacement,
        mode,
        replace_all = false,
        preview_only = false,
      } = params;

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

      // Detect edit mode
      const editMode = mode ?? detectEditMode(params);
      let afterContent: string;
      let changeDescription: string;

      switch (editMode) {
        case 'line':
          ({ afterContent, changeDescription } = applyLineEdit(
            beforeContent,
            start_line!,
            end_line,
            new_content!,
            file_path
          ));
          break;

        case 'fuzzy':
          ({ afterContent, changeDescription } = applyFuzzyEdit(
            beforeContent,
            search_pattern!,
            replacement!,
            replace_all,
            file_path
          ));
          break;

        case 'exact':
        default:
          ({ afterContent, changeDescription } = applyExactEdit(
            beforeContent,
            old_string!,
            new_string!,
            replace_all,
            file_path
          ));
          break;
      }

      // Validate new content for secrets
      contentValidator.validateOrThrow(afterContent, file_path);

      // Preview mode - return diff without applying
      if (preview_only) {
        const diff = createPatch(relativePath, beforeContent, afterContent);
        return `Preview of changes to ${relativePath}:\n\`\`\`diff\n${diff}\n\`\`\``;
      }

      // Show diff preview if confirmDestructive is enabled
      if (context.safety.confirmDestructive) {
        const confirmed = await showDiffView(relativePath, beforeContent, afterContent);
        if (!confirmed) {
          return `Edit operation cancelled by user: ${relativePath}`;
        }
      }

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
      return `Edited ${relativePath}: ${changeDescription} (${diffSummary})`;
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
 * Detect edit mode from parameters
 */
function detectEditMode(params: EditParams): EditMode {
  if (params.start_line !== undefined || params.new_content !== undefined) {
    return 'line';
  }
  if (params.search_pattern !== undefined) {
    return 'fuzzy';
  }
  return 'exact';
}

/**
 * Apply exact string replacement
 */
function applyExactEdit(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
  filePath: string
): { afterContent: string; changeDescription: string } {
  if (!oldString) {
    throw new EditError('old_string is required for exact mode', filePath);
  }
  if (newString === undefined) {
    throw new EditError('new_string is required for exact mode', filePath);
  }

  const occurrences = countOccurrences(content, oldString);
  if (occurrences === 0) {
    throw new EditError(
      'old_string not found in file. Make sure it matches exactly including whitespace.',
      filePath
    );
  }

  if (!replaceAll && occurrences > 1) {
    throw new EditError(
      `old_string matches ${occurrences} locations. Provide more context to make it unique, or use replace_all: true.`,
      filePath
    );
  }

  let afterContent: string;
  if (replaceAll) {
    afterContent = content.split(oldString).join(newString);
  } else {
    afterContent = content.replace(oldString, newString);
  }

  const replacementCount = replaceAll ? occurrences : 1;
  return {
    afterContent,
    changeDescription: `${replacementCount} replacement(s)`,
  };
}

/**
 * Apply line-based replacement
 */
function applyLineEdit(
  content: string,
  startLine: number,
  endLine: number | undefined,
  newContent: string,
  filePath: string
): { afterContent: string; changeDescription: string } {
  if (startLine === undefined) {
    throw new EditError('start_line is required for line mode', filePath);
  }
  if (newContent === undefined) {
    throw new EditError('new_content is required for line mode', filePath);
  }

  const lines = content.split('\n');
  const startIdx = startLine - 1;
  const endIdx = (endLine ?? startLine) - 1;

  if (startIdx < 0 || endIdx >= lines.length) {
    throw new EditError(
      `Line range ${startLine}-${endLine ?? startLine} is out of bounds (file has ${lines.length} lines)`,
      filePath
    );
  }

  if (startIdx > endIdx) {
    throw new EditError(
      `Invalid line range: start_line (${startLine}) must be <= end_line (${endLine})`,
      filePath
    );
  }

  const newLines = newContent.split('\n');
  const removedCount = endIdx - startIdx + 1;
  lines.splice(startIdx, removedCount, ...newLines);

  return {
    afterContent: lines.join('\n'),
    changeDescription: `replaced lines ${startLine}-${endLine ?? startLine}`,
  };
}

/**
 * Apply fuzzy pattern replacement
 */
function applyFuzzyEdit(
  content: string,
  searchPattern: string,
  replacement: string,
  replaceAll: boolean,
  filePath: string
): { afterContent: string; changeDescription: string } {
  if (!searchPattern) {
    throw new EditError('search_pattern is required for fuzzy mode', filePath);
  }
  if (replacement === undefined) {
    throw new EditError('replacement is required for fuzzy mode', filePath);
  }

  // Convert wildcard pattern to regex
  // Escape special regex chars, then convert * to .* and ? to .
  const regexPattern = searchPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars (except * and ?)
    .replace(/\*/g, '(.*?)')               // Convert * to non-greedy capture group
    .replace(/\?/g, '(.)')                 // Convert ? to single char capture
    .replace(/\s+/g, '\\s+');              // Flexible whitespace matching

  const regex = new RegExp(regexPattern, replaceAll ? 'g' : '');

  // Check if pattern matches
  const testMatch = regex.test(content);
  regex.lastIndex = 0; // Reset for actual replacement

  if (!testMatch) {
    throw new EditError(
      `Pattern "${searchPattern}" not found in file`,
      filePath
    );
  }

  // Count matches
  const matches = content.match(new RegExp(regexPattern, 'g'));
  const matchCount = matches?.length ?? 0;

  // Handle replacement with capture groups ($1, $2, etc.)
  const afterContent = content.replace(regex, replacement);

  return {
    afterContent,
    changeDescription: `${replaceAll ? matchCount : 1} fuzzy replacement(s)`,
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
