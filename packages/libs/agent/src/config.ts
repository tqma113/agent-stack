/**
 * Configuration file loading and management
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import type { AgentConfig, AgentMCPConfig, AgentSkillConfig, AgentMemoryConfig } from './types';
import { validateConfig, formatValidationErrors } from './config-schema.js';

// Re-export validation utilities
export { validateConfig, formatValidationErrors } from './config-schema.js';
export type { ValidationError, ValidationResult } from './config-schema.js';
import { ConfigValidationError } from './errors.js';

/**
 * Configuration file names to search for (in order of priority)
 */
const CONFIG_FILE_NAMES = [
  'agent.json',
];

/**
 * Agent Stack configuration file format
 */
/**
 * Memory configuration section
 */
export interface MemoryConfigSection {
  /** Whether to enable memory */
  enabled?: boolean;
  /** Database file path (default: 'memory/sqlite.db') */
  dbPath?: string;
  /** Whether to auto-initialize on first chat (default: true) */
  autoInitialize?: boolean;
  /** Whether to auto-inject memory context into prompts (default: true) */
  autoInject?: boolean;
  /** Token budget configuration */
  tokenBudget?: {
    profile?: number;
    taskState?: number;
    recentEvents?: number;
    semanticChunks?: number;
    summary?: number;
    total?: number;
  };
  /** Write policy configuration */
  writePolicy?: {
    autoSummarize?: boolean;
    summarizeEveryNEvents?: number;
    conflictStrategy?: 'latest' | 'confidence' | 'explicit' | 'manual';
  };
  /** Retrieval configuration */
  retrieval?: {
    maxRecentEvents?: number;
    maxSemanticChunks?: number;
    enableSemanticSearch?: boolean;
  };
  /** Enable debug logging */
  debug?: boolean;
}

export interface AgentStackConfig {
  /** LLM model to use */
  model?: string;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Maximum tool call iterations per conversation turn (default: 10) */
  maxIterations?: number;
  /** System prompt for the agent */
  systemPrompt?: string;
  /** OpenAI API key (prefer env var OPENAI_API_KEY) */
  apiKey?: string;
  /** Custom API base URL */
  baseURL?: string;
  /** Skill configuration */
  skill?: SkillConfigSection;
  /** MCP configuration */
  mcp?: MCPConfigSection;
  /** Memory configuration */
  memory?: MemoryConfigSection;
  /** Security settings */
  security?: SecurityConfigSection;
}

/**
 * Skill configuration section
 */
export interface SkillConfigSection {
  /** Directories to auto-discover skills from */
  directories?: string[];
  /** Individual skill configurations */
  skills?: Record<string, {
    path?: string;
    package?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }>;
  /** Whether to auto-load skills */
  autoLoad?: boolean;
}

/**
 * MCP configuration section
 */
export interface MCPConfigSection {
  /** Path to MCP config file (e.g., 'mcp.json') */
  configPath?: string;
  /** Whether to auto-connect MCP servers */
  autoConnect?: boolean;
}

/**
 * Security configuration section
 */
export interface SecurityConfigSection {
  /** Confirm before executing dangerous commands */
  confirmDangerousCommands?: boolean;
}

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
  /** Loaded configuration */
  config: AgentStackConfig;
  /** Path to the configuration file (if found) */
  configPath?: string;
  /** Max iterations for tool calls */
  maxIterations?: number;
}

/**
 * Find configuration file in directory and parent directories
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

  // Check root directory
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = join(currentDir, fileName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

/**
 * Options for loading configuration
 */
export interface LoadConfigFileOptions {
  /** Skip schema validation (default: false) */
  skipValidation?: boolean;
}

/**
 * Load configuration from a file
 *
 * @param configPath - Path to the configuration file
 * @param options - Loading options
 * @returns Validated configuration object
 * @throws ConfigValidationError if validation fails
 */
export function loadConfigFile(
  configPath: string,
  options: LoadConfigFileOptions = {}
): AgentStackConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  let rawConfig: unknown;
  try {
    const content = readFileSync(configPath, 'utf-8');
    rawConfig = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${configPath}`);
    }
    throw error;
  }

  // Validate configuration if not skipped
  if (!options.skipValidation) {
    const validationResult = validateConfig(rawConfig);
    if (!validationResult.success && validationResult.errors) {
      throw new ConfigValidationError(validationResult.errors);
    }
  }

  return rawConfig as AgentStackConfig;
}

/**
 * Load configuration, searching for config file if not specified
 */
export function loadConfig(configPath?: string): LoadConfigResult {
  if (configPath) {
    const absolutePath = resolve(configPath);
    const config = loadConfigFile(absolutePath);
    return {
      config,
      configPath: absolutePath,
      maxIterations: config.maxIterations,
    };
  }

  const foundPath = findConfigFile();
  if (foundPath) {
    const config = loadConfigFile(foundPath);
    return {
      config,
      configPath: foundPath,
      maxIterations: config.maxIterations,
    };
  }

  // Return empty config if no file found
  return { config: {} };
}

/**
 * Convert AgentStackConfig to AgentConfig for Agent constructor
 */
export function toAgentConfig(stackConfig: AgentStackConfig, baseDir?: string): AgentConfig {
  const agentConfig: AgentConfig = {
    model: stackConfig.model,
    temperature: stackConfig.temperature,
    maxTokens: stackConfig.maxTokens,
    systemPrompt: stackConfig.systemPrompt,
    apiKey: stackConfig.apiKey,
    baseURL: stackConfig.baseURL,
  };

  // Convert skill config
  if (stackConfig.skill) {
    const skillConfig: AgentSkillConfig = {
      autoLoad: stackConfig.skill.autoLoad,
    };

    // Resolve directories relative to config file
    if (stackConfig.skill.directories && baseDir) {
      skillConfig.directories = stackConfig.skill.directories.map(dir =>
        resolve(baseDir, dir)
      );
    } else if (stackConfig.skill.directories) {
      skillConfig.directories = stackConfig.skill.directories;
    }

    // Convert skills entries
    if (stackConfig.skill.skills) {
      skillConfig.skills = {};
      for (const [name, entry] of Object.entries(stackConfig.skill.skills)) {
        if (entry.enabled === false) continue;
        skillConfig.skills[name] = {
          path: entry.path ? (baseDir ? resolve(baseDir, entry.path) : entry.path) : undefined,
          package: entry.package,
          enabled: entry.enabled,
          config: entry.config,
        };
      }
    }

    agentConfig.skill = skillConfig;
  }

  // Convert MCP config
  if (stackConfig.mcp) {
    const mcpConfig: AgentMCPConfig = {
      autoConnect: stackConfig.mcp.autoConnect,
    };

    if (stackConfig.mcp.configPath) {
      mcpConfig.configPath = baseDir
        ? resolve(baseDir, stackConfig.mcp.configPath)
        : stackConfig.mcp.configPath;
    }

    agentConfig.mcp = mcpConfig;
  }

  // Convert Memory config
  if (stackConfig.memory) {
    const memoryConfig: AgentMemoryConfig = {
      enabled: stackConfig.memory.enabled,
      autoInitialize: stackConfig.memory.autoInitialize,
      autoInject: stackConfig.memory.autoInject,
      debug: stackConfig.memory.debug,
    };

    // Resolve dbPath relative to config file
    if (stackConfig.memory.dbPath) {
      memoryConfig.dbPath = baseDir
        ? resolve(baseDir, stackConfig.memory.dbPath)
        : stackConfig.memory.dbPath;
    }

    // Copy token budget if provided
    if (stackConfig.memory.tokenBudget) {
      memoryConfig.tokenBudget = stackConfig.memory.tokenBudget;
    }

    // Copy write policy if provided
    if (stackConfig.memory.writePolicy) {
      memoryConfig.writePolicy = stackConfig.memory.writePolicy;
    }

    // Copy retrieval config if provided
    if (stackConfig.memory.retrieval) {
      memoryConfig.retrieval = {
        maxRecentEvents: stackConfig.memory.retrieval.maxRecentEvents,
        maxSemanticChunks: stackConfig.memory.retrieval.maxSemanticChunks,
      };
      memoryConfig.enableSemanticSearch = stackConfig.memory.retrieval.enableSemanticSearch;
    }

    agentConfig.memory = memoryConfig;
  }

  return agentConfig;
}

/**
 * Generate a default configuration template
 */
export function generateConfigTemplate(): AgentStackConfig {
  return {
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant with access to various tools. Use them wisely to help the user accomplish their tasks.',
    skill: {
      directories: ['./skills'],
      autoLoad: true,
    },
    mcp: {
      configPath: 'mcp.json',
      autoConnect: true,
    },
    memory: {
      enabled: true,
      dbPath: '.ai-stack/memory/sqlite.db',
      autoInitialize: true,
      autoInject: true,
    },
    security: {
      confirmDangerousCommands: true,
    },
  };
}

/**
 * Serialize configuration to JSON string
 */
export function serializeConfig(config: AgentStackConfig): string {
  return JSON.stringify(config, null, 2);
}
