/**
 * @ai-stack/assistant - Main Assistant
 *
 * Personal AI assistant with Markdown memory, multi-channel gateway, and scheduler.
 */

import { dirname } from 'path';
import { createAgent, type AgentInstance, type AgentConfig } from '@ai-stack/agent';
import type { AssistantConfig, IncomingMessage, MessageContent, Session } from '../types.js';
import { loadConfig, resolveConfig, getDefaultConfig } from '../config.js';
import { createMarkdownMemory, type MarkdownMemoryInstance } from '../memory/index.js';
import { createGateway, type GatewayInstance } from '../gateway/index.js';
import { createScheduler, type SchedulerInstance, type JobExecutor } from '../scheduler/index.js';
import { createDaemon, type DaemonInstance } from '../daemon/index.js';

/**
 * Initialize options
 */
export interface InitializeOptions {
  /** Skip gateway initialization (for CLI mode) */
  skipGateway?: boolean;
}

/**
 * Assistant Instance
 */
export interface AssistantInstance {
  /** Initialize the assistant */
  initialize(options?: InitializeOptions): Promise<void>;
  /** Close the assistant */
  close(): Promise<void>;

  /** Chat with the assistant */
  chat(input: string): Promise<string>;
  /** Stream chat with the assistant */
  stream(input: string, onToken?: (token: string) => void): Promise<string>;

  /** Get the underlying agent */
  getAgent(): AgentInstance;
  /** Get the memory system */
  getMemory(): MarkdownMemoryInstance | null;
  /** Get the gateway */
  getGateway(): GatewayInstance | null;
  /** Get the scheduler */
  getScheduler(): SchedulerInstance | null;
  /** Get the daemon */
  getDaemon(): DaemonInstance | null;

  /** Start interactive CLI mode */
  startCLI(): void;
  /** Start daemon mode */
  startDaemon(): Promise<void>;

  /** Get assistant name */
  getName(): string;
  /** Get configuration */
  getConfig(): AssistantConfig;
}

/**
 * Create an Assistant instance
 */
export function createAssistant(config?: AssistantConfig | string): AssistantInstance {
  // Load config from file or use provided config
  let resolvedConfig: AssistantConfig;

  if (typeof config === 'string') {
    // Explicit config path provided
    const { config: loadedConfig, configPath } = loadConfig(config);
    // Pass config directory for relative path resolution
    const configDir = configPath ? dirname(configPath) : undefined;
    resolvedConfig = resolveConfig(loadedConfig, configDir);
  } else if (config) {
    // Config object provided directly
    resolvedConfig = resolveConfig(config);
  } else {
    // No config provided - try to find config file, fall back to defaults
    const { config: loadedConfig, configPath } = loadConfig();
    if (configPath) {
      // Found a config file - resolve paths relative to it
      const configDir = dirname(configPath);
      resolvedConfig = resolveConfig(loadedConfig, configDir);
    } else {
      // No config file found - use defaults
      resolvedConfig = resolveConfig(getDefaultConfig());
    }
  }

  // Build agent config
  const agentConfig: AgentConfig = {
    name: resolvedConfig.name || 'Assistant',
    model: resolvedConfig.agent?.model || 'gpt-4o',
    temperature: resolvedConfig.agent?.temperature || 0.7,
    maxTokens: resolvedConfig.agent?.maxTokens,
    apiKey: resolvedConfig.agent?.apiKey,
    baseURL: resolvedConfig.agent?.baseURL,
    systemPrompt: buildSystemPrompt(resolvedConfig),
  };

  // Add MCP config if present
  if (resolvedConfig.agent?.mcp) {
    agentConfig.mcp = {
      configPath: resolvedConfig.agent.mcp.configPath,
      autoConnect: resolvedConfig.agent.mcp.autoConnect,
    };
  }

  // Add skill config if present
  if (resolvedConfig.agent?.skill) {
    agentConfig.skill = {
      directories: resolvedConfig.agent.skill.directories,
      autoLoad: resolvedConfig.agent.skill.autoLoad,
    };
  }

  // Create agent
  const agent = createAgent(agentConfig);

  // Optional subsystems
  let memory: MarkdownMemoryInstance | null = null;
  let gateway: GatewayInstance | null = null;
  let scheduler: SchedulerInstance | null = null;
  let daemon: DaemonInstance | null = null;

  // Message handler for gateway
  const handleMessage = async (msg: IncomingMessage, session: Session): Promise<MessageContent | string> => {
    const input = msg.content.text || '';
    if (!input.trim()) {
      return { text: '' };
    }

    // Log user message
    if (memory) {
      await memory.logUserMessage(input);
    }

    // Process with agent
    let response = '';

    await agent.stream(input, {
      onToken: (token) => {
        response += token;
      },
    });

    // Log assistant response
    if (memory) {
      await memory.logAssistantMessage(response);
    }

    return { text: response };
  };

  // Job executor for scheduler
  const executeJob: JobExecutor = async (job) => {
    let result = '';

    switch (job.execution.mode) {
      case 'agent':
        if (job.execution.prompt) {
          result = await instance.chat(job.execution.prompt);
        }
        break;

      case 'tool':
        if (job.execution.tool) {
          const tools = agent.getTools();
          const tool = tools.find((t) => t.name === job.execution.tool!.name);
          if (tool) {
            result = await tool.execute(job.execution.tool.args);
          }
        }
        break;

      case 'template':
        result = job.execution.template || '';
        break;
    }

    // Deliver to channels
    if (gateway && result) {
      for (const channel of job.delivery.channels) {
        const peerIds = job.delivery.peerIds || ['local'];
        for (const peerId of peerIds) {
          try {
            await gateway.send(channel as any, peerId, { text: result });
          } catch (error) {
            console.error(`Failed to deliver to ${channel}:${peerId}:`, error);
          }
        }
      }
    }

    return result;
  };

  const instance: AssistantInstance = {
    async initialize(options?: InitializeOptions): Promise<void> {
      const { skipGateway = false } = options || {};

      // Initialize MCP if configured
      if (agentConfig.mcp) {
        try {
          await agent.initializeMCP();
        } catch (error) {
          console.error('Failed to initialize MCP:', error);
        }
      }

      // Initialize Skills if configured
      if (agentConfig.skill) {
        try {
          await agent.initializeSkills();
        } catch (error) {
          console.error('Failed to initialize Skills:', error);
        }
      }

      // Initialize memory if enabled
      if (resolvedConfig.memory?.enabled) {
        memory = createMarkdownMemory({
          memoryFile: resolvedConfig.memory.memoryFile!,
          logsDir: resolvedConfig.memory.logsDir!,
          dbPath: resolvedConfig.memory.dbPath!,
          syncOnStartup: resolvedConfig.memory.syncOnStartup,
          watchFiles: resolvedConfig.memory.watchFiles,
        });
        await memory.initialize();

        // Update agent system prompt with memory context
        const memoryContext = memory.getMemoryContext();
        if (memoryContext) {
          const currentPrompt = agentConfig.systemPrompt || '';
          agent.configure({
            systemPrompt: `${currentPrompt}\n\n## Memory\n\n${memoryContext}`,
          });
        }
      }

      // Initialize gateway (skip in CLI mode to avoid readline conflicts)
      if (resolvedConfig.gateway && !skipGateway) {
        gateway = createGateway(resolvedConfig.gateway);
        gateway.onMessage(handleMessage);
        await gateway.initialize();
      }

      // Initialize scheduler
      if (resolvedConfig.scheduler?.enabled) {
        scheduler = createScheduler({
          enabled: true,
          allowAgentControl: resolvedConfig.scheduler.allowAgentControl,
          persistencePath: resolvedConfig.scheduler.persistencePath,
        });
        scheduler.setExecutor(executeJob);
        await scheduler.initialize();

        // Register scheduler tools with agent
        if (resolvedConfig.scheduler.allowAgentControl) {
          const schedulerTools = scheduler.getAgentTools();
          for (const tool of schedulerTools) {
            agent.registerTool({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
              execute: tool.execute,
            });
          }
        }
      }

      // Initialize daemon
      daemon = createDaemon({
        pidFile: `${resolvedConfig.baseDir}/daemon.pid`,
        logFile: `${resolvedConfig.baseDir}/daemon.log`,
      });
    },

    async close(): Promise<void> {
      if (scheduler) {
        await scheduler.close();
        scheduler = null;
      }

      if (gateway) {
        await gateway.close();
        gateway = null;
      }

      if (memory) {
        await memory.close();
        memory = null;
      }

      if (daemon) {
        daemon.stopHealthCheck();
        daemon.removePidFile();
        daemon = null;
      }

      await agent.close();
    },

    async chat(input: string): Promise<string> {
      // Log user message
      if (memory) {
        await memory.logUserMessage(input);
      }

      const response = await agent.chat(input);

      // Log assistant response
      if (memory) {
        await memory.logAssistantMessage(response.content);
      }

      return response.content;
    },

    async stream(input: string, onToken?: (token: string) => void): Promise<string> {
      // Log user message
      if (memory) {
        await memory.logUserMessage(input);
      }

      let fullResponse = '';

      await agent.stream(input, {
        onToken: (token) => {
          fullResponse += token;
          onToken?.(token);
        },
      });

      // Log assistant response
      if (memory) {
        await memory.logAssistantMessage(fullResponse);
      }

      return fullResponse;
    },

    getAgent(): AgentInstance {
      return agent;
    },

    getMemory(): MarkdownMemoryInstance | null {
      return memory;
    },

    getGateway(): GatewayInstance | null {
      return gateway;
    },

    getScheduler(): SchedulerInstance | null {
      return scheduler;
    },

    getDaemon(): DaemonInstance | null {
      return daemon;
    },

    startCLI(): void {
      if (!gateway) {
        throw new Error('Gateway not initialized');
      }
      gateway.startCLI();
    },

    async startDaemon(): Promise<void> {
      if (!daemon) {
        throw new Error('Daemon not initialized');
      }

      // Check if already running
      if (daemon.isRunning()) {
        throw new Error('Daemon is already running');
      }

      // Write PID file
      daemon.writePidFile();
      daemon.log('Daemon started');

      // Start health checks
      daemon.startHealthCheck();

      // Start scheduler if available
      if (scheduler) {
        scheduler.start();
        daemon.log('Scheduler started');
      }

      // Log connected channels
      if (gateway) {
        const channels = gateway.getConnectedChannels();
        daemon.log(`Connected channels: ${channels.join(', ') || 'none'}`);
      }

      // Handle shutdown signals
      const shutdown = async () => {
        daemon?.log('Shutdown signal received');
        await instance.close();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      daemon.log('Daemon running. Press Ctrl+C to stop.');
    },

    getName(): string {
      return resolvedConfig.name || 'Assistant';
    },

    getConfig(): AssistantConfig {
      return resolvedConfig;
    },
  };

  return instance;
}

/**
 * Build the system prompt with memory and profile context
 */
function buildSystemPrompt(config: AssistantConfig): string {
  const parts: string[] = [];

  // Base prompt
  parts.push(config.agent?.systemPrompt || 'You are a helpful personal AI assistant.');

  // Add assistant name
  if (config.name) {
    parts.push(`Your name is ${config.name}.`);
  }

  // Add scheduler instructions if enabled
  if (config.scheduler?.enabled && config.scheduler.allowAgentControl) {
    parts.push(`
You have access to scheduling tools:
- Use \`create_reminder\` to set reminders for the user
- Use \`list_scheduled_tasks\` to show scheduled tasks
- Use \`cancel_task\` to cancel a scheduled task

When the user asks to be reminded about something, use the create_reminder tool.
`);
  }

  return parts.join('\n\n');
}
