/**
 * @ai-stack-mcp/lsp - Language Client Manager
 *
 * Manages connections to language servers.
 */

import { spawn, ChildProcess } from 'child_process';
import { resolve, extname } from 'path';
import {
  createMessageConnection,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node';
import {
  InitializeParams,
  TextDocumentPositionParams,
  DiagnosticSeverity as LSPDiagnosticSeverity,
  SymbolKind,
  CompletionItemKind,
  Location as LSPLocation,
  Range as LSPRange,
  Position as LSPPosition,
  TextDocumentItem,
  TextDocumentIdentifier,
  CodeActionParams,
  FormattingOptions,
  ReferenceParams,
  RenameParams,
} from 'vscode-languageserver-protocol';
import { readFileSync, existsSync } from 'fs';
import type {
  LanguageServerConfig,
  Diagnostic,
  DiagnosticSeverity,
  Location,
  Range,
  Position,
  CompletionItem,
  SymbolInfo,
  DocumentSymbol,
  HoverResult,
  TextEdit,
  WorkspaceEdit,
  CodeAction,
} from './types.js';
import { LSPServerError } from './types.js';

/**
 * Active language client
 */
interface LanguageClient {
  config: LanguageServerConfig;
  process: ChildProcess;
  connection: MessageConnection;
  initialized: boolean;
  openDocuments: Set<string>;
  diagnostics: Map<string, Diagnostic[]>;
}

/**
 * Language Client Manager
 */
export interface LanguageClientManagerInstance {
  /** Start a language server */
  startServer(config: LanguageServerConfig): Promise<void>;
  /** Stop a language server */
  stopServer(languageId: string): Promise<void>;
  /** Stop all language servers */
  stopAll(): Promise<void>;
  /** Check if server is running */
  isServerRunning(languageId: string): boolean;
  /** Get running server IDs */
  getRunningServers(): string[];

  /** Open a document */
  openDocument(uri: string, languageId?: string): Promise<void>;
  /** Close a document */
  closeDocument(uri: string): Promise<void>;

  /** Get diagnostics for a file */
  getDiagnostics(uri: string): Promise<Diagnostic[]>;
  /** Go to definition */
  getDefinition(uri: string, line: number, character: number): Promise<Location[]>;
  /** Find references */
  findReferences(uri: string, line: number, character: number, includeDeclaration: boolean): Promise<Location[]>;
  /** Get completions */
  getCompletions(uri: string, line: number, character: number, limit: number): Promise<CompletionItem[]>;
  /** Get hover info */
  getHover(uri: string, line: number, character: number): Promise<HoverResult | null>;
  /** Get document symbols */
  getDocumentSymbols(uri: string): Promise<DocumentSymbol[]>;
  /** Get workspace symbols */
  getWorkspaceSymbols(query: string, limit: number): Promise<SymbolInfo[]>;
  /** Format document */
  formatDocument(uri: string, tabSize: number, insertSpaces: boolean): Promise<TextEdit[]>;
  /** Rename symbol */
  renameSymbol(uri: string, line: number, character: number, newName: string): Promise<WorkspaceEdit>;
  /** Get code actions */
  getCodeActions(uri: string, range: Range, diagnostics?: string[]): Promise<CodeAction[]>;
}

/**
 * Create a language client manager
 */
export function createLanguageClientManager(workingDir: string): LanguageClientManagerInstance {
  const clients = new Map<string, LanguageClient>();

  /**
   * Get language ID from file URI
   */
  function getLanguageIdFromUri(uri: string): string {
    const path = uri.replace('file://', '');
    const ext = extname(path).toLowerCase();

    const extMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
    };

    return extMap[ext] || 'plaintext';
  }

  /**
   * Get client for a URI
   */
  function getClientForUri(uri: string): LanguageClient | undefined {
    const languageId = getLanguageIdFromUri(uri);

    // Check for exact match
    if (clients.has(languageId)) {
      return clients.get(languageId);
    }

    // Check for TypeScript handling JavaScript
    if ((languageId === 'javascript' || languageId === 'javascriptreact') && clients.has('typescript')) {
      return clients.get('typescript');
    }

    // Check file extension matches
    for (const client of clients.values()) {
      if (client.config.fileExtensions) {
        const ext = extname(uri.replace('file://', '')).toLowerCase();
        if (client.config.fileExtensions.includes(ext)) {
          return client;
        }
      }
    }

    return undefined;
  }

  /**
   * Convert LSP diagnostic severity
   */
  function convertSeverity(severity?: LSPDiagnosticSeverity): DiagnosticSeverity {
    switch (severity) {
      case LSPDiagnosticSeverity.Error:
        return 'error';
      case LSPDiagnosticSeverity.Warning:
        return 'warning';
      case LSPDiagnosticSeverity.Information:
        return 'info';
      case LSPDiagnosticSeverity.Hint:
        return 'hint';
      default:
        return 'info';
    }
  }

  /**
   * Convert LSP position
   */
  function convertPosition(pos: LSPPosition): Position {
    return { line: pos.line, character: pos.character };
  }

  /**
   * Convert LSP range
   */
  function convertRange(range: LSPRange): Range {
    return {
      start: convertPosition(range.start),
      end: convertPosition(range.end),
    };
  }

  /**
   * Convert LSP location
   */
  function convertLocation(loc: LSPLocation): Location {
    return {
      uri: loc.uri,
      range: convertRange(loc.range),
    };
  }

  /**
   * Convert symbol kind
   */
  function convertSymbolKind(kind: SymbolKind): string {
    const kindMap: Record<SymbolKind, string> = {
      [SymbolKind.File]: 'file',
      [SymbolKind.Module]: 'module',
      [SymbolKind.Namespace]: 'namespace',
      [SymbolKind.Package]: 'package',
      [SymbolKind.Class]: 'class',
      [SymbolKind.Method]: 'method',
      [SymbolKind.Property]: 'property',
      [SymbolKind.Field]: 'field',
      [SymbolKind.Constructor]: 'constructor',
      [SymbolKind.Enum]: 'enum',
      [SymbolKind.Interface]: 'interface',
      [SymbolKind.Function]: 'function',
      [SymbolKind.Variable]: 'variable',
      [SymbolKind.Constant]: 'constant',
      [SymbolKind.String]: 'string',
      [SymbolKind.Number]: 'number',
      [SymbolKind.Boolean]: 'boolean',
      [SymbolKind.Array]: 'array',
      [SymbolKind.Object]: 'object',
      [SymbolKind.Key]: 'key',
      [SymbolKind.Null]: 'null',
      [SymbolKind.EnumMember]: 'enumMember',
      [SymbolKind.Struct]: 'struct',
      [SymbolKind.Event]: 'event',
      [SymbolKind.Operator]: 'operator',
      [SymbolKind.TypeParameter]: 'typeParameter',
    };
    return kindMap[kind] || 'unknown';
  }

  /**
   * Convert completion item kind
   */
  function convertCompletionKind(kind?: CompletionItemKind): string {
    if (!kind) return 'text';

    const kindMap: Record<CompletionItemKind, string> = {
      [CompletionItemKind.Text]: 'text',
      [CompletionItemKind.Method]: 'method',
      [CompletionItemKind.Function]: 'function',
      [CompletionItemKind.Constructor]: 'constructor',
      [CompletionItemKind.Field]: 'field',
      [CompletionItemKind.Variable]: 'variable',
      [CompletionItemKind.Class]: 'class',
      [CompletionItemKind.Interface]: 'interface',
      [CompletionItemKind.Module]: 'module',
      [CompletionItemKind.Property]: 'property',
      [CompletionItemKind.Unit]: 'unit',
      [CompletionItemKind.Value]: 'value',
      [CompletionItemKind.Enum]: 'enum',
      [CompletionItemKind.Keyword]: 'keyword',
      [CompletionItemKind.Snippet]: 'snippet',
      [CompletionItemKind.Color]: 'color',
      [CompletionItemKind.File]: 'file',
      [CompletionItemKind.Reference]: 'reference',
      [CompletionItemKind.Folder]: 'folder',
      [CompletionItemKind.EnumMember]: 'enumMember',
      [CompletionItemKind.Constant]: 'constant',
      [CompletionItemKind.Struct]: 'struct',
      [CompletionItemKind.Event]: 'event',
      [CompletionItemKind.Operator]: 'operator',
      [CompletionItemKind.TypeParameter]: 'typeParameter',
    };
    return kindMap[kind] || 'text';
  }

  /**
   * Read file content
   */
  function readFileContent(uri: string): string {
    const path = uri.replace('file://', '');
    if (!existsSync(path)) {
      throw new LSPServerError(`File not found: ${path}`, 'FILE_NOT_FOUND');
    }
    return readFileSync(path, 'utf-8');
  }

  const instance: LanguageClientManagerInstance = {
    async startServer(config: LanguageServerConfig): Promise<void> {
      if (clients.has(config.languageId)) {
        return; // Already running
      }

      // Spawn language server process
      const proc = spawn(config.command, config.args || [], {
        cwd: workingDir,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Create message connection
      const reader = new StreamMessageReader(proc.stdout!);
      const writer = new StreamMessageWriter(proc.stdin!);
      const connection = createMessageConnection(reader, writer);

      const client: LanguageClient = {
        config,
        process: proc,
        connection,
        initialized: false,
        openDocuments: new Set(),
        diagnostics: new Map(),
      };

      // Handle diagnostics
      connection.onNotification('textDocument/publishDiagnostics', (params: { uri: string; diagnostics: Array<{ range: LSPRange; severity?: LSPDiagnosticSeverity; code?: number | string; source?: string; message: string; relatedInformation?: Array<{ location: LSPLocation; message: string }> }> }) => {
        const diagnostics: Diagnostic[] = params.diagnostics.map((d: { range: LSPRange; severity?: LSPDiagnosticSeverity; code?: number | string; source?: string; message: string; relatedInformation?: Array<{ location: LSPLocation; message: string }> }) => ({
          range: convertRange(d.range),
          severity: convertSeverity(d.severity),
          code: d.code?.toString(),
          source: d.source,
          message: d.message,
          relatedInformation: d.relatedInformation?.map((ri: { location: LSPLocation; message: string }) => ({
            location: convertLocation(ri.location),
            message: ri.message,
          })),
        }));
        client.diagnostics.set(params.uri, diagnostics);
      });

      // Start connection
      connection.listen();

      // Initialize
      const rootUri = config.rootUri || `file://${resolve(workingDir)}`;

      const initParams: InitializeParams = {
        processId: process.pid,
        rootUri,
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: false,
              willSave: false,
              willSaveWaitUntil: false,
              didSave: true,
            },
            completion: {
              completionItem: {
                snippetSupport: true,
                documentationFormat: ['markdown', 'plaintext'],
              },
            },
            hover: {
              contentFormat: ['markdown', 'plaintext'],
            },
            definition: {
              dynamicRegistration: false,
            },
            references: {
              dynamicRegistration: false,
            },
            documentSymbol: {
              hierarchicalDocumentSymbolSupport: true,
            },
            codeAction: {
              codeActionLiteralSupport: {
                codeActionKind: {
                  valueSet: ['quickfix', 'refactor', 'source'],
                },
              },
            },
            rename: {
              dynamicRegistration: false,
            },
            formatting: {
              dynamicRegistration: false,
            },
            publishDiagnostics: {
              relatedInformation: true,
            },
          },
          workspace: {
            workspaceFolders: true,
            symbol: {
              dynamicRegistration: false,
            },
          },
        },
        workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
      };

      await connection.sendRequest('initialize', initParams);
      connection.sendNotification('initialized', {});

      client.initialized = true;
      clients.set(config.languageId, client);

      // Handle process exit
      proc.on('exit', () => {
        clients.delete(config.languageId);
      });
    },

    async stopServer(languageId: string): Promise<void> {
      const client = clients.get(languageId);
      if (!client) return;

      client.connection.dispose();
      client.process.kill();
      clients.delete(languageId);
    },

    async stopAll(): Promise<void> {
      const ids = Array.from(clients.keys());
      for (const id of ids) {
        await instance.stopServer(id);
      }
    },

    isServerRunning(languageId: string): boolean {
      return clients.has(languageId);
    },

    getRunningServers(): string[] {
      return Array.from(clients.keys());
    },

    async openDocument(uri: string, languageId?: string): Promise<void> {
      const client = languageId ? clients.get(languageId) : getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (client.openDocuments.has(uri)) {
        return; // Already open
      }

      const content = readFileContent(uri);
      const detectedLanguageId = languageId || getLanguageIdFromUri(uri);

      const textDocument: TextDocumentItem = {
        uri,
        languageId: detectedLanguageId,
        version: 1,
        text: content,
      };

      client.connection.sendNotification('textDocument/didOpen', { textDocument });
      client.openDocuments.add(uri);
    },

    async closeDocument(uri: string): Promise<void> {
      const client = getClientForUri(uri);
      if (!client || !client.openDocuments.has(uri)) {
        return;
      }

      const textDocument: TextDocumentIdentifier = { uri };
      client.connection.sendNotification('textDocument/didClose', { textDocument });
      client.openDocuments.delete(uri);
      client.diagnostics.delete(uri);
    },

    async getDiagnostics(uri: string): Promise<Diagnostic[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      // Ensure document is open
      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
        // Wait a bit for diagnostics
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return client.diagnostics.get(uri) || [];
    },

    async getDefinition(uri: string, line: number, character: number): Promise<Location[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params: TextDocumentPositionParams = {
        textDocument: { uri },
        position: { line, character },
      };

      const result = await client.connection.sendRequest('textDocument/definition', params);
      if (!result) return [];

      if (Array.isArray(result)) {
        return result.map((loc) => convertLocation(loc as LSPLocation));
      }
      return [convertLocation(result as LSPLocation)];
    },

    async findReferences(uri: string, line: number, character: number, includeDeclaration: boolean): Promise<Location[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params: ReferenceParams = {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration },
      };

      const result = await client.connection.sendRequest('textDocument/references', params) as LSPLocation[] | null;
      if (!result) return [];

      return result.map((loc) => convertLocation(loc));
    },

    async getCompletions(uri: string, line: number, character: number, limit: number): Promise<CompletionItem[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params: TextDocumentPositionParams = {
        textDocument: { uri },
        position: { line, character },
      };

      const result = await client.connection.sendRequest('textDocument/completion', params) as { items: Array<{ label: string; kind?: CompletionItemKind; detail?: string; documentation?: string | { value: string }; insertText?: string; sortText?: string }> } | Array<{ label: string; kind?: CompletionItemKind; detail?: string; documentation?: string | { value: string }; insertText?: string; sortText?: string }> | null;
      if (!result) return [];

      const items = Array.isArray(result) ? result : result.items;
      return items.slice(0, limit).map((item) => ({
        label: item.label,
        kind: convertCompletionKind(item.kind),
        detail: item.detail,
        documentation: typeof item.documentation === 'string' ? item.documentation : item.documentation?.value,
        insertText: item.insertText || item.label,
        sortText: item.sortText,
      }));
    },

    async getHover(uri: string, line: number, character: number): Promise<HoverResult | null> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params: TextDocumentPositionParams = {
        textDocument: { uri },
        position: { line, character },
      };

      const result = await client.connection.sendRequest('textDocument/hover', params) as { contents: string | { value: string } | Array<string | { value: string }>; range?: LSPRange } | null;
      if (!result) return null;

      let contents = '';
      if (typeof result.contents === 'string') {
        contents = result.contents;
      } else if ('value' in result.contents) {
        contents = result.contents.value;
      } else if (Array.isArray(result.contents)) {
        contents = result.contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n');
      }

      return {
        contents,
        range: result.range ? convertRange(result.range) : undefined,
      };
    },

    async getDocumentSymbols(uri: string): Promise<DocumentSymbol[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params = { textDocument: { uri } };
      type DocSymbolResult = Array<{ name: string; kind: SymbolKind; range: LSPRange; selectionRange?: LSPRange; children?: DocSymbolResult; location?: LSPLocation }>;
      const result = await client.connection.sendRequest('textDocument/documentSymbol', params) as DocSymbolResult | null;
      if (!result) return [];

      function convertDocSymbol(sym: any): DocumentSymbol {
        return {
          name: sym.name,
          kind: convertSymbolKind(sym.kind),
          range: convertRange(sym.range),
          selectionRange: convertRange(sym.selectionRange || sym.range),
          children: sym.children?.map(convertDocSymbol),
        };
      }

      // Check if hierarchical or flat
      if (result[0] && 'range' in result[0]) {
        return result.map(convertDocSymbol);
      }

      // Flat symbols
      return result.map((sym: any) => ({
        name: sym.name,
        kind: convertSymbolKind(sym.kind),
        range: convertRange(sym.location.range),
        selectionRange: convertRange(sym.location.range),
      }));
    },

    async getWorkspaceSymbols(query: string, limit: number): Promise<SymbolInfo[]> {
      // Use first available client
      const client = clients.values().next().value;
      if (!client) {
        throw new LSPServerError('No language server available', 'NO_SERVER');
      }

      type WorkspaceSymbolResult = Array<{ name: string; kind: SymbolKind; location: LSPLocation | { uri: string }; containerName?: string }>;
      const result = await client.connection.sendRequest('workspace/symbol', { query }) as WorkspaceSymbolResult | null;
      if (!result) return [];

      return result.slice(0, limit).map((sym) => {
        // Handle both Location and { uri: string } shapes
        const loc = 'range' in sym.location
          ? convertLocation(sym.location as LSPLocation)
          : { uri: sym.location.uri, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } } };
        return {
          name: sym.name,
          kind: convertSymbolKind(sym.kind),
          location: loc,
          containerName: sym.containerName,
        };
      });
    },

    async formatDocument(uri: string, tabSize: number, insertSpaces: boolean): Promise<TextEdit[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const options: FormattingOptions = { tabSize, insertSpaces };
      const params = { textDocument: { uri }, options };

      type FormattingResult = Array<{ range: LSPRange; newText: string }>;
      const result = await client.connection.sendRequest('textDocument/formatting', params) as FormattingResult | null;
      if (!result) return [];

      return result.map((edit) => ({
        range: convertRange(edit.range),
        newText: edit.newText,
      }));
    },

    async renameSymbol(uri: string, line: number, character: number, newName: string): Promise<WorkspaceEdit> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      const params: RenameParams = {
        textDocument: { uri },
        position: { line, character },
        newName,
      };

      type RenameResult = { changes?: Record<string, Array<{ range: LSPRange; newText: string }>> };
      const result = await client.connection.sendRequest('textDocument/rename', params) as RenameResult | null;
      if (!result || !result.changes) {
        return { changes: {} };
      }

      const changes: Record<string, TextEdit[]> = {};
      for (const [fileUri, edits] of Object.entries(result.changes)) {
        changes[fileUri] = edits.map((edit) => ({
          range: convertRange(edit.range),
          newText: edit.newText,
        }));
      }

      return { changes };
    },

    async getCodeActions(uri: string, range: Range, diagnostics?: string[]): Promise<CodeAction[]> {
      const client = getClientForUri(uri);
      if (!client) {
        throw new LSPServerError('No language server available for this file type', 'NO_SERVER');
      }

      if (!client.openDocuments.has(uri)) {
        await instance.openDocument(uri);
      }

      // Get diagnostics in range
      const fileDiagnostics = client.diagnostics.get(uri) || [];
      const relevantDiagnostics = fileDiagnostics.filter((d) => {
        if (diagnostics && d.code && !diagnostics.includes(d.code.toString())) {
          return false;
        }
        return (
          d.range.start.line >= range.start.line &&
          d.range.end.line <= range.end.line
        );
      });

      const params: CodeActionParams = {
        textDocument: { uri },
        range: {
          start: { line: range.start.line, character: range.start.character },
          end: { line: range.end.line, character: range.end.character },
        },
        context: {
          diagnostics: relevantDiagnostics.map((d) => ({
            range: {
              start: { line: d.range.start.line, character: d.range.start.character },
              end: { line: d.range.end.line, character: d.range.end.character },
            },
            severity: d.severity === 'error' ? 1 : d.severity === 'warning' ? 2 : 3,
            message: d.message,
            code: d.code,
            source: d.source,
          })),
        },
      };

      type CodeActionResult = Array<{ title: string; command?: unknown; kind?: string; isPreferred?: boolean; edit?: { changes?: Record<string, Array<{ range: LSPRange; newText: string }>> } }>;
      const result = await client.connection.sendRequest('textDocument/codeAction', params) as CodeActionResult | null;
      if (!result) return [];

      return result.map((action) => {
        // Handle both Command and CodeAction
        if ('command' in action && !('kind' in action)) {
          // This is a Command, not a CodeAction
          return {
            title: action.title,
          };
        }

        // This is a CodeAction
        if (action.edit?.changes) {
          const changes: Record<string, TextEdit[]> = {};
          for (const [fileUri, edits] of Object.entries(action.edit.changes)) {
            changes[fileUri] = edits.map((edit) => ({
              range: convertRange(edit.range),
              newText: edit.newText,
            }));
          }
          return {
            title: action.title,
            kind: action.kind,
            isPreferred: action.isPreferred,
            edit: { changes },
          };
        }
        return {
          title: action.title,
          kind: action.kind,
          isPreferred: action.isPreferred,
        };
      });
    },
  };

  return instance;
}

export type LanguageClientManager = LanguageClientManagerInstance;
