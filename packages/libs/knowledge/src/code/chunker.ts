/**
 * Code Chunker
 *
 * Smart code chunking with token-based splitting and overlap.
 */

import type { CodeBlock, CodeIndexerConfig } from '../types.js';
import { getParserForFile, detectLanguage, generateBlockId } from './languages/index.js';
// Import parsers to register them
import './languages/typescript.js';
import './languages/generic.js';

/**
 * Estimate token count (simple heuristic: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Chunker configuration
 */
export interface ChunkerConfig {
  /** Max tokens per chunk */
  maxTokens: number;
  /** Overlap tokens */
  overlapTokens: number;
  /** Include file header (imports, etc.) */
  includeFileHeader: boolean;
}

const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  maxTokens: 400,
  overlapTokens: 80,
  includeFileHeader: true,
};

/**
 * Chunker instance interface
 */
export interface ChunkerInstance {
  /** Chunk a file */
  chunkFile(filePath: string, content: string): CodeBlock[];

  /** Get supported languages */
  getSupportedLanguages(): string[];

  /** Detect language from file path */
  detectLanguage(filePath: string): string;
}

/**
 * Create a code chunker
 */
export function createChunker(config: Partial<ChunkerConfig> = {}): ChunkerInstance {
  const cfg: ChunkerConfig = { ...DEFAULT_CHUNKER_CONFIG, ...config };

  /**
   * Split a large block into smaller chunks
   */
  function splitBlock(block: CodeBlock): CodeBlock[] {
    const tokens = estimateTokens(block.content);

    // If block fits, return as-is
    if (tokens <= cfg.maxTokens) {
      return [block];
    }

    // Split by lines with overlap
    const lines = block.content.split('\n');
    const chunks: CodeBlock[] = [];

    let currentLines: string[] = [];
    let currentTokens = 0;
    let chunkStartLine = block.startLine;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineTokens = estimateTokens(line);

      // If adding this line exceeds max, create a chunk
      if (currentTokens + lineTokens > cfg.maxTokens && currentLines.length > 0) {
        // Create chunk
        const chunkContent = currentLines.join('\n');
        const chunkEndLine = chunkStartLine + currentLines.length - 1;

        chunks.push({
          ...block,
          id: `${block.id}_${chunkIndex}`,
          startLine: chunkStartLine,
          endLine: chunkEndLine,
          content: chunkContent,
        });

        // Calculate overlap
        const overlapTokens = cfg.overlapTokens;
        let overlapLines = 0;
        let overlapTokenCount = 0;

        for (let j = currentLines.length - 1; j >= 0 && overlapTokenCount < overlapTokens; j--) {
          overlapTokenCount += estimateTokens(currentLines[j]);
          overlapLines++;
        }

        // Start new chunk with overlap
        const overlapContent = currentLines.slice(-overlapLines);
        currentLines = [...overlapContent];
        currentTokens = overlapContent.reduce((sum, l) => sum + estimateTokens(l), 0);
        chunkStartLine = chunkEndLine - overlapLines + 1;
        chunkIndex++;
      }

      currentLines.push(line);
      currentTokens += lineTokens;
    }

    // Add remaining content
    if (currentLines.length > 0) {
      const chunkContent = currentLines.join('\n');
      const chunkEndLine = block.endLine;

      chunks.push({
        ...block,
        id: `${block.id}_${chunkIndex}`,
        startLine: chunkStartLine,
        endLine: chunkEndLine,
        content: chunkContent,
      });
    }

    return chunks;
  }

  /**
   * Extract file header (imports, etc.)
   */
  function extractFileHeader(blocks: CodeBlock[]): string | undefined {
    const importBlock = blocks.find((b) => b.symbolType === 'import');
    return importBlock?.content;
  }

  /**
   * Chunk a file into code blocks
   */
  function chunkFile(filePath: string, content: string): CodeBlock[] {
    // Get language-specific parser
    const parser = getParserForFile(filePath);

    let blocks: CodeBlock[];

    if (parser) {
      // Use language-specific parser
      blocks = parser.parse(filePath, content);
    } else {
      // Fallback: generic line-based chunking
      const language = detectLanguage(filePath);
      const lines = content.split('\n');

      blocks = [{
        id: generateBlockId(filePath, 'file', 1),
        filePath,
        language,
        symbolType: 'file',
        startLine: 1,
        endLine: lines.length,
        content: content.trim(),
      }];
    }

    // Extract file header for context
    const fileHeader = cfg.includeFileHeader ? extractFileHeader(blocks) : undefined;

    // Split large blocks
    const finalBlocks: CodeBlock[] = [];

    for (const block of blocks) {
      // Skip import blocks (already extracted as header)
      if ((block.symbolType as string) === 'import') {
        finalBlocks.push(block);
        continue;
      }

      const chunks = splitBlock(block);

      // Add file header context to non-import chunks if available
      if (fileHeader) {
        for (const chunk of chunks) {
          // Store header in dependencies for context
          if (!chunk.dependencies) {
            chunk.dependencies = [];
          }
          // We don't modify content, but keep reference to imports
        }
      }

      finalBlocks.push(...chunks);
    }

    return finalBlocks;
  }

  /**
   * Get supported languages
   */
  function getSupportedLanguages(): string[] {
    return ['typescript', 'javascript', 'markdown', 'json', 'text'];
  }

  return {
    chunkFile,
    getSupportedLanguages,
    detectLanguage,
  };
}

export { estimateTokens };
