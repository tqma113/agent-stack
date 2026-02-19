#!/usr/bin/env node
/**
 * @ai-stack/code - CLI Entry Point
 */

import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { createCodeAgent, type CodeAgentInstance } from './code-agent/index.js';
import { loadConfig, generateConfigTemplate, serializeConfig, DEFAULT_BASE_DIR } from './config.js';
import { createFileHistoryStore } from './file-history/store.js';

const VERSION = '0.0.1';

/**
 * Load .env file and set environment variables
 */
function loadEnvFile(startDir: string = process.cwd()): void {
  const envFiles = ['.env', '.env.local'];

  for (const envFile of envFiles) {
    const envPath = join(startDir, envFile);
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();

            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }

            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      } catch {
        // Ignore errors
      }
      break;
    }
  }
}

// Load .env on startup
loadEnvFile();

const program = new Command();

program
  .name('ai-code')
  .description('AI Code Agent for file operations, search, and code editing')
  .version(VERSION);

// ============================================
// Default command (interactive chat)
// ============================================
program
  .argument('[prompt]', 'Initial prompt to send to the agent')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory (default: current directory)')
  .action(async (prompt, options) => {
    await runInteractive(prompt, options);
  });

// ============================================
// undo command
// ============================================
program
  .command('undo')
  .description('Undo the last file change')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory')
  .action(async (options) => {
    await runUndo(options);
  });

// ============================================
// redo command
// ============================================
program
  .command('redo')
  .description('Redo the last undone change')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory')
  .action(async (options) => {
    await runRedo(options);
  });

// ============================================
// history command
// ============================================
program
  .command('history')
  .description('Show file change history')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory')
  .option('-n, --limit <n>', 'Number of entries to show', '20')
  .action(async (options) => {
    await showHistory(options);
  });

// ============================================
// checkpoint command
// ============================================
const checkpointCmd = program.command('checkpoint').description('Manage checkpoints');

checkpointCmd
  .command('create <name>')
  .description('Create a named checkpoint')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory')
  .action(async (name, options) => {
    await createCheckpoint(name, options);
  });

checkpointCmd
  .command('restore <name>')
  .description('Restore to a named checkpoint')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-w, --working-dir <path>', 'Working directory')
  .action(async (name, options) => {
    await restoreCheckpoint(name, options);
  });

// ============================================
// config command
// ============================================
const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('init')
  .description('Initialize configuration file')
  .option('-d, --dir <path>', 'Directory to create config in', '.')
  .option('-f, --force', 'Overwrite existing config')
  .action(async (options) => {
    await initConfig(options);
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await showConfig(options);
  });

// ============================================
// Implementation
// ============================================

interface InteractiveOptions {
  config?: string;
  workingDir?: string;
}

async function runInteractive(prompt: string | undefined, options: InteractiveOptions) {
  console.log(`\n🔧 Code Agent v${VERSION}\n`);

  let agent: CodeAgentInstance | null = null;

  try {
    const workingDir = options.workingDir ? resolve(options.workingDir) : process.cwd();

    console.log('Initializing...');
    agent = createCodeAgent({
      ...loadConfig(options.config).config,
      safety: {
        workingDir,
      },
    });
    await agent.initialize();

    // If prompt provided, execute and exit
    if (prompt) {
      console.log(`\n> ${prompt}\n`);
      const response = await agent.stream(prompt, (token: string) => {
        process.stdout.write(token);
      });
      console.log('\n');
      await agent.close();
      return;
    }

    // Start interactive mode
    agent.startCLI();
  } catch (error) {
    console.error(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
    if (agent) await agent.close();
    process.exit(1);
  }
}

interface UndoRedoOptions {
  config?: string;
  workingDir?: string;
}

async function runUndo(options: UndoRedoOptions) {
  const agent = await createAndInitAgent(options);

  try {
    const result = await agent.undo();
    if (result) {
      console.log(`Undone: ${result.file_path}`);
      console.log(`  Action: ${result.restored_to}`);
    } else {
      console.log('Nothing to undo');
    }
  } finally {
    await agent.close();
  }
}

async function runRedo(options: UndoRedoOptions) {
  const agent = await createAndInitAgent(options);

  try {
    const result = await agent.redo();
    if (result) {
      console.log(`Redone: ${result.file_path}`);
      console.log(`  Action: ${result.action}`);
    } else {
      console.log('Nothing to redo');
    }
  } finally {
    await agent.close();
  }
}

interface HistoryOptions extends UndoRedoOptions {
  limit?: string;
}

async function showHistory(options: HistoryOptions) {
  const workingDir = options.workingDir ? resolve(options.workingDir) : process.cwd();
  const { config } = loadConfig(options.config);

  const dbPath = config.history?.dbPath || join(workingDir, DEFAULT_BASE_DIR, 'history.db');

  if (!existsSync(dbPath)) {
    console.log('No history found');
    return;
  }

  const store = createFileHistoryStore({
    dbPath,
    maxChanges: 1000,
  });
  store.initialize();

  try {
    const limit = parseInt(options.limit || '20', 10);
    const changes = store.getRecentChanges(limit);

    if (changes.length === 0) {
      console.log('No changes recorded');
      return;
    }

    console.log(`Recent changes (${changes.length}):\n`);
    for (const change of changes) {
      const status = change.undone ? '↩' : '✓';
      const time = new Date(change.timestamp).toLocaleString();
      console.log(`${status} [${change.changeType}] ${change.filePath}`);
      console.log(`    ${time}`);
    }
  } finally {
    store.close();
  }
}

async function createCheckpoint(name: string, options: UndoRedoOptions) {
  const agent = await createAndInitAgent(options);

  try {
    await agent.createCheckpoint(name);
    console.log(`Checkpoint created: ${name}`);
  } finally {
    await agent.close();
  }
}

async function restoreCheckpoint(name: string, options: UndoRedoOptions) {
  const agent = await createAndInitAgent(options);

  try {
    await agent.restoreCheckpoint(name);
    console.log(`Restored to checkpoint: ${name}`);
  } finally {
    await agent.close();
  }
}

interface InitConfigOptions {
  dir?: string;
  force?: boolean;
}

async function initConfig(options: InitConfigOptions) {
  const dir = options.dir || '.';
  const configPath = join(dir, 'code.json');

  if (existsSync(configPath) && !options.force) {
    console.error(`Configuration file already exists: ${configPath}`);
    console.error('Use --force to overwrite');
    process.exit(1);
  }

  const config = generateConfigTemplate();
  writeFileSync(configPath, serializeConfig(config), 'utf-8');

  // Create data directory
  const dataDir = join(dir, DEFAULT_BASE_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  console.log(`Configuration created: ${configPath}`);
}

interface ShowConfigOptions {
  config?: string;
}

async function showConfig(options: ShowConfigOptions) {
  const { config, configPath } = loadConfig(options.config);

  if (!configPath) {
    console.log('No configuration file found');
    console.log('Run `ai-code config init` to create one');
    return;
  }

  console.log(`Configuration file: ${configPath}\n`);
  console.log(serializeConfig(config));
}

async function createAndInitAgent(options: UndoRedoOptions): Promise<CodeAgentInstance> {
  const workingDir = options.workingDir ? resolve(options.workingDir) : process.cwd();
  const { config } = loadConfig(options.config);

  const agent = createCodeAgent({
    ...config,
    safety: {
      ...config.safety,
      workingDir,
    },
  });
  await agent.initialize();
  return agent;
}

// Parse and run
program.parse();
