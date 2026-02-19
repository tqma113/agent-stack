/**
 * @ai-stack-mcp/lsp - Type Definitions
 */

import { z } from 'zod';

// =============================================================================
// Input Schemas
// =============================================================================

/**
 * Get diagnostics input schema
 */
export const GetDiagnosticsInputSchema = z.object({
  uri: z.string().describe('File URI (e.g., file:///path/to/file.ts)'),
});
export type GetDiagnosticsInput = z.infer<typeof GetDiagnosticsInputSchema>;

/**
 * Go to definition input schema
 */
export const GoToDefinitionInputSchema = z.object({
  uri: z.string().describe('File URI'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character offset (0-based)'),
});
export type GoToDefinitionInput = z.infer<typeof GoToDefinitionInputSchema>;

/**
 * Find references input schema
 */
export const FindReferencesInputSchema = z.object({
  uri: z.string().describe('File URI'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character offset (0-based)'),
  includeDeclaration: z.boolean().optional().default(true).describe('Include declaration in results'),
});
export type FindReferencesInput = z.infer<typeof FindReferencesInputSchema>;

/**
 * Get completions input schema
 */
export const GetCompletionsInputSchema = z.object({
  uri: z.string().describe('File URI'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character offset (0-based)'),
  limit: z.number().int().min(1).max(100).optional().default(20).describe('Maximum completions to return'),
});
export type GetCompletionsInput = z.infer<typeof GetCompletionsInputSchema>;

/**
 * Get hover info input schema
 */
export const GetHoverInputSchema = z.object({
  uri: z.string().describe('File URI'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character offset (0-based)'),
});
export type GetHoverInput = z.infer<typeof GetHoverInputSchema>;

/**
 * Get document symbols input schema
 */
export const GetDocumentSymbolsInputSchema = z.object({
  uri: z.string().describe('File URI'),
});
export type GetDocumentSymbolsInput = z.infer<typeof GetDocumentSymbolsInputSchema>;

/**
 * Workspace symbols input schema
 */
export const GetWorkspaceSymbolsInputSchema = z.object({
  query: z.string().describe('Symbol query string'),
  limit: z.number().int().min(1).max(100).optional().default(50).describe('Maximum symbols to return'),
});
export type GetWorkspaceSymbolsInput = z.infer<typeof GetWorkspaceSymbolsInputSchema>;

/**
 * Format document input schema
 */
export const FormatDocumentInputSchema = z.object({
  uri: z.string().describe('File URI'),
  tabSize: z.number().int().min(1).max(8).optional().default(2).describe('Tab size'),
  insertSpaces: z.boolean().optional().default(true).describe('Use spaces instead of tabs'),
});
export type FormatDocumentInput = z.infer<typeof FormatDocumentInputSchema>;

/**
 * Rename symbol input schema
 */
export const RenameSymbolInputSchema = z.object({
  uri: z.string().describe('File URI'),
  line: z.number().int().min(0).describe('Line number (0-based)'),
  character: z.number().int().min(0).describe('Character offset (0-based)'),
  newName: z.string().min(1).describe('New symbol name'),
});
export type RenameSymbolInput = z.infer<typeof RenameSymbolInputSchema>;

/**
 * Code actions input schema
 */
export const GetCodeActionsInputSchema = z.object({
  uri: z.string().describe('File URI'),
  startLine: z.number().int().min(0).describe('Start line (0-based)'),
  startCharacter: z.number().int().min(0).describe('Start character (0-based)'),
  endLine: z.number().int().min(0).describe('End line (0-based)'),
  endCharacter: z.number().int().min(0).describe('End character (0-based)'),
  diagnostics: z.array(z.string()).optional().describe('Diagnostic codes to filter by'),
});
export type GetCodeActionsInput = z.infer<typeof GetCodeActionsInputSchema>;

// =============================================================================
// Output Types
// =============================================================================

/**
 * Diagnostic severity
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

/**
 * Position in document
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * Range in document
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Location (uri + range)
 */
export interface Location {
  uri: string;
  range: Range;
}

/**
 * Diagnostic item
 */
export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: Array<{
    location: Location;
    message: string;
  }>;
}

/**
 * Completion item
 */
export interface CompletionItem {
  label: string;
  kind?: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
  sortText?: string;
}

/**
 * Symbol information
 */
export interface SymbolInfo {
  name: string;
  kind: string;
  location: Location;
  containerName?: string;
}

/**
 * Document symbol (hierarchical)
 */
export interface DocumentSymbol {
  name: string;
  kind: string;
  range: Range;
  selectionRange: Range;
  children?: DocumentSymbol[];
}

/**
 * Hover result
 */
export interface HoverResult {
  contents: string;
  range?: Range;
}

/**
 * Text edit
 */
export interface TextEdit {
  range: Range;
  newText: string;
}

/**
 * Workspace edit
 */
export interface WorkspaceEdit {
  changes: Record<string, TextEdit[]>;
}

/**
 * Code action
 */
export interface CodeAction {
  title: string;
  kind?: string;
  diagnostics?: Diagnostic[];
  isPreferred?: boolean;
  edit?: WorkspaceEdit;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Language server configuration
 */
export interface LanguageServerConfig {
  /** Language ID (e.g., 'typescript', 'python') */
  languageId: string;
  /** Server command to execute */
  command: string;
  /** Server command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Root URI for the workspace */
  rootUri?: string;
  /** File extensions handled by this server */
  fileExtensions?: string[];
}

/**
 * MCP LSP Server configuration
 */
export interface LSPServerConfig {
  /** Server name */
  name?: string;
  /** Server version */
  version?: string;
  /** Working directory */
  workingDir?: string;
  /** Language servers to connect to */
  languageServers?: LanguageServerConfig[];
  /** Whether to auto-start TypeScript server */
  autoStartTypeScript?: boolean;
  /** TypeScript server path (tsserver) */
  tsserverPath?: string;
}

// =============================================================================
// Errors
// =============================================================================

/**
 * LSP Server Error
 */
export class LSPServerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly languageId?: string
  ) {
    super(message);
    this.name = 'LSPServerError';
  }
}
