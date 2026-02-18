/**
 * @ai-stack/assistant - Configuration Loading
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';
import type { AssistantConfig } from './types.js';

/**
 * Default base directory for assistant data
 */
export const DEFAULT_BASE_DIR = join(homedir(), '.ai-assistant');

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = ['assistant.json', '.assistant.json'];

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

  // Check default base dir
  for (const fileName of CONFIG_FILE_NAMES) {
    const configPath = join(DEFAULT_BASE_DIR, fileName);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

/**
 * Load configuration from a file
 */
export function loadConfigFile(configPath: string): AssistantConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as AssistantConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in configuration file: ${configPath}`);
    }
    throw error;
  }
}

/**
 * Result of loading configuration
 */
export interface LoadConfigResult {
  config: AssistantConfig;
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
export function getDefaultConfig(): AssistantConfig {
  return {
    name: 'Assistant',
    baseDir: DEFAULT_BASE_DIR,
    agent: {
      model: 'gpt-4o',
      temperature: 0.7,
    },
    memory: {
      enabled: true,
      syncOnStartup: true,
      watchFiles: true,
    },
    gateway: {
      sessionStrategy: 'per-peer',
      channels: {
        cli: { enabled: true },
      },
    },
    scheduler: {
      enabled: true,
      allowAgentControl: true,
    },
  };
}

/**
 * Resolve paths relative to base directory
 */
export function resolveConfig(config: AssistantConfig): AssistantConfig {
  const baseDir = config.baseDir || DEFAULT_BASE_DIR;

  // Ensure base directory exists
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  return {
    ...config,
    baseDir,
    memory: config.memory
      ? {
          ...config.memory,
          memoryFile: config.memory.memoryFile || join(baseDir, 'MEMORY.md'),
          logsDir: config.memory.logsDir || join(baseDir, 'memory'),
          dbPath: config.memory.dbPath || join(baseDir, 'index.db'),
        }
      : undefined,
    scheduler: config.scheduler
      ? {
          ...config.scheduler,
          persistencePath: config.scheduler.persistencePath || join(baseDir, 'scheduler.json'),
        }
      : undefined,
  };
}

/**
 * Generate a default configuration template
 */
export function generateConfigTemplate(): AssistantConfig {
  return {
    name: 'My Assistant',
    agent: {
      model: 'gpt-4o',
      temperature: 0.7,
      systemPrompt: 'You are a helpful personal assistant. Be concise and helpful.',
    },
    memory: {
      enabled: true,
      syncOnStartup: true,
      watchFiles: true,
    },
    gateway: {
      sessionStrategy: 'per-peer',
      channels: {
        cli: { enabled: true },
        telegram: {
          enabled: false,
          token: '${TELEGRAM_BOT_TOKEN}',
        },
      },
    },
    scheduler: {
      enabled: true,
      allowAgentControl: true,
    },
  };
}

/**
 * Serialize configuration to JSON string
 */
export function serializeConfig(config: AssistantConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Initialize configuration directory and files
 */
export function initConfig(baseDir: string = DEFAULT_BASE_DIR, force: boolean = false): string {
  // Create base directory
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const configPath = join(baseDir, 'assistant.json');

  if (existsSync(configPath) && !force) {
    throw new Error(`Configuration file already exists: ${configPath}`);
  }

  // Write config file
  const config = generateConfigTemplate();
  writeFileSync(configPath, serializeConfig(config), 'utf-8');

  // Create memory directory
  const memoryDir = join(baseDir, 'memory');
  if (!existsSync(memoryDir)) {
    mkdirSync(memoryDir, { recursive: true });
  }

  // Create default MEMORY.md
  const memoryFile = join(baseDir, 'MEMORY.md');
  if (!existsSync(memoryFile) || force) {
    writeFileSync(
      memoryFile,
      generateMemoryTemplate(),
      'utf-8'
    );
  }

  return configPath;
}

/**
 * Generate default MEMORY.md template
 */
export function generateMemoryTemplate(): string {
  return `# Assistant Memory

## Profile

- **Name**: (Your name)
- **Timezone**: UTC
- **Language**: English

## Facts

- (Add facts about yourself here)

## Todos

- [ ] Set up your assistant

## Notes

(Add any notes or context here)
`;
}
