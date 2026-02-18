#!/usr/bin/env node
/**
 * CLI entry point for @ai-stack-mcp/fetch
 */

import { runServer } from './server.js';
import type { ServerConfig } from './types.js';

// Parse environment variables for configuration
const config: ServerConfig = {
  name: process.env.MCP_FETCH_NAME || 'ai-stack-mcp-fetch',
  version: process.env.MCP_FETCH_VERSION || '0.0.1',
  defaultUserAgent: process.env.MCP_FETCH_USER_AGENT,
  defaultTimeout: process.env.MCP_FETCH_TIMEOUT
    ? parseInt(process.env.MCP_FETCH_TIMEOUT, 10)
    : undefined,
  defaultMaxLength: process.env.MCP_FETCH_MAX_LENGTH
    ? parseInt(process.env.MCP_FETCH_MAX_LENGTH, 10)
    : undefined,
  allowedDomains: process.env.MCP_FETCH_ALLOWED_DOMAINS
    ? process.env.MCP_FETCH_ALLOWED_DOMAINS.split(',').map((d) => d.trim())
    : undefined,
  blockedDomains: process.env.MCP_FETCH_BLOCKED_DOMAINS
    ? process.env.MCP_FETCH_BLOCKED_DOMAINS.split(',').map((d) => d.trim())
    : undefined,
};

// Run the server
runServer(config).catch((error) => {
  console.error('Failed to start MCP fetch server:', error);
  process.exit(1);
});
