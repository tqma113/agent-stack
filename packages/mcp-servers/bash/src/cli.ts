#!/usr/bin/env node
/**
 * CLI entry point for @ai-stack-mcp/bash
 */

import { runServer } from './server.js';
import type { ServerConfig } from './types.js';

// Parse command line arguments
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    name: process.env.MCP_BASH_NAME || 'ai-stack-mcp-bash',
    version: process.env.MCP_BASH_VERSION || '0.0.1',
  };

  // Parse blocked commands from environment
  if (process.env.MCP_BASH_BLOCKED_COMMANDS) {
    config.blockedCommands = process.env.MCP_BASH_BLOCKED_COMMANDS.split(',').map(s => s.trim());
  }

  // Parse allowed commands (whitelist mode) from environment
  if (process.env.MCP_BASH_ALLOWED_COMMANDS) {
    config.allowedCommands = process.env.MCP_BASH_ALLOWED_COMMANDS.split(',').map(s => s.trim());
  }

  // Parse background settings from environment
  if (process.env.MCP_BASH_ALLOW_BACKGROUND !== undefined) {
    config.allowBackground = process.env.MCP_BASH_ALLOW_BACKGROUND !== 'false';
  }

  if (process.env.MCP_BASH_MAX_BACKGROUND_PROCESSES) {
    config.maxBackgroundProcesses = parseInt(process.env.MCP_BASH_MAX_BACKGROUND_PROCESSES, 10);
  }

  // Parse default timeout
  if (process.env.MCP_BASH_DEFAULT_TIMEOUT) {
    config.defaultTimeout = parseInt(process.env.MCP_BASH_DEFAULT_TIMEOUT, 10);
  }

  // Parse max buffer size
  if (process.env.MCP_BASH_MAX_BUFFER_SIZE) {
    config.maxBufferSize = parseInt(process.env.MCP_BASH_MAX_BUFFER_SIZE, 10);
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--working-dir' || arg === '-w') {
      config.defaultWorkingDir = args[++i];
    } else if (arg.startsWith('--working-dir=')) {
      config.defaultWorkingDir = arg.slice('--working-dir='.length);
    } else if (arg === '--timeout' || arg === '-t') {
      config.defaultTimeout = parseInt(args[++i], 10);
    } else if (arg.startsWith('--timeout=')) {
      config.defaultTimeout = parseInt(arg.slice('--timeout='.length), 10);
    } else if (arg === '--no-background') {
      config.allowBackground = false;
    } else if (arg === '--max-processes') {
      config.maxBackgroundProcesses = parseInt(args[++i], 10);
    } else if (arg.startsWith('--max-processes=')) {
      config.maxBackgroundProcesses = parseInt(arg.slice('--max-processes='.length), 10);
    } else if (arg === '--blocked') {
      const commands = args[++i];
      config.blockedCommands = commands.split(',').map(s => s.trim());
    } else if (arg.startsWith('--blocked=')) {
      const commands = arg.slice('--blocked='.length);
      config.blockedCommands = commands.split(',').map(s => s.trim());
    } else if (arg === '--allowed') {
      const commands = args[++i];
      config.allowedCommands = commands.split(',').map(s => s.trim());
    } else if (arg.startsWith('--allowed=')) {
      const commands = arg.slice('--allowed='.length);
      config.allowedCommands = commands.split(',').map(s => s.trim());
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  // Also check environment variable for working dir
  if (!config.defaultWorkingDir && process.env.MCP_BASH_WORKING_DIR) {
    config.defaultWorkingDir = process.env.MCP_BASH_WORKING_DIR;
  }

  return config;
}

function printHelp() {
  console.log(`
@ai-stack-mcp/bash - MCP server for bash command execution

Usage: mcp-bash [options]

Options:
  -w, --working-dir=PATH    Default working directory
  -t, --timeout=MS          Default timeout in milliseconds (default: 30000)
  --no-background           Disable background process tools
  --max-processes=N         Maximum concurrent background processes (default: 10)
  --blocked=CMD1,CMD2       Comma-separated list of blocked commands
  --allowed=CMD1,CMD2       Comma-separated whitelist of allowed commands
  -h, --help                Show this help message

Environment Variables:
  MCP_BASH_WORKING_DIR           Default working directory
  MCP_BASH_DEFAULT_TIMEOUT       Default timeout in milliseconds
  MCP_BASH_MAX_BUFFER_SIZE       Maximum output buffer size in bytes
  MCP_BASH_ALLOW_BACKGROUND      Enable/disable background processes (true/false)
  MCP_BASH_MAX_BACKGROUND_PROCESSES  Maximum background processes
  MCP_BASH_BLOCKED_COMMANDS      Comma-separated blocked commands
  MCP_BASH_ALLOWED_COMMANDS      Comma-separated whitelist (enables whitelist mode)

Security:
  The server includes built-in protection against dangerous commands like:
  - rm -rf /
  - Fork bombs
  - Direct device writes

  Use --allowed for whitelist mode to only allow specific commands.
  Use --blocked to add additional commands to the blocklist.

Examples:
  # Basic usage
  mcp-bash

  # With custom working directory
  mcp-bash --working-dir=/home/user/project

  # Whitelist mode (only allow these commands)
  mcp-bash --allowed=ls,cat,grep,find,echo

  # Add to blocklist
  mcp-bash --blocked="curl,wget"

  # Disable background processes
  mcp-bash --no-background
`);
}

// Run the server
const config = parseArgs();
runServer(config).catch((error) => {
  console.error('Failed to start MCP bash server:', error);
  process.exit(1);
});
