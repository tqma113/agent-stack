/**
 * @ai-stack-mcp/lsp - MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolve } from 'path';
import { existsSync } from 'fs';
import type { LSPServerConfig, LanguageServerConfig } from './types.js';
import {
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
  LSPServerError,
} from './types.js';
import { createLanguageClientManager, type LanguageClientManager } from './language-client.js';

// Tool names
const TOOLS = {
  GET_DIAGNOSTICS: 'lsp_get_diagnostics',
  GO_TO_DEFINITION: 'lsp_go_to_definition',
  FIND_REFERENCES: 'lsp_find_references',
  GET_COMPLETIONS: 'lsp_get_completions',
  GET_HOVER: 'lsp_get_hover',
  GET_DOCUMENT_SYMBOLS: 'lsp_get_document_symbols',
  GET_WORKSPACE_SYMBOLS: 'lsp_get_workspace_symbols',
  FORMAT_DOCUMENT: 'lsp_format_document',
  RENAME_SYMBOL: 'lsp_rename_symbol',
  GET_CODE_ACTIONS: 'lsp_get_code_actions',
  START_SERVER: 'lsp_start_server',
  STOP_SERVER: 'lsp_stop_server',
  LIST_SERVERS: 'lsp_list_servers',
} as const;

/**
 * Create and configure the MCP server
 */
export function createServer(config: LSPServerConfig = {}) {
  const serverName = config.name || 'ai-stack-mcp-lsp';
  const serverVersion = config.version || '0.0.1';
  const workingDir = config.workingDir || process.cwd();

  const clientManager = createLanguageClientManager(workingDir);

  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: TOOLS.GET_DIAGNOSTICS,
          description: 'Get diagnostics (errors, warnings) for a file from the language server',
          inputSchema: {
            type: 'object',
            properties: {
              uri: {
                type: 'string',
                description: 'File URI (e.g., file:///path/to/file.ts)',
              },
            },
            required: ['uri'],
          },
        },
        {
          name: TOOLS.GO_TO_DEFINITION,
          description: 'Get the definition location for a symbol at a given position',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              line: { type: 'number', description: 'Line number (0-based)' },
              character: { type: 'number', description: 'Character offset (0-based)' },
            },
            required: ['uri', 'line', 'character'],
          },
        },
        {
          name: TOOLS.FIND_REFERENCES,
          description: 'Find all references to a symbol at a given position',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              line: { type: 'number', description: 'Line number (0-based)' },
              character: { type: 'number', description: 'Character offset (0-based)' },
              includeDeclaration: { type: 'boolean', description: 'Include declaration in results (default: true)' },
            },
            required: ['uri', 'line', 'character'],
          },
        },
        {
          name: TOOLS.GET_COMPLETIONS,
          description: 'Get code completion suggestions at a given position',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              line: { type: 'number', description: 'Line number (0-based)' },
              character: { type: 'number', description: 'Character offset (0-based)' },
              limit: { type: 'number', description: 'Maximum completions to return (default: 20)' },
            },
            required: ['uri', 'line', 'character'],
          },
        },
        {
          name: TOOLS.GET_HOVER,
          description: 'Get hover information (documentation, type) for a position',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              line: { type: 'number', description: 'Line number (0-based)' },
              character: { type: 'number', description: 'Character offset (0-based)' },
            },
            required: ['uri', 'line', 'character'],
          },
        },
        {
          name: TOOLS.GET_DOCUMENT_SYMBOLS,
          description: 'Get all symbols (functions, classes, variables) in a document',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
            },
            required: ['uri'],
          },
        },
        {
          name: TOOLS.GET_WORKSPACE_SYMBOLS,
          description: 'Search for symbols across the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Symbol search query' },
              limit: { type: 'number', description: 'Maximum symbols to return (default: 50)' },
            },
            required: ['query'],
          },
        },
        {
          name: TOOLS.FORMAT_DOCUMENT,
          description: 'Format a document according to the language server settings',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              tabSize: { type: 'number', description: 'Tab size (default: 2)' },
              insertSpaces: { type: 'boolean', description: 'Use spaces instead of tabs (default: true)' },
            },
            required: ['uri'],
          },
        },
        {
          name: TOOLS.RENAME_SYMBOL,
          description: 'Rename a symbol across the workspace',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              line: { type: 'number', description: 'Line number (0-based)' },
              character: { type: 'number', description: 'Character offset (0-based)' },
              newName: { type: 'string', description: 'New name for the symbol' },
            },
            required: ['uri', 'line', 'character', 'newName'],
          },
        },
        {
          name: TOOLS.GET_CODE_ACTIONS,
          description: 'Get code actions (quick fixes, refactorings) for a range',
          inputSchema: {
            type: 'object',
            properties: {
              uri: { type: 'string', description: 'File URI' },
              startLine: { type: 'number', description: 'Start line (0-based)' },
              startCharacter: { type: 'number', description: 'Start character (0-based)' },
              endLine: { type: 'number', description: 'End line (0-based)' },
              endCharacter: { type: 'number', description: 'End character (0-based)' },
              diagnostics: { type: 'array', items: { type: 'string' }, description: 'Diagnostic codes to filter by' },
            },
            required: ['uri', 'startLine', 'startCharacter', 'endLine', 'endCharacter'],
          },
        },
        {
          name: TOOLS.START_SERVER,
          description: 'Start a language server',
          inputSchema: {
            type: 'object',
            properties: {
              languageId: { type: 'string', description: 'Language ID (e.g., typescript, python)' },
              command: { type: 'string', description: 'Server command to execute' },
              args: { type: 'array', items: { type: 'string' }, description: 'Command arguments' },
            },
            required: ['languageId', 'command'],
          },
        },
        {
          name: TOOLS.STOP_SERVER,
          description: 'Stop a running language server',
          inputSchema: {
            type: 'object',
            properties: {
              languageId: { type: 'string', description: 'Language ID to stop' },
            },
            required: ['languageId'],
          },
        },
        {
          name: TOOLS.LIST_SERVERS,
          description: 'List all running language servers',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    try {
      switch (toolName) {
        case TOOLS.GET_DIAGNOSTICS: {
          const input = GetDiagnosticsInputSchema.parse(args);
          const diagnostics = await clientManager.getDiagnostics(input.uri);

          if (diagnostics.length === 0) {
            return { content: [{ type: 'text', text: 'No diagnostics found' }] };
          }

          const output = diagnostics.map((d) => {
            const loc = `${d.range.start.line + 1}:${d.range.start.character + 1}`;
            const code = d.code ? ` [${d.code}]` : '';
            const source = d.source ? ` (${d.source})` : '';
            return `${d.severity.toUpperCase()}${code}${source} at ${loc}: ${d.message}`;
          }).join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.GO_TO_DEFINITION: {
          const input = GoToDefinitionInputSchema.parse(args);
          const locations = await clientManager.getDefinition(input.uri, input.line, input.character);

          if (locations.length === 0) {
            return { content: [{ type: 'text', text: 'No definition found' }] };
          }

          const output = locations.map((loc) => {
            const line = loc.range.start.line + 1;
            const char = loc.range.start.character + 1;
            return `${loc.uri}:${line}:${char}`;
          }).join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.FIND_REFERENCES: {
          const input = FindReferencesInputSchema.parse(args);
          const locations = await clientManager.findReferences(
            input.uri,
            input.line,
            input.character,
            input.includeDeclaration
          );

          if (locations.length === 0) {
            return { content: [{ type: 'text', text: 'No references found' }] };
          }

          const output = locations.map((loc) => {
            const line = loc.range.start.line + 1;
            const char = loc.range.start.character + 1;
            return `${loc.uri}:${line}:${char}`;
          }).join('\n');

          return { content: [{ type: 'text', text: `Found ${locations.length} reference(s):\n${output}` }] };
        }

        case TOOLS.GET_COMPLETIONS: {
          const input = GetCompletionsInputSchema.parse(args);
          const completions = await clientManager.getCompletions(
            input.uri,
            input.line,
            input.character,
            input.limit
          );

          if (completions.length === 0) {
            return { content: [{ type: 'text', text: 'No completions available' }] };
          }

          const output = completions.map((c) => {
            const kind = c.kind ? `[${c.kind}]` : '';
            const detail = c.detail ? ` - ${c.detail}` : '';
            return `${c.label} ${kind}${detail}`;
          }).join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.GET_HOVER: {
          const input = GetHoverInputSchema.parse(args);
          const hover = await clientManager.getHover(input.uri, input.line, input.character);

          if (!hover) {
            return { content: [{ type: 'text', text: 'No hover information available' }] };
          }

          return { content: [{ type: 'text', text: hover.contents }] };
        }

        case TOOLS.GET_DOCUMENT_SYMBOLS: {
          const input = GetDocumentSymbolsInputSchema.parse(args);
          const symbols = await clientManager.getDocumentSymbols(input.uri);

          if (symbols.length === 0) {
            return { content: [{ type: 'text', text: 'No symbols found' }] };
          }

          function formatSymbol(sym: any, indent = 0): string {
            const prefix = '  '.repeat(indent);
            const line = sym.range.start.line + 1;
            let result = `${prefix}${sym.name} [${sym.kind}] at line ${line}`;
            if (sym.children) {
              result += '\n' + sym.children.map((c: any) => formatSymbol(c, indent + 1)).join('\n');
            }
            return result;
          }

          const output = symbols.map((s) => formatSymbol(s)).join('\n');
          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.GET_WORKSPACE_SYMBOLS: {
          const input = GetWorkspaceSymbolsInputSchema.parse(args);
          const symbols = await clientManager.getWorkspaceSymbols(input.query, input.limit);

          if (symbols.length === 0) {
            return { content: [{ type: 'text', text: 'No symbols found' }] };
          }

          const output = symbols.map((s) => {
            const loc = `${s.location.uri}:${s.location.range.start.line + 1}`;
            const container = s.containerName ? ` in ${s.containerName}` : '';
            return `${s.name} [${s.kind}]${container} at ${loc}`;
          }).join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.FORMAT_DOCUMENT: {
          const input = FormatDocumentInputSchema.parse(args);
          const edits = await clientManager.formatDocument(input.uri, input.tabSize, input.insertSpaces);

          if (edits.length === 0) {
            return { content: [{ type: 'text', text: 'No formatting changes needed' }] };
          }

          return { content: [{ type: 'text', text: JSON.stringify(edits, null, 2) }] };
        }

        case TOOLS.RENAME_SYMBOL: {
          const input = RenameSymbolInputSchema.parse(args);
          const edit = await clientManager.renameSymbol(input.uri, input.line, input.character, input.newName);

          const fileCount = Object.keys(edit.changes).length;
          const editCount = Object.values(edit.changes).flat().length;

          if (editCount === 0) {
            return { content: [{ type: 'text', text: 'No rename edits generated' }] };
          }

          return {
            content: [{
              type: 'text',
              text: `Rename would affect ${editCount} location(s) in ${fileCount} file(s):\n${JSON.stringify(edit, null, 2)}`,
            }],
          };
        }

        case TOOLS.GET_CODE_ACTIONS: {
          const input = GetCodeActionsInputSchema.parse(args);
          const actions = await clientManager.getCodeActions(
            input.uri,
            {
              start: { line: input.startLine, character: input.startCharacter },
              end: { line: input.endLine, character: input.endCharacter },
            },
            input.diagnostics
          );

          if (actions.length === 0) {
            return { content: [{ type: 'text', text: 'No code actions available' }] };
          }

          const output = actions.map((a, i) => {
            const kind = a.kind ? ` [${a.kind}]` : '';
            const preferred = a.isPreferred ? ' (preferred)' : '';
            return `${i + 1}. ${a.title}${kind}${preferred}`;
          }).join('\n');

          return { content: [{ type: 'text', text: output }] };
        }

        case TOOLS.START_SERVER: {
          const { languageId, command, args: cmdArgs } = args as any;
          const config: LanguageServerConfig = {
            languageId,
            command,
            args: cmdArgs,
            rootUri: `file://${resolve(workingDir)}`,
          };
          await clientManager.startServer(config);
          return { content: [{ type: 'text', text: `Started language server: ${languageId}` }] };
        }

        case TOOLS.STOP_SERVER: {
          const { languageId } = args as any;
          await clientManager.stopServer(languageId);
          return { content: [{ type: 'text', text: `Stopped language server: ${languageId}` }] };
        }

        case TOOLS.LIST_SERVERS: {
          const servers = clientManager.getRunningServers();
          if (servers.length === 0) {
            return { content: [{ type: 'text', text: 'No language servers running' }] };
          }
          return { content: [{ type: 'text', text: `Running servers:\n${servers.join('\n')}` }] };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
      }
    } catch (error) {
      let errorMessage: string;

      if (error instanceof LSPServerError) {
        errorMessage = `LSP Error [${error.code}]: ${error.message}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      return {
        content: [{ type: 'text', text: errorMessage }],
        isError: true,
      };
    }
  });

  // Auto-start TypeScript server if configured
  if (config.autoStartTypeScript !== false) {
    const tsserverPath = config.tsserverPath || 'typescript-language-server';
    const tsConfig: LanguageServerConfig = {
      languageId: 'typescript',
      command: tsserverPath,
      args: ['--stdio'],
      rootUri: `file://${resolve(workingDir)}`,
      fileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
    };

    // Start in background
    clientManager.startServer(tsConfig).catch((err) => {
      console.error('Failed to start TypeScript server:', err);
    });
  }

  // Start configured language servers
  if (config.languageServers) {
    for (const lsConfig of config.languageServers) {
      clientManager.startServer(lsConfig).catch((err) => {
        console.error(`Failed to start ${lsConfig.languageId} server:`, err);
      });
    }
  }

  // Cleanup on server close
  const originalClose = server.close.bind(server);
  server.close = async () => {
    await clientManager.stopAll();
    return originalClose();
  };

  return server;
}

/**
 * Run the server with stdio transport
 */
export async function runServer(config: LSPServerConfig = {}): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
