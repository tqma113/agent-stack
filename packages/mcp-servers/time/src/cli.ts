#!/usr/bin/env node
/**
 * CLI entry point for @agent-stack-mcp/time
 */

import { runServer } from './server.js';
import type { ServerConfig } from './types.js';

// Parse command line arguments
function parseArgs(): ServerConfig {
  const args = process.argv.slice(2);
  const config: ServerConfig = {
    name: process.env.MCP_TIME_NAME || 'agent-stack-mcp-time',
    version: process.env.MCP_TIME_VERSION || '0.0.1',
  };

  for (const arg of args) {
    if (arg.startsWith('--local-timezone=')) {
      config.localTimezone = arg.slice('--local-timezone='.length);
    }
  }

  // Also check environment variable
  if (!config.localTimezone && process.env.MCP_TIME_LOCAL_TIMEZONE) {
    config.localTimezone = process.env.MCP_TIME_LOCAL_TIMEZONE;
  }

  return config;
}

// Run the server
const config = parseArgs();
runServer(config).catch((error) => {
  console.error('Failed to start MCP time server:', error);
  process.exit(1);
});
