/**
 * Generic Text Parser
 *
 * Fallback parser for unsupported file types.
 * Splits content by logical sections or line count.
 */

import type { CodeBlock } from '../../types.js';
import { type LanguageParser, registerParser, generateBlockId, detectLanguage } from './index.js';

/**
 * Configuration for generic chunking
 */
interface GenericChunkConfig {
  /** Max lines per chunk */
  maxLinesPerChunk: number;
  /** Overlap lines */
  overlapLines: number;
}

const DEFAULT_CONFIG: GenericChunkConfig = {
  maxLinesPerChunk: 50,
  overlapLines: 5,
};

/**
 * Parse generic text content
 */
function parseGeneric(
  filePath: string,
  content: string,
  config: GenericChunkConfig = DEFAULT_CONFIG
): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');
  const language = detectLanguage(filePath);

  // For small files, return as single block
  if (lines.length <= config.maxLinesPerChunk) {
    blocks.push({
      id: generateBlockId(filePath, 'file', 1),
      filePath,
      language,
      symbolType: 'file',
      startLine: 1,
      endLine: lines.length,
      content: content.trim(),
    });
    return blocks;
  }

  // Split into chunks with overlap
  let startLine = 1;
  let chunkIndex = 0;

  while (startLine <= lines.length) {
    const endLine = Math.min(startLine + config.maxLinesPerChunk - 1, lines.length);
    const chunkLines = lines.slice(startLine - 1, endLine);
    const chunkContent = chunkLines.join('\n');

    blocks.push({
      id: generateBlockId(filePath, 'file', startLine),
      filePath,
      language,
      symbolType: 'file',
      startLine,
      endLine,
      content: chunkContent.trim(),
    });

    // Move to next chunk with overlap
    startLine = endLine - config.overlapLines + 1;
    if (startLine >= lines.length) break;

    chunkIndex++;
  }

  return blocks;
}

/**
 * Markdown parser - splits by headers
 */
function parseMarkdown(filePath: string, content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');

  // Find header positions
  const headers: Array<{ line: number; level: number; title: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headers.push({
        line: i + 1,
        level: match[1].length,
        title: match[2].trim(),
      });
    }
  }

  // If no headers, return as single block
  if (headers.length === 0) {
    blocks.push({
      id: generateBlockId(filePath, 'file', 1),
      filePath,
      language: 'markdown',
      symbolType: 'file',
      startLine: 1,
      endLine: lines.length,
      content: content.trim(),
    });
    return blocks;
  }

  // Split by headers
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const nextHeader = headers[i + 1];

    const startLine = header.line;
    const endLine = nextHeader ? nextHeader.line - 1 : lines.length;
    const sectionLines = lines.slice(startLine - 1, endLine);
    const sectionContent = sectionLines.join('\n');

    blocks.push({
      id: generateBlockId(filePath, 'comment', startLine),
      filePath,
      language: 'markdown',
      symbolName: header.title,
      symbolType: 'comment',
      startLine,
      endLine,
      content: sectionContent.trim(),
    });
  }

  return blocks;
}

/**
 * JSON parser - extracts top-level keys
 */
function parseJson(filePath: string, content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  try {
    const obj = JSON.parse(content);

    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      const lines = content.split('\n');

      // For each top-level key, try to find its position
      for (const key of Object.keys(obj)) {
        const keyPattern = new RegExp(`^\\s*"${key}"\\s*:`);

        for (let i = 0; i < lines.length; i++) {
          if (keyPattern.test(lines[i])) {
            // Find the extent of this value
            let endLine = i + 1;
            let braceCount = 0;
            let bracketCount = 0;
            let started = false;

            for (let j = i; j < lines.length; j++) {
              const line = lines[j];
              for (const char of line) {
                if (char === '{') {
                  braceCount++;
                  started = true;
                } else if (char === '}') {
                  braceCount--;
                } else if (char === '[') {
                  bracketCount++;
                  started = true;
                } else if (char === ']') {
                  bracketCount--;
                }
              }

              if (started && braceCount === 0 && bracketCount === 0) {
                endLine = j + 1;
                break;
              }

              // Simple value on same line
              if (!started && line.includes(',')) {
                endLine = j + 1;
                break;
              }
            }

            const blockContent = lines.slice(i, endLine).join('\n');

            blocks.push({
              id: generateBlockId(filePath, 'variable', i + 1),
              filePath,
              language: 'json',
              symbolName: key,
              symbolType: 'variable',
              startLine: i + 1,
              endLine,
              content: blockContent.trim(),
            });

            break;
          }
        }
      }
    }
  } catch {
    // Invalid JSON, fall back to generic parsing
  }

  // If no blocks found, return as single file block
  if (blocks.length === 0) {
    const lines = content.split('\n');
    blocks.push({
      id: generateBlockId(filePath, 'file', 1),
      filePath,
      language: 'json',
      symbolType: 'file',
      startLine: 1,
      endLine: lines.length,
      content: content.trim(),
    });
  }

  return blocks;
}

/**
 * Generic parser instance
 */
const genericParser: LanguageParser = {
  extensions: ['txt', 'text'],
  language: 'text',
  parse: parseGeneric,
};

/**
 * Markdown parser instance
 */
const markdownParser: LanguageParser = {
  extensions: ['md', 'mdx', 'markdown'],
  language: 'markdown',
  parse: parseMarkdown,
};

/**
 * JSON parser instance
 */
const jsonParser: LanguageParser = {
  extensions: ['json', 'jsonc'],
  language: 'json',
  parse: parseJson,
};

// Register parsers
registerParser(genericParser);
registerParser(markdownParser);
registerParser(jsonParser);

export { genericParser, markdownParser, jsonParser, parseGeneric };
