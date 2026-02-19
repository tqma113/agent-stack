/**
 * @ai-stack-mcp/lsp
 *
 * MCP server providing Language Server Protocol integration for code intelligence.
 *
 * Features:
 * - Diagnostics (errors, warnings)
 * - Go to definition
 * - Find references
 * - Code completions
 * - Hover information
 * - Document symbols
 * - Workspace symbols
 * - Document formatting
 * - Rename symbol
 * - Code actions
 *
 * @packageDocumentation
 */

// Server
export { createServer, runServer } from './server.js';

// Language Client Manager
export {
  createLanguageClientManager,
  type LanguageClientManager,
  type LanguageClientManagerInstance,
} from './language-client.js';

// Types
export type {
  // Input types
  GetDiagnosticsInput,
  GoToDefinitionInput,
  FindReferencesInput,
  GetCompletionsInput,
  GetHoverInput,
  GetDocumentSymbolsInput,
  GetWorkspaceSymbolsInput,
  FormatDocumentInput,
  RenameSymbolInput,
  GetCodeActionsInput,
  // Output types
  DiagnosticSeverity,
  Position,
  Range,
  Location,
  Diagnostic,
  CompletionItem,
  SymbolInfo,
  DocumentSymbol,
  HoverResult,
  TextEdit,
  WorkspaceEdit,
  CodeAction,
  // Config types
  LanguageServerConfig,
  LSPServerConfig,
} from './types.js';

export {
  // Input schemas
  GetDiagnosticsInputSchema,
  GoToDefinitionInputSchema,
  FindReferencesInputSchema,
  GetCompletionsInputSchema,
  GetHoverInputSchema,
  GetDocumentSymbolsInputSchema,
  GetWorkspaceSymbolsInputSchema,
  FormatDocumentInputSchema,
  RenameSymbolInputSchema,
  GetCodeActionsInputSchema,
  // Errors
  LSPServerError,
} from './types.js';
