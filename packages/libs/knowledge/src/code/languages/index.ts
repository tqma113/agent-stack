/**
 * Language Parser Registry
 *
 * Manages language-specific code parsers.
 */

import type { CodeBlock, CodeSymbolType } from '../../types.js';

/**
 * Language parser interface
 */
export interface LanguageParser {
  /** Supported file extensions */
  extensions: string[];

  /** Language name */
  language: string;

  /** Parse file content into code blocks */
  parse(filePath: string, content: string): CodeBlock[];
}

/**
 * Parser registry
 */
const parsers = new Map<string, LanguageParser>();

/**
 * Register a language parser
 */
export function registerParser(parser: LanguageParser): void {
  for (const ext of parser.extensions) {
    parsers.set(ext.toLowerCase(), parser);
  }
}

/**
 * Get parser for file extension
 */
export function getParser(extension: string): LanguageParser | undefined {
  return parsers.get(extension.toLowerCase().replace(/^\./, ''));
}

/**
 * Get parser for file path
 */
export function getParserForFile(filePath: string): LanguageParser | undefined {
  const ext = filePath.split('.').pop();
  if (!ext) return undefined;
  return getParser(ext);
}

/**
 * Detect language from file path
 */
export function detectLanguage(filePath: string): string {
  const parser = getParserForFile(filePath);
  if (parser) return parser.language;

  // Fallback based on extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    md: 'markdown',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
  };

  return languageMap[ext || ''] || 'text';
}

/**
 * Get all supported extensions
 */
export function getSupportedExtensions(): string[] {
  return Array.from(parsers.keys());
}

/**
 * Generate unique block ID
 */
export function generateBlockId(filePath: string, symbolType: CodeSymbolType, startLine: number): string {
  const hash = simpleHash(`${filePath}:${symbolType}:${startLine}`);
  return `code_${hash}`;
}

/**
 * Simple hash function
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

