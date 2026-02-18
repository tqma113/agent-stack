#!/usr/bin/env node
/**
 * @ai-stack/assistant - CLI Entry Point
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createAssistant, type AssistantInstance } from './assistant/index.js';
import {
  loadConfig,
  initConfig,
  serializeConfig,
  DEFAULT_BASE_DIR,
} from './config.js';

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
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith('#')) continue;

          const eqIndex = trimmed.indexOf('=');
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();

            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }

            // Only set if not already defined
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      } catch {
        // Ignore errors reading .env file
      }
      break; // Use first found .env file
    }
  }
}

// Load .env file on startup
loadEnvFile();

const program = new Command();

program
  .name('assistant')
  .description('Personal AI Assistant with Markdown memory and multi-channel support')
  .version(VERSION);

// ============================================
// chat command
// ============================================
program
  .command('chat')
  .description('Start interactive chat session')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await runChat(options);
  });

// ============================================
// daemon command
// ============================================
const daemonCmd = program
  .command('daemon')
  .description('Manage the assistant daemon');

daemonCmd
  .command('start')
  .description('Start the daemon')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await startDaemon(options);
  });

daemonCmd
  .command('stop')
  .description('Stop the daemon')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await stopDaemon(options);
  });

daemonCmd
  .command('status')
  .description('Show daemon status')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await showDaemonStatus(options);
  });

daemonCmd
  .command('logs')
  .description('Show daemon logs')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-n, --lines <n>', 'Number of lines to show', '50')
  .action(async (options) => {
    await showDaemonLogs(options);
  });

// ============================================
// memory command
// ============================================
const memoryCmd = program
  .command('memory')
  .description('Manage assistant memory');

memoryCmd
  .command('sync')
  .description('Sync Markdown files to index')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await syncMemory(options);
  });

memoryCmd
  .command('search <query>')
  .description('Search memory')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-n, --limit <n>', 'Maximum results', '10')
  .action(async (query, options) => {
    await searchMemory(query, options);
  });

memoryCmd
  .command('show')
  .description('Show memory document')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await showMemory(options);
  });

// ============================================
// scheduler command
// ============================================
const schedulerCmd = program
  .command('scheduler')
  .description('Manage scheduled tasks');

schedulerCmd
  .command('list')
  .description('List scheduled tasks')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await listScheduledTasks(options);
  });

schedulerCmd
  .command('cancel <id>')
  .description('Cancel a scheduled task')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (id, options) => {
    await cancelTask(id, options);
  });

// ============================================
// config command
// ============================================
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('init')
  .description('Initialize configuration')
  .option('-d, --dir <path>', 'Base directory', DEFAULT_BASE_DIR)
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    await initConfiguration(options);
  });

configCmd
  .command('show')
  .description('Show current configuration')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await showConfiguration(options);
  });

// ============================================
// Implementation
// ============================================

interface ChatOptions {
  config?: string;
}

async function runChat(options: ChatOptions) {
  console.log(`\n🤖 Assistant v${VERSION}\n`);

  let assistant: AssistantInstance | null = null;

  try {
    console.log('Initializing...');
    assistant = createAssistant(options.config);
    // Skip gateway in CLI mode to avoid readline conflicts
    await assistant.initialize({ skipGateway: true });

    console.log(`Ready! Type "exit" to quit.\n`);

    // Interactive loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question('You: ', async (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log('\nGoodbye!');
          await cleanup(assistant);
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/memory') {
          const memory = assistant?.getMemory();
          if (memory) {
            const doc = memory.getDocument();
            console.log('\n--- Memory ---');
            console.log(JSON.stringify(doc, null, 2));
            console.log('--- End Memory ---\n');
          } else {
            console.log('\nMemory not enabled.\n');
          }
          prompt();
          return;
        }

        if (trimmed === '/tasks') {
          const scheduler = assistant?.getScheduler();
          if (scheduler) {
            const jobs = scheduler.getAllJobs();
            console.log('\n--- Scheduled Tasks ---');
            if (jobs.length === 0) {
              console.log('No scheduled tasks.');
            } else {
              for (const job of jobs) {
                const status = job.enabled ? '✓' : '✗';
                const next = job.nextRunAt ? job.nextRunAt.toLocaleString() : 'N/A';
                console.log(`[${status}] ${job.name} (${job.type}) - Next: ${next}`);
              }
            }
            console.log('--- End Tasks ---\n');
          } else {
            console.log('\nScheduler not enabled.\n');
          }
          prompt();
          return;
        }

        if (trimmed === '/help') {
          console.log('\nCommands:');
          console.log('  /memory - Show memory document');
          console.log('  /tasks  - Show scheduled tasks');
          console.log('  /help   - Show this help');
          console.log('  exit    - Exit the chat\n');
          prompt();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        try {
          process.stdout.write('\nAssistant: ');

          await assistant?.stream(trimmed, (token) => {
            process.stdout.write(token);
          });

          console.log('\n');
        } catch (error) {
          console.error(`\nError: ${error instanceof Error ? error.message : error}\n`);
        }

        prompt();
      });
    };

    rl.on('close', async () => {
      await cleanup(assistant);
      process.exit(0);
    });

    prompt();
  } catch (error) {
    console.error(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
    await cleanup(assistant);
    process.exit(1);
  }
}

interface DaemonOptions {
  config?: string;
}

async function startDaemon(options: DaemonOptions) {
  console.log('Starting daemon...');

  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const daemon = assistant.getDaemon();
  if (daemon?.isRunning()) {
    console.log('Daemon is already running.');
    await assistant.close();
    process.exit(1);
  }

  await assistant.startDaemon();

  // Keep process running
  process.stdin.resume();
}

async function stopDaemon(options: DaemonOptions) {
  const { config } = loadConfig(options.config);
  const baseDir = config.baseDir || DEFAULT_BASE_DIR;
  const pidFile = join(baseDir, 'daemon.pid');

  if (!existsSync(pidFile)) {
    console.log('Daemon is not running.');
    return;
  }

  try {
    const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);
    process.kill(pid, 'SIGTERM');
    console.log(`Stopped daemon (PID: ${pid})`);
  } catch (error) {
    console.error('Failed to stop daemon:', error);
  }
}

async function showDaemonStatus(options: DaemonOptions) {
  const assistant = createAssistant(options.config);
  const daemon = assistant.getDaemon();

  if (!daemon) {
    console.log('Daemon not configured.');
    return;
  }

  const status = daemon.getStatus();

  if (status.running) {
    console.log('Daemon Status: Running');
    console.log(`  PID: ${status.pid}`);
    console.log(`  Uptime: ${status.uptime} seconds`);
    console.log(`  Started: ${status.startedAt?.toLocaleString()}`);
    console.log(`  Channels: ${status.connectedChannels?.join(', ') || 'none'}`);
    console.log(`  Active Jobs: ${status.activeJobs}`);
    console.log(`  Last Health Check: ${status.lastHealthCheck?.toLocaleString() || 'N/A'}`);
  } else {
    console.log('Daemon Status: Not running');
  }
}

async function showDaemonLogs(options: DaemonOptions & { lines?: string }) {
  const assistant = createAssistant(options.config);
  const daemon = assistant.getDaemon();

  if (!daemon) {
    console.log('Daemon not configured.');
    return;
  }

  const lines = parseInt(options.lines || '50', 10);
  const logs = daemon.getLogs(lines);

  if (logs.length === 0) {
    console.log('No logs available.');
    return;
  }

  console.log('--- Daemon Logs ---');
  for (const line of logs) {
    console.log(line);
  }
  console.log('--- End Logs ---');
}

interface MemoryOptions {
  config?: string;
  limit?: string;
}

async function syncMemory(options: MemoryOptions) {
  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const memory = assistant.getMemory();
  if (!memory) {
    console.log('Memory not enabled.');
    await assistant.close();
    return;
  }

  console.log('Syncing memory...');
  const status = await memory.sync();
  console.log(`Synced ${status.itemCount} items.`);

  await assistant.close();
}

async function searchMemory(query: string, options: MemoryOptions) {
  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const memory = assistant.getMemory();
  if (!memory) {
    console.log('Memory not enabled.');
    await assistant.close();
    return;
  }

  const limit = parseInt(options.limit || '10', 10);
  const results = await memory.search(query, { limit });

  if (results.length === 0) {
    console.log('No results found.');
  } else {
    console.log(`Found ${results.length} results:\n`);
    for (const result of results) {
      console.log(`[${result.type}] ${result.content.slice(0, 100)}...`);
      console.log(`  Score: ${result.score.toFixed(2)} | Source: ${result.source}`);
      console.log();
    }
  }

  await assistant.close();
}

async function showMemory(options: MemoryOptions) {
  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const memory = assistant.getMemory();
  if (!memory) {
    console.log('Memory not enabled.');
    await assistant.close();
    return;
  }

  const doc = memory.getDocument();
  if (!doc) {
    console.log('No memory document found.');
    await assistant.close();
    return;
  }

  console.log('--- Memory Document ---\n');

  console.log('## Profile');
  for (const [key, value] of Object.entries(doc.profile)) {
    console.log(`  ${key}: ${value}`);
  }

  console.log('\n## Facts');
  for (const fact of doc.facts) {
    console.log(`  - ${fact.content}`);
  }

  console.log('\n## Todos');
  for (const todo of doc.todos) {
    const checkbox = todo.completed ? '[x]' : '[ ]';
    console.log(`  ${checkbox} ${todo.content}`);
  }

  if (doc.notes) {
    console.log('\n## Notes');
    console.log(`  ${doc.notes}`);
  }

  console.log('\n--- End Memory ---');

  await assistant.close();
}

interface SchedulerOptions {
  config?: string;
}

async function listScheduledTasks(options: SchedulerOptions) {
  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const scheduler = assistant.getScheduler();
  if (!scheduler) {
    console.log('Scheduler not enabled.');
    await assistant.close();
    return;
  }

  const jobs = scheduler.getAllJobs();

  if (jobs.length === 0) {
    console.log('No scheduled tasks.');
  } else {
    console.log('Scheduled Tasks:\n');
    for (const job of jobs) {
      const status = job.enabled ? '✓' : '✗';
      const next = job.nextRunAt ? job.nextRunAt.toLocaleString() : 'N/A';
      console.log(`[${status}] ${job.id}`);
      console.log(`    Name: ${job.name}`);
      console.log(`    Type: ${job.type}`);
      console.log(`    Next: ${next}`);
      console.log();
    }
  }

  await assistant.close();
}

async function cancelTask(id: string, options: SchedulerOptions) {
  const assistant = createAssistant(options.config);
  await assistant.initialize();

  const scheduler = assistant.getScheduler();
  if (!scheduler) {
    console.log('Scheduler not enabled.');
    await assistant.close();
    return;
  }

  const deleted = scheduler.deleteJob(id);
  if (deleted) {
    console.log(`Task ${id} cancelled.`);
  } else {
    console.log(`Task ${id} not found.`);
  }

  await assistant.close();
}

interface InitConfigOptions {
  dir?: string;
  force?: boolean;
}

async function initConfiguration(options: InitConfigOptions) {
  try {
    const configPath = initConfig(options.dir, options.force);
    console.log(`Configuration initialized at: ${configPath}`);
  } catch (error) {
    console.error(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

interface ShowConfigOptions {
  config?: string;
}

async function showConfiguration(options: ShowConfigOptions) {
  const { config, configPath } = loadConfig(options.config);

  if (!configPath) {
    console.log('No configuration file found.');
    console.log('Run `assistant config init` to create one.');
    return;
  }

  console.log(`Configuration file: ${configPath}\n`);
  console.log(serializeConfig(config));
}

async function cleanup(assistant: AssistantInstance | null) {
  if (assistant) {
    try {
      await assistant.close();
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Parse and run
program.parse();
