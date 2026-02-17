#!/usr/bin/env node
/**
 * CLI entry point for agent-stack
 */

import { Command } from 'commander';
import * as readline from 'readline';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { Agent } from './agent';
import {
  loadConfig,
  toAgentConfig,
  generateConfigTemplate,
  serializeConfig,
  findConfigFile,
} from './config';

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

// ANSI color codes (minimal chalk replacement)
const colors = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// Simple spinner
function createSpinner(text: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let interval: NodeJS.Timeout | null = null;

  return {
    start() {
      process.stdout.write('\x1b[?25l'); // Hide cursor
      interval = setInterval(() => {
        process.stdout.write(`\r${colors.cyan(frames[i])} ${text}`);
        i = (i + 1) % frames.length;
      }, 80);
      return this;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        process.stdout.write('\r\x1b[K'); // Clear line
        process.stdout.write('\x1b[?25h'); // Show cursor
      }
      return this;
    },
    succeed(msg: string) {
      this.stop();
      console.log(`${colors.green('✔')} ${msg}`);
      return this;
    },
    fail(msg: string) {
      this.stop();
      console.log(`${colors.red('✖')} ${msg}`);
      return this;
    },
    info(msg: string) {
      this.stop();
      console.log(`${colors.blue('ℹ')} ${msg}`);
      return this;
    },
  };
}

const program = new Command();

program
  .name('agent-stack')
  .description('AI Agent framework with MCP and Skill support')
  .version(VERSION);

// ============================================
// chat command
// ============================================
program
  .command('chat')
  .description('Start interactive chat session')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-m, --model <name>', 'LLM model to use')
  .option('--mcp <path>', 'MCP configuration file path')
  .option('--skill <dir>', 'Skill directory (can be specified multiple times)', collect, [])
  .option('--no-stream', 'Disable streaming output')
  .action(async (options) => {
    await runChat(options);
  });

// ============================================
// run command
// ============================================
program
  .command('run <task>')
  .description('Execute a single task')
  .option('-c, --config <path>', 'Configuration file path')
  .option('-m, --model <name>', 'LLM model to use')
  .option('-y, --yes', 'Skip confirmation prompts')
  .option('--json', 'Output result as JSON')
  .action(async (task, options) => {
    await runTask(task, options);
  });

// ============================================
// tools command
// ============================================
const toolsCmd = program
  .command('tools')
  .description('Manage and inspect tools');

toolsCmd
  .command('list')
  .description('List all available tools')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    await listTools(options);
  });

toolsCmd
  .command('info <name>')
  .description('Show tool details')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (name, options) => {
    await showToolInfo(name, options);
  });

// ============================================
// config command
// ============================================
const configCmd = program
  .command('config')
  .description('Manage configuration');

configCmd
  .command('init')
  .description('Generate a configuration file template')
  .option('-f, --force', 'Overwrite existing configuration')
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
// Helper functions
// ============================================

function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

interface ChatOptions {
  config?: string;
  model?: string;
  mcp?: string;
  skill?: string[];
  stream?: boolean;
}

async function runChat(options: ChatOptions) {
  console.log(colors.bold(`\n🤖 Agent Stack CLI v${VERSION}`));

  const spinner = createSpinner('Loading configuration...').start();

  try {
    // Load configuration
    const { config, configPath } = loadConfig(options.config);
    const baseDir = configPath ? dirname(configPath) : process.cwd();

    // Override with CLI options
    if (options.model) config.model = options.model;
    if (options.mcp) config.mcp = { ...config.mcp, configPath: options.mcp };
    if (options.skill && options.skill.length > 0) {
      config.skill = {
        ...config.skill,
        directories: [...(config.skill?.directories || []), ...options.skill],
      };
    }

    // Create agent
    const agentConfig = toAgentConfig(config, baseDir);
    const agent = new Agent(agentConfig);

    // Initialize MCP if configured
    if (agentConfig.mcp?.configPath || agentConfig.mcp?.servers) {
      spinner.stop();
      const mcpSpinner = createSpinner('Connecting to MCP servers...').start();
      try {
        await agent.initializeMCP();
        mcpSpinner.succeed('MCP servers connected');
      } catch (error) {
        mcpSpinner.fail(`Failed to connect MCP: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Initialize Skills if configured
    if (agentConfig.skill?.directories || agentConfig.skill?.skills) {
      spinner.stop();
      const skillSpinner = createSpinner('Loading skills...').start();
      try {
        await agent.initializeSkills();
        skillSpinner.succeed('Skills loaded');
      } catch (error) {
        skillSpinner.fail(`Failed to load skills: ${error instanceof Error ? error.message : error}`);
      }
    }

    spinner.stop();
    console.log(colors.gray(`   Model: ${config.model || 'gpt-4o'}`));
    console.log(colors.gray(`   Tools: ${agent.getTools().length} available`));
    console.log(colors.gray('   Type "exit" or press Ctrl+C to quit.\n'));

    // Start interactive loop
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = () => {
      rl.question(colors.green('You: '), async (input) => {
        const trimmed = input.trim();

        if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
          console.log(colors.gray('\nGoodbye! 👋'));
          await cleanup(agent);
          rl.close();
          process.exit(0);
        }

        if (trimmed === '/tools') {
          const tools = agent.getTools();
          console.log(colors.cyan(`\n📦 Available tools (${tools.length}):`));
          for (const tool of tools) {
            console.log(colors.gray(`   - ${tool.name}: ${tool.description.slice(0, 60)}...`));
          }
          console.log();
          prompt();
          return;
        }

        if (trimmed === '/clear') {
          agent.clearHistory();
          console.log(colors.gray('Conversation history cleared.\n'));
          prompt();
          return;
        }

        if (trimmed === '/help') {
          console.log(colors.cyan('\nCommands:'));
          console.log(colors.gray('  /tools  - List available tools'));
          console.log(colors.gray('  /clear  - Clear conversation history'));
          console.log(colors.gray('  /help   - Show this help'));
          console.log(colors.gray('  exit    - Exit the chat\n'));
          prompt();
          return;
        }

        if (!trimmed) {
          prompt();
          return;
        }

        try {
          process.stdout.write(colors.blue('\nAgent: '));

          if (options.stream !== false) {
            await agent.stream(trimmed, {
              onToken: (token) => {
                process.stdout.write(token);
              },
              onToolCall: (name, _args) => {
                console.log(colors.yellow(`\n[Calling tool: ${name}]`));
              },
              onToolResult: (name, result) => {
                const preview = result.length > 100 ? result.slice(0, 100) + '...' : result;
                console.log(colors.gray(`[Tool ${name} returned: ${preview}]`));
              },
            });
          } else {
            const response = await agent.chat(trimmed);
            process.stdout.write(response.content);
          }

          console.log('\n');
        } catch (error) {
          console.error(colors.red(`\nError: ${error instanceof Error ? error.message : error}`));
          console.log();
        }

        prompt();
      });
    };

    // Handle Ctrl+C
    rl.on('close', async () => {
      await cleanup(agent);
      process.exit(0);
    });

    prompt();
  } catch (error) {
    spinner.fail(`Failed to initialize: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

interface RunOptions {
  config?: string;
  model?: string;
  yes?: boolean;
  json?: boolean;
}

async function runTask(task: string, options: RunOptions) {
  const spinner = createSpinner('Initializing agent...').start();

  try {
    // Load configuration
    const { config, configPath } = loadConfig(options.config);
    const baseDir = configPath ? dirname(configPath) : process.cwd();

    // Override with CLI options
    if (options.model) config.model = options.model;

    // Create agent
    const agentConfig = toAgentConfig(config, baseDir);
    const agent = new Agent(agentConfig);

    // Initialize MCP if configured
    if (agentConfig.mcp?.configPath || agentConfig.mcp?.servers) {
      try {
        await agent.initializeMCP();
      } catch (error) {
        // Continue without MCP
      }
    }

    // Initialize Skills if configured
    if (agentConfig.skill?.directories || agentConfig.skill?.skills) {
      try {
        await agent.initializeSkills();
      } catch (error) {
        // Continue without skills
      }
    }

    spinner.stop();

    // Execute task
    const response = await agent.chat(task);

    // Output result
    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(response.content);
    }

    await cleanup(agent);
    process.exit(0);
  } catch (error) {
    spinner.fail(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

interface ToolsOptions {
  config?: string;
}

async function listTools(options: ToolsOptions) {
  const spinner = createSpinner('Loading tools...').start();

  try {
    const { config, configPath } = loadConfig(options.config);
    const baseDir = configPath ? dirname(configPath) : process.cwd();
    const agentConfig = toAgentConfig(config, baseDir);
    const agent = new Agent(agentConfig);

    // Initialize MCP and Skills
    try {
      if (agentConfig.mcp?.configPath || agentConfig.mcp?.servers) {
        await agent.initializeMCP();
      }
    } catch {
      // Ignore MCP errors
    }

    try {
      if (agentConfig.skill?.directories || agentConfig.skill?.skills) {
        await agent.initializeSkills();
      }
    } catch {
      // Ignore skill errors
    }

    spinner.stop();

    const tools = agent.getTools();

    if (tools.length === 0) {
      console.log(colors.yellow('No tools available.'));
      console.log(colors.gray('Configure MCP servers or Skills to add tools.'));
    } else {
      console.log(colors.bold(`\n📦 Available Tools (${tools.length}):\n`));
      for (const tool of tools) {
        console.log(`  ${colors.cyan(tool.name)}`);
        console.log(`  ${colors.gray(tool.description)}`);
        console.log();
      }
    }

    await cleanup(agent);
  } catch (error) {
    spinner.fail(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

async function showToolInfo(name: string, options: ToolsOptions) {
  const spinner = createSpinner('Loading tools...').start();

  try {
    const { config, configPath } = loadConfig(options.config);
    const baseDir = configPath ? dirname(configPath) : process.cwd();
    const agentConfig = toAgentConfig(config, baseDir);
    const agent = new Agent(agentConfig);

    // Initialize MCP and Skills
    try {
      if (agentConfig.mcp?.configPath || agentConfig.mcp?.servers) {
        await agent.initializeMCP();
      }
    } catch {
      // Ignore MCP errors
    }

    try {
      if (agentConfig.skill?.directories || agentConfig.skill?.skills) {
        await agent.initializeSkills();
      }
    } catch {
      // Ignore skill errors
    }

    spinner.stop();

    const tools = agent.getTools();
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      console.log(colors.red(`Tool not found: ${name}`));
      console.log(colors.gray(`Available tools: ${tools.map(t => t.name).join(', ')}`));
      await cleanup(agent);
      process.exit(1);
    }

    console.log(colors.bold(`\n📦 Tool: ${tool.name}\n`));
    console.log(`${colors.cyan('Description:')} ${tool.description}`);
    console.log(`${colors.cyan('Parameters:')}`);
    console.log(JSON.stringify(tool.parameters, null, 2));

    await cleanup(agent);
  } catch (error) {
    spinner.fail(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

interface InitOptions {
  force?: boolean;
}

async function initConfig(options: InitOptions) {
  const configPath = resolve(process.cwd(), '.agent-stack.json');

  if (existsSync(configPath) && !options.force) {
    console.log(colors.yellow(`Configuration file already exists: ${configPath}`));
    console.log(colors.gray('Use --force to overwrite.'));
    process.exit(1);
  }

  const template = generateConfigTemplate();
  const content = serializeConfig(template);

  writeFileSync(configPath, content, 'utf-8');
  console.log(colors.green(`✔ Configuration file created: ${configPath}`));
}

interface ShowConfigOptions {
  config?: string;
}

async function showConfig(options: ShowConfigOptions) {
  const { config, configPath } = loadConfig(options.config);

  if (!configPath) {
    console.log(colors.yellow('No configuration file found.'));
    console.log(colors.gray('Run `agent-stack config init` to create one.'));
    return;
  }

  console.log(colors.bold(`\n📋 Configuration: ${configPath}\n`));
  console.log(serializeConfig(config));
}

async function cleanup(agent: Agent) {
  try {
    await agent.closeMCP();
    await agent.closeSkills();
  } catch {
    // Ignore cleanup errors
  }
}

// Parse and run
program.parse();
