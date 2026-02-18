/**
 * @agent-stack/mcp - Transport Factory
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  MCPServerConfig,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
  MCPSseServerConfig,
} from './types';
import { MCPConfigurationError } from './types';
import { getTransportType, isStdioConfig, isHttpConfig } from './config';

/**
 * Transport instance type
 */
export type MCPTransport = StdioClientTransport;

/**
 * Create transport based on configuration
 */
export function createTransport(config: MCPServerConfig): MCPTransport {
  const transportType = getTransportType(config);

  switch (transportType) {
    case 'stdio':
      if (!isStdioConfig(config)) {
        throw new MCPConfigurationError(
          'Invalid stdio configuration: missing command'
        );
      }
      return createStdioTransport(config);

    case 'http':
      if (!isHttpConfig(config)) {
        throw new MCPConfigurationError(
          'Invalid http configuration: missing url'
        );
      }
      // HTTP transport requires additional SDK imports
      // For now, throw error indicating http is not yet supported
      throw new MCPConfigurationError(
        'HTTP transport is not yet implemented. Use stdio transport instead.'
      );

    case 'sse':
      throw new MCPConfigurationError(
        'SSE transport is deprecated. Use HTTP transport instead.'
      );

    default:
      throw new MCPConfigurationError(
        `Unknown transport type: ${transportType}`
      );
  }
}

/**
 * Create stdio transport for local process
 */
export function createStdioTransport(
  config: MCPStdioServerConfig
): StdioClientTransport {
  const command = resolveCommand(config.command);
  const args = config.args ?? [];
  const env = buildEnvironment(config.env);

  return new StdioClientTransport({
    command,
    args,
    env,
  });
}

/**
 * Resolve command path
 * Handles special commands like npx, bunx, etc.
 */
export function resolveCommand(command: string): string {
  // Handle common package runners
  const lowerCommand = command.toLowerCase();

  // On Windows, we might need to add .cmd extension
  if (process.platform === 'win32') {
    if (
      lowerCommand === 'npx' ||
      lowerCommand === 'npm' ||
      lowerCommand === 'yarn' ||
      lowerCommand === 'pnpm'
    ) {
      return `${command}.cmd`;
    }
  }

  return command;
}

/**
 * Build environment for subprocess
 * Merges with process.env
 */
export function buildEnvironment(
  env?: Record<string, string>
): Record<string, string> {
  return {
    ...process.env,
    ...env,
  } as Record<string, string>;
}

/**
 * Create MCP client with transport
 */
export async function createClient(
  name: string,
  config: MCPServerConfig
): Promise<{ client: Client; transport: MCPTransport }> {
  const transport = createTransport(config);

  const client = new Client(
    {
      name: `agent-stack-mcp-${name}`,
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  return { client, transport };
}
