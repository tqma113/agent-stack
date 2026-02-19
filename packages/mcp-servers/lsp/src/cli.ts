#!/usr/bin/env node
/**
 * @ai-stack-mcp/lsp - CLI Entry Point
 */

import { runServer } from './server.js';
import type { LSPServerConfig, LanguageServerConfig } from './types.js';

/**
 * Parse command line arguments
 */
function parseArgs(): LSPServerConfig {
  const args = process.argv.slice(2);
  const config: LSPServerConfig = {
    name: process.env.MCP_LSP_NAME || 'ai-stack-mcp-lsp',
    version: process.env.MCP_LSP_VERSION || '0.0.1',
    workingDir: process.env.MCP_LSP_WORKING_DIR || process.cwd(),
    autoStartTypeScript: process.env.MCP_LSP_AUTO_START_TS !== 'false',
    languageServers: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--working-dir' || arg === '-w') {
      config.workingDir = args[++i];
    } else if (arg.startsWith('--working-dir=')) {
      config.workingDir = arg.slice('--working-dir='.length);
    } else if (arg === '--tsserver-path') {
      config.tsserverPath = args[++i];
    } else if (arg.startsWith('--tsserver-path=')) {
      config.tsserverPath = arg.slice('--tsserver-path='.length);
    } else if (arg === '--no-typescript') {
      config.autoStartTypeScript = false;
    } else if (arg === '--server') {
      // Format: --server languageId:command:args
      const serverSpec = args[++i];
      const parts = serverSpec.split(':');
      if (parts.length >= 2) {
        const lsConfig: LanguageServerConfig = {
          languageId: parts[0],
          command: parts[1],
          args: parts.slice(2),
        };
        config.languageServers!.push(lsConfig);
      }
    } else if (arg.startsWith('--server=')) {
      const serverSpec = arg.slice('--server='.length);
      const parts = serverSpec.split(':');
      if (parts.length >= 2) {
        const lsConfig: LanguageServerConfig = {
          languageId: parts[0],
          command: parts[1],
          args: parts.slice(2),
        };
        config.languageServers!.push(lsConfig);
      }
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Environment variable for TypeScript server path
  if (process.env.MCP_LSP_TSSERVER_PATH) {
    config.tsserverPath = process.env.MCP_LSP_TSSERVER_PATH;
  }

  return config;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
@ai-stack-mcp/lsp - MCP server providing Language Server Protocol integration

Usage: mcp-lsp [options]

Options:
  -w, --working-dir=PATH     Working directory (default: current directory)
  --tsserver-path=PATH       Path to typescript-language-server executable
  --no-typescript            Don't auto-start TypeScript language server
  --server=ID:CMD:ARGS       Add a language server (can be specified multiple times)
                             Format: languageId:command:arg1:arg2:...
  -h, --help                 Show this help message

Environment Variables:
  MCP_LSP_WORKING_DIR        Working directory
  MCP_LSP_TSSERVER_PATH      TypeScript server path
  MCP_LSP_AUTO_START_TS      Auto-start TypeScript server (default: true)

Tools Provided:
  lsp_get_diagnostics        Get diagnostics (errors, warnings) for a file
  lsp_go_to_definition       Get definition location for a symbol
  lsp_find_references        Find all references to a symbol
  lsp_get_completions        Get code completion suggestions
  lsp_get_hover              Get hover information (type, documentation)
  lsp_get_document_symbols   Get all symbols in a document
  lsp_get_workspace_symbols  Search for symbols across workspace
  lsp_format_document        Format a document
  lsp_rename_symbol          Rename a symbol across workspace
  lsp_get_code_actions       Get available code actions (quick fixes)
  lsp_start_server           Start a language server
  lsp_stop_server            Stop a language server
  lsp_list_servers           List running language servers

Examples:
  # Basic usage (auto-starts TypeScript server)
  mcp-lsp

  # Specify working directory
  mcp-lsp --working-dir=/path/to/project

  # Don't auto-start TypeScript, add Python server
  mcp-lsp --no-typescript --server=python:pyright-langserver:--stdio

  # Add multiple language servers
  mcp-lsp --server=rust:rust-analyzer --server=go:gopls

MCP Configuration Example:
  {
    "mcpServers": {
      "lsp": {
        "command": "npx",
        "args": ["-y", "@ai-stack-mcp/lsp", "--working-dir=/path/to/project"]
      }
    }
  }
`);
}

// Run the server
const config = parseArgs();
runServer(config).catch((error) => {
  console.error('Failed to start MCP LSP server:', error);
  process.exit(1);
});
