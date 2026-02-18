/**
 * @ai-stack/mcp - Configuration Loading
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import JSON5 from 'json5';
import type {
  MCPConfig,
  MCPServerConfig,
  MCPStdioServerConfig,
  MCPHttpServerConfig,
} from './types';
import { MCPConfigurationError } from './types';

/**
 * Default configuration file names to search for
 */
export const CONFIG_FILE_NAMES = ['mcp.json'];

/**
 * Load MCP configuration from a file path
 */
export async function loadConfig(configPath: string): Promise<MCPConfig> {
  const absolutePath = resolve(configPath);

  if (!existsSync(absolutePath)) {
    throw new MCPConfigurationError(
      `Configuration file not found: ${absolutePath}`
    );
  }

  const content = await readFile(absolutePath, 'utf-8');
  return parseConfig(content);
}

/**
 * Load MCP configuration from default locations
 * Searches current directory and parent directories
 */
export async function loadConfigFromDefaults(
  startDir?: string
): Promise<MCPConfig | null> {
  const configPath = findConfigFile(startDir);

  if (!configPath) {
    return null;
  }

  return loadConfig(configPath);
}

/**
 * Find configuration file in directory hierarchy
 */
export function findConfigFile(startDir?: string): string | null {
  let currentDir = startDir ?? process.cwd();
  const root = resolve('/');

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = resolve(currentDir, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

/**
 * Parse and validate configuration
 */
export function parseConfig(content: string): MCPConfig {
  let parsed: unknown;

  try {
    parsed = JSON5.parse(content);
  } catch (error) {
    throw new MCPConfigurationError(
      `Invalid JSON/JSON5 in configuration file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new MCPConfigurationError('Configuration must be an object');
  }

  const config = parsed as Record<string, unknown>;

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    throw new MCPConfigurationError(
      'Configuration must have "mcpServers" object'
    );
  }

  const mcpServers = config.mcpServers as Record<string, unknown>;

  // Validate each server configuration
  for (const [name, serverConfig] of Object.entries(mcpServers)) {
    validateServerConfig(name, serverConfig as MCPServerConfig);
  }

  // Resolve environment variables
  return resolveEnvVars({
    mcpServers: mcpServers as Record<string, MCPServerConfig>,
  });
}

/**
 * Validate a server configuration
 */
export function validateServerConfig(
  name: string,
  config: MCPServerConfig
): void {
  if (!config || typeof config !== 'object') {
    throw new MCPConfigurationError(
      `Server "${name}" configuration must be an object`
    );
  }

  const serverType = getTransportType(config);

  if (serverType === 'stdio') {
    const stdioConfig = config as MCPStdioServerConfig;
    if (!stdioConfig.command || typeof stdioConfig.command !== 'string') {
      throw new MCPConfigurationError(
        `Server "${name}" must have a "command" string for stdio transport`
      );
    }
  } else if (serverType === 'http' || serverType === 'sse') {
    const httpConfig = config as MCPHttpServerConfig;
    if (!httpConfig.url || typeof httpConfig.url !== 'string') {
      throw new MCPConfigurationError(
        `Server "${name}" must have a "url" string for ${serverType} transport`
      );
    }
  }
}

/**
 * Resolve environment variables in configuration
 * Supports ${VAR} and $VAR syntax
 */
export function resolveEnvVars(config: MCPConfig): MCPConfig {
  const resolved: MCPConfig = {
    mcpServers: {},
  };

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    resolved.mcpServers[name] = resolveServerEnvVars(serverConfig);
  }

  return resolved;
}

/**
 * Resolve environment variables in a single server configuration
 */
function resolveServerEnvVars(config: MCPServerConfig): MCPServerConfig {
  const resolved = { ...config };

  // Resolve env values
  if ('env' in resolved && resolved.env) {
    const resolvedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolved.env)) {
      resolvedEnv[key] = resolveEnvString(value);
    }
    resolved.env = resolvedEnv;
  }

  // Resolve args values
  if ('args' in resolved && resolved.args) {
    resolved.args = resolved.args.map(resolveEnvString);
  }

  // Resolve URL if present
  if ('url' in resolved && resolved.url) {
    resolved.url = resolveEnvString(resolved.url);
  }

  // Resolve headers if present
  if ('headers' in resolved && resolved.headers) {
    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(resolved.headers)) {
      resolvedHeaders[key] = resolveEnvString(value);
    }
    resolved.headers = resolvedHeaders;
  }

  return resolved;
}

/**
 * Resolve environment variables in a string
 */
function resolveEnvString(value: string): string {
  // Match ${VAR} or $VAR patterns
  return value.replace(/\$\{([^}]+)\}|\$([A-Z_][A-Z0-9_]*)/gi, (_, p1, p2) => {
    const varName = p1 || p2;
    return process.env[varName] ?? '';
  });
}

/**
 * Determine transport type from configuration
 */
export function getTransportType(
  config: MCPServerConfig
): 'stdio' | 'http' | 'sse' {
  if (config.type) {
    return config.type;
  }

  // If no type specified, check for stdio indicators
  if ('command' in config && config.command) {
    return 'stdio';
  }

  // If has URL but no type, default to http
  if ('url' in config && config.url) {
    return 'http';
  }

  // Default to stdio
  return 'stdio';
}

/**
 * Check if configuration is stdio type
 */
export function isStdioConfig(
  config: MCPServerConfig
): config is MCPStdioServerConfig {
  return getTransportType(config) === 'stdio';
}

/**
 * Check if configuration is http type
 */
export function isHttpConfig(
  config: MCPServerConfig
): config is MCPHttpServerConfig {
  return getTransportType(config) === 'http';
}
