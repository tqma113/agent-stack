/**
 * @ai-stack/code - Configuration Loading
 */

import { existsSync, readFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import type { CodeConfig } from './types.js';
import { validateConfig } from './config-schema.js';
import { ConfigError } from './errors.js';

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = ['code.json', '.code.json', 'ai-code.json'];

/**
 * Default base directory for code agent data
 */
export const DEFAULT_BASE_DIR = '.ai-code';

/**
 * Find configuration file starting from a directory
 */
export function findConfigFile(startDir: string = process.cwd()): string | undefined {
  let currentDir = resolve(startDir);
  const root = dirname(currentDir);

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, fileName);
      if (existsSync(configPath)) {
        return configPath;
      }
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Load configuration from a file
 */
export function loadConfigFile(configPath: string): CodeConfig {
  if (!existsSync(configPath)) {
    throw new ConfigError(`Configuration file not found: ${configPath}`);
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return validateConfig(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in configuration file: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
  config: CodeConfig;
  configPath?: string;
}

/**
 * Load configuration, searching for config file if not specified
 */
export function loadConfig(configPath?: string): LoadConfigResult {
  if (configPath) {
    const absolutePath = resolve(configPath);
    const config = loadConfigFile(absolutePath);
    return { config, configPath: absolutePath };
  }

  const foundPath = findConfigFile();
  if (foundPath) {
    const config = loadConfigFile(foundPath);
    return { config, configPath: foundPath };
  }

  // Return default config if no file found
  return { config: getDefaultConfig() };
}

/**
 * Get default configuration
 */
export function getDefaultConfig(): CodeConfig {
  return {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8192,
    maxIterations: 50,

    safety: {
      workingDir: process.cwd(),
      allowedPaths: ['**/*'],
      blockedPaths: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      maxFileSize: 1048576, // 1MB
      blockSecrets: true,
      confirmDestructive: true,
    },

    history: {
      enabled: true,
      dbPath: join(DEFAULT_BASE_DIR, 'history.db'),
      maxChanges: 1000,
    },

    tasks: {
      enabled: true,
      dbPath: join(DEFAULT_BASE_DIR, 'tasks.db'),
    },
  };
}

/**
 * Resolve and merge configuration with defaults
 */
export function resolveConfig(config: CodeConfig, workingDir?: string): Required<CodeConfig> {
  const defaults = getDefaultConfig();
  const baseDir = workingDir || config.safety?.workingDir || process.cwd();

  // Ensure base directory exists for data storage
  const dataDir = join(baseDir, DEFAULT_BASE_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return {
    model: config.model || defaults.model!,
    temperature: config.temperature ?? defaults.temperature!,
    maxTokens: config.maxTokens || defaults.maxTokens!,
    maxIterations: config.maxIterations || defaults.maxIterations!,
    apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
    baseURL: config.baseURL || '',

    safety: {
      workingDir: baseDir,
      allowedPaths: config.safety?.allowedPaths || defaults.safety!.allowedPaths!,
      blockedPaths: config.safety?.blockedPaths || defaults.safety!.blockedPaths!,
      maxFileSize: config.safety?.maxFileSize || defaults.safety!.maxFileSize!,
      blockSecrets: config.safety?.blockSecrets ?? defaults.safety!.blockSecrets!,
      confirmDestructive: config.safety?.confirmDestructive ?? defaults.safety!.confirmDestructive!,
    },

    history: {
      enabled: config.history?.enabled ?? defaults.history!.enabled!,
      dbPath: config.history?.dbPath || join(dataDir, 'history.db'),
      maxChanges: config.history?.maxChanges || defaults.history!.maxChanges!,
    },

    tasks: {
      enabled: config.tasks?.enabled ?? defaults.tasks!.enabled!,
      dbPath: config.tasks?.dbPath || join(dataDir, 'tasks.db'),
    },

    mcp: {
      configPath: config.mcp?.configPath,
      autoConnect: config.mcp?.autoConnect ?? false,
    },
  };
}

/**
 * Generate a default configuration template
 */
export function generateConfigTemplate(): CodeConfig {
  return {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8192,
    maxIterations: 50,

    safety: {
      workingDir: '.',
      allowedPaths: ['**/*'],
      blockedPaths: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      maxFileSize: 1048576,
      blockSecrets: true,
      confirmDestructive: true,
    },

    history: {
      enabled: true,
      dbPath: '.ai-code/history.db',
      maxChanges: 1000,
    },

    tasks: {
      enabled: true,
      dbPath: '.ai-code/tasks.db',
    },

    mcp: {
      configPath: 'mcp.json',
      autoConnect: true,
    },
  };
}

/**
 * Serialize configuration to JSON string
 */
export function serializeConfig(config: CodeConfig): string {
  return JSON.stringify(config, null, 2);
}
