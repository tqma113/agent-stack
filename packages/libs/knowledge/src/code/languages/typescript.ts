/**
 * TypeScript/JavaScript Parser
 *
 * Parses TypeScript and JavaScript files into code blocks using regex patterns.
 * This is a lightweight parser that doesn't require tree-sitter.
 */

import type { CodeBlock, CodeSymbolType } from '../../types.js';
import { type LanguageParser, registerParser, generateBlockId } from './index.js';

/**
 * Regex patterns for TypeScript/JavaScript
 */
const PATTERNS = {
  // Function declarations: function name(...) { or async function name(...)
  functionDecl: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\([^)]*\)/gm,

  // Arrow functions assigned to const/let/var: const name = (...) => or const name = async (...) =>
  arrowFunction: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/gm,

  // Class declarations: class Name { or export class Name extends/implements
  classDecl: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[^{]+)?\s*\{/gm,

  // Interface declarations: interface Name { or export interface Name extends
  interfaceDecl: /^(?:export\s+)?interface\s+(\w+)(?:\s+extends\s+[^{]+)?\s*\{/gm,

  // Type declarations: type Name = or export type Name =
  typeDecl: /^(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=/gm,

  // Enum declarations: enum Name { or export enum Name
  enumDecl: /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)\s*\{/gm,

  // Variable declarations with explicit type or initialization
  variableDecl: /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?!(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>)/gm,

  // JSDoc comments
  jsdoc: /\/\*\*[\s\S]*?\*\//g,

  // Import statements
  importStmt: /^import\s+.*?from\s+['"][^'"]+['"];?/gm,

  // Export statements (re-exports)
  exportStmt: /^export\s+(?:\*|{[^}]+})\s+from\s+['"][^'"]+['"];?/gm,
};

/**
 * Find the end of a block (matching braces)
 */
function findBlockEnd(content: string, startIndex: number): number {
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    const prevChar = content[i - 1];

    // Handle line comments
    if (!inString && !inComment && char === '/' && nextChar === '/') {
      inLineComment = true;
      continue;
    }

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    // Handle block comments
    if (!inString && char === '/' && nextChar === '*') {
      inComment = true;
      continue;
    }

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++; // Skip the '/'
      }
      continue;
    }

    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (inString) {
      if (char === stringChar && prevChar !== '\\') {
        inString = false;
      }
      continue;
    }

    // Count braces
    if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        return i + 1;
      }
    }
  }

  return content.length;
}

/**
 * Get line number from character index
 */
function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract JSDoc comment before a position
 */
function extractJSDoc(content: string, position: number): string | undefined {
  // Look backwards for JSDoc
  const before = content.substring(Math.max(0, position - 500), position);
  const match = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
  return match ? match[0].trim() : undefined;
}

/**
 * Parse TypeScript/JavaScript content
 */
function parseTypeScript(filePath: string, content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = content.split('\n');
  const language = filePath.endsWith('.ts') || filePath.endsWith('.tsx') ? 'typescript' : 'javascript';

  // Helper to add a block
  const addBlock = (
    symbolType: CodeSymbolType,
    symbolName: string | undefined,
    startLine: number,
    endLine: number,
    blockContent: string,
    docComment?: string,
    signature?: string
  ) => {
    blocks.push({
      id: generateBlockId(filePath, symbolType, startLine),
      filePath,
      language,
      symbolName,
      symbolType,
      startLine,
      endLine,
      content: blockContent.trim(),
      docComment,
      signature,
    });
  };

  // Parse imports (group them together)
  const importMatches = content.matchAll(PATTERNS.importStmt);
  let importStart = -1;
  let importEnd = -1;
  const imports: string[] = [];

  for (const match of importMatches) {
    const line = getLineNumber(content, match.index!);
    if (importStart === -1) importStart = line;
    importEnd = line;
    imports.push(match[0]);
  }

  if (imports.length > 0) {
    addBlock('import', undefined, importStart, importEnd, imports.join('\n'));
  }

  // Parse functions
  const funcMatches = [...content.matchAll(PATTERNS.functionDecl)];
  for (const match of funcMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    // Find the opening brace
    const braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) continue;

    const endIndex = findBlockEnd(content, braceIndex);
    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);

    // Extract signature (first line)
    const signature = blockContent.split('\n')[0].replace(/\s*\{$/, '').trim();

    addBlock('function', match[1], startLine, endLine, blockContent, docComment, signature);
  }

  // Parse arrow functions
  const arrowMatches = [...content.matchAll(PATTERNS.arrowFunction)];
  for (const match of arrowMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    // Find the arrow and then the body
    const arrowIndex = content.indexOf('=>', startIndex);
    if (arrowIndex === -1) continue;

    let endIndex: number;
    const afterArrow = content.substring(arrowIndex + 2).trimStart();

    if (afterArrow.startsWith('{')) {
      // Block body
      const braceIndex = content.indexOf('{', arrowIndex);
      endIndex = findBlockEnd(content, braceIndex);
    } else {
      // Expression body - find semicolon or newline
      const semiIndex = content.indexOf(';', arrowIndex);
      const newlineIndex = content.indexOf('\n', arrowIndex);
      endIndex = Math.min(
        semiIndex !== -1 ? semiIndex + 1 : content.length,
        newlineIndex !== -1 ? newlineIndex : content.length
      );
    }

    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);
    const signature = blockContent.split('\n')[0].trim();

    addBlock('function', match[1], startLine, endLine, blockContent, docComment, signature);
  }

  // Parse classes
  const classMatches = [...content.matchAll(PATTERNS.classDecl)];
  for (const match of classMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    const braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) continue;

    const endIndex = findBlockEnd(content, braceIndex);
    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);
    const signature = blockContent.split('{')[0].trim();

    addBlock('class', match[1], startLine, endLine, blockContent, docComment, signature);
  }

  // Parse interfaces
  const interfaceMatches = [...content.matchAll(PATTERNS.interfaceDecl)];
  for (const match of interfaceMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    const braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) continue;

    const endIndex = findBlockEnd(content, braceIndex);
    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);
    const signature = blockContent.split('{')[0].trim();

    addBlock('interface', match[1], startLine, endLine, blockContent, docComment, signature);
  }

  // Parse type aliases
  const typeMatches = [...content.matchAll(PATTERNS.typeDecl)];
  for (const match of typeMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    // Find the end (semicolon or next statement)
    let endIndex = content.indexOf(';', startIndex);
    if (endIndex === -1) endIndex = content.length;
    else endIndex += 1;

    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);

    addBlock('type', match[1], startLine, endLine, blockContent, docComment);
  }

  // Parse enums
  const enumMatches = [...content.matchAll(PATTERNS.enumDecl)];
  for (const match of enumMatches) {
    const startIndex = match.index!;
    const startLine = getLineNumber(content, startIndex);

    const braceIndex = content.indexOf('{', startIndex);
    if (braceIndex === -1) continue;

    const endIndex = findBlockEnd(content, braceIndex);
    const endLine = getLineNumber(content, endIndex);
    const blockContent = content.substring(startIndex, endIndex);
    const docComment = extractJSDoc(content, startIndex);

    addBlock('enum', match[1], startLine, endLine, blockContent, docComment);
  }

  // If no blocks found, treat the whole file as a single block
  if (blocks.length === 0) {
    addBlock('file', undefined, 1, lines.length, content);
  }

  // Sort by start line
  blocks.sort((a, b) => a.startLine - b.startLine);

  return blocks;
}

/**
 * TypeScript parser instance
 */
const typescriptParser: LanguageParser = {
  extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  language: 'typescript',
  parse: parseTypeScript,
};

// Register the parser
registerParser(typescriptParser);

export { typescriptParser };
