#!/usr/bin/env node
/**
 * CLI entry point for @agent-stack-mcp/git
 */

import { runServer } from './server.js';
import type { ServerConfig } from './types.js';

// Parse command line arguments
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    name: process.env.MCP_GIT_NAME || 'agent-stack-mcp-git',
    version: process.env.MCP_GIT_VERSION || '0.0.1',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--repository' || arg === '-r') {
      config.defaultRepository = args[++i];
    } else if (arg.startsWith('--repository=')) {
      config.defaultRepository = arg.slice('--repository='.length);
    }
  }

  // Also check environment variable
  if (!config.defaultRepository && process.env.MCP_GIT_REPOSITORY) {
    config.defaultRepository = process.env.MCP_GIT_REPOSITORY;
  }

  return config;
}

// Run the server
const config = parseArgs();
runServer(config).catch((error) => {
  console.error('Failed to start MCP git server:', error);
  process.exit(1);
});
