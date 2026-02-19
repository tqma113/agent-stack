/**
 * @ai-stack/code - Code Agent Factory
 *
 * Creates a Code Agent instance with file operations, search, and undo/redo capabilities.
 */

import { createAgent, type AgentInstance, type AgentConfig, type Tool } from '@ai-stack/agent';
import type {
  CodeConfig,
  CodeAgentInstance,
  ToolContext,
  FileChange,
  UndoResult,
  RedoResult,
  SafetyConfig,
} from '../types.js';
import { loadConfig, resolveConfig, getDefaultConfig } from '../config.js';
import { buildCodePrompt } from '../prompts/code-prompt.js';
import { createFileHistoryStore, type FileHistoryStore } from '../file-history/store.js';
import { createTaskStore, type TaskStore } from '../task/store.js';
import {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGlobTool,
  createGrepTool,
  createUndoTool,
  createRedoTool,
  createTaskTools,
  performUndo,
  performRedo,
} from '../tools/index.js';
import * as readline from 'readline';
import {
  theme,
  icons,
  createStreamRenderer,
  renderPrompt,
  isTTY,
  showConfirm,
  showDiffView,
} from '@ai-stack/tui';

/**
 * Create a Code Agent instance
 */
export function createCodeAgent(config?: CodeConfig | string): CodeAgentInstance {
  // Load and resolve config
  let resolvedConfig: Required<CodeConfig>;

  if (typeof config === 'string') {
    const { config: loadedConfig } = loadConfig(config);
    resolvedConfig = resolveConfig(loadedConfig);
  } else if (config) {
    resolvedConfig = resolveConfig(config);
  } else {
    resolvedConfig = resolveConfig(getDefaultConfig());
  }

  // Build agent config
  const agentConfig: AgentConfig = {
    name: 'Code Agent',
    model: resolvedConfig.model,
    temperature: resolvedConfig.temperature,
    maxTokens: resolvedConfig.maxTokens,
    apiKey: resolvedConfig.apiKey,
    baseURL: resolvedConfig.baseURL || undefined,
    systemPrompt: buildCodePrompt(resolvedConfig.safety.workingDir!),
  };

  // Add MCP config if present
  if (resolvedConfig.mcp?.configPath) {
    agentConfig.mcp = {
      configPath: resolvedConfig.mcp.configPath,
      autoConnect: resolvedConfig.mcp.autoConnect,
    };
  }

  // Create underlying agent
  const agent = createAgent(agentConfig);

  // File read tracking for the session
  const readFiles = new Set<string>();

  // Initialize stores
  let historyStore: FileHistoryStore | null = null;
  let taskStore: TaskStore | null = null;

  // Tool context
  const toolContext: ToolContext = {
    workingDir: resolvedConfig.safety.workingDir!,
    safety: resolvedConfig.safety as Required<SafetyConfig>,
    recordChange: async (change) => {
      if (!historyStore) {
        throw new Error('History store not initialized');
      }
      return historyStore.recordChange(change);
    },
    wasFileRead: (filePath) => readFiles.has(filePath),
    markFileRead: (filePath) => readFiles.add(filePath),
    // Implement onConfirm callback using TUI
    onConfirm: async (message: string) => {
      return showConfirm(message);
    },
  };

  const instance: CodeAgentInstance = {
    async initialize(): Promise<void> {
      // Initialize history store
      if (resolvedConfig.history.enabled) {
        historyStore = createFileHistoryStore({
          dbPath: resolvedConfig.history.dbPath!,
          maxChanges: resolvedConfig.history.maxChanges!,
        });
        historyStore.initialize();
      }

      // Initialize task store
      if (resolvedConfig.tasks.enabled) {
        taskStore = createTaskStore({
          dbPath: resolvedConfig.tasks.dbPath!,
        });
        taskStore.initialize();
      }

      // Register file tools
      agent.registerTool(createReadTool(toolContext));
      agent.registerTool(createWriteTool(toolContext));
      agent.registerTool(createEditTool(toolContext));
      agent.registerTool(createGlobTool(toolContext));
      agent.registerTool(createGrepTool(toolContext));

      // Register undo/redo tools if history is enabled
      if (historyStore) {
        agent.registerTool(createUndoTool(toolContext, historyStore));
        agent.registerTool(createRedoTool(toolContext, historyStore));
      }

      // Register task tools if tasks are enabled
      if (taskStore) {
        const taskTools = createTaskTools(taskStore);
        for (const tool of taskTools) {
          agent.registerTool(tool);
        }
      }

      // Initialize MCP if configured
      if (agentConfig.mcp) {
        try {
          await agent.initializeMCP();
        } catch (error) {
          console.error('Failed to initialize MCP:', error);
        }
      }
    },

    async close(): Promise<void> {
      if (historyStore) {
        historyStore.close();
        historyStore = null;
      }
      if (taskStore) {
        taskStore.close();
        taskStore = null;
      }
      await agent.close();
    },

    async chat(input: string): Promise<string> {
      const response = await agent.chat(input);
      return response.content;
    },

    async stream(
      input: string,
      callbacks?: {
        onToken?: (token: string) => void;
        onToolCall?: (name: string, args: Record<string, unknown>) => void;
        onToolResult?: (name: string, result: string) => void;
      }
    ): Promise<string> {
      let fullResponse = '';
      await agent.stream(input, {
        onToken: (token: string) => {
          fullResponse += token;
          callbacks?.onToken?.(token);
        },
        onToolCall: callbacks?.onToolCall,
        onToolResult: callbacks?.onToolResult,
      });
      return fullResponse;
    },

    getAgent(): AgentInstance {
      return agent;
    },

    getConfig(): CodeConfig {
      return resolvedConfig;
    },

    getTools(): Tool[] {
      return agent.getTools();
    },

    registerTool(tool: Tool): void {
      agent.registerTool(tool);
    },

    async undo(): Promise<UndoResult | null> {
      if (!historyStore) {
        return null;
      }
      return performUndo(toolContext, historyStore);
    },

    async redo(): Promise<RedoResult | null> {
      if (!historyStore) {
        return null;
      }
      return performRedo(toolContext, historyStore);
    },

    async createCheckpoint(name: string): Promise<void> {
      if (!historyStore) {
        throw new Error('History not enabled');
      }
      historyStore.createCheckpoint(name);
    },

    async restoreCheckpoint(name: string): Promise<void> {
      if (!historyStore) {
        throw new Error('History not enabled');
      }
      const changes = historyStore.getChangesSinceCheckpoint(name);
      // Undo all changes since checkpoint (in reverse order)
      for (let i = changes.length - 1; i >= 0; i--) {
        const change = changes[i];
        if (!change.undone) {
          await instance.undo();
        }
      }
    },

    startCLI(): Promise<void> {
      return new Promise((resolve) => {
        const ttyMode = isTTY();
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        if (ttyMode) {
          console.log(`\n${theme.accent('Working directory:')} ${resolvedConfig.safety.workingDir}`);
          console.log(theme.muted('Type /help for commands, exit to quit\n'));
        } else {
          console.log(`\nCode Agent ready in: ${resolvedConfig.safety.workingDir}`);
          console.log('Type "exit" to quit, "/undo" to undo, "/redo" to redo\n');
        }

        // Create stream renderer for TTY mode
        const streamRenderer = ttyMode ? createStreamRenderer() : null;

        const prompt = () => {
          const promptText = ttyMode ? renderPrompt() : '> ';
          rl.question(promptText, async (input) => {
            const trimmed = input.trim();

            if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
              console.log(ttyMode ? theme.muted('\nGoodbye!') : '\nGoodbye!');
              rl.close();
              return;
            }

            // Handle special commands
            if (trimmed === '/undo') {
              try {
                const result = await instance.undo();
                if (result) {
                  const msg = `${icons.undo} Undone: ${result.file_path} -> ${result.restored_to}`;
                  console.log(ttyMode ? theme.success(msg) : msg);
                } else {
                  console.log(ttyMode ? theme.warning('Nothing to undo') : 'Nothing to undo');
                }
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error(ttyMode ? theme.error(`Error: ${msg}`) : `Error: ${msg}`);
              }
              prompt();
              return;
            }

            if (trimmed === '/redo') {
              try {
                const result = await instance.redo();
                if (result) {
                  const msg = `${icons.redo} Redone: ${result.file_path} -> ${result.action}`;
                  console.log(ttyMode ? theme.success(msg) : msg);
                } else {
                  console.log(ttyMode ? theme.warning('Nothing to redo') : 'Nothing to redo');
                }
              } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                console.error(ttyMode ? theme.error(`Error: ${msg}`) : `Error: ${msg}`);
              }
              prompt();
              return;
            }

            if (trimmed === '/tools') {
              const tools = instance.getTools();
              console.log(ttyMode ? theme.accent(`\n${icons.tool} Available tools:`) : '\nAvailable tools:');
              for (const tool of tools) {
                const desc = tool.description.split('\n')[0];
                if (ttyMode) {
                  console.log(`  ${theme.tool(tool.name)}: ${theme.muted(desc)}`);
                } else {
                  console.log(`  - ${tool.name}: ${desc}`);
                }
              }
              console.log();
              prompt();
              return;
            }

            if (trimmed === '/history') {
              if (historyStore) {
                const changes = historyStore.getRecentChanges(10);
                console.log(ttyMode ? theme.accent('\nRecent changes:') : '\nRecent changes:');
                if (changes.length === 0) {
                  console.log(ttyMode ? theme.muted('  No changes recorded') : '  No changes recorded');
                } else {
                  for (const change of changes) {
                    const status = change.undone ? icons.undo : icons.success;
                    const time = new Date(change.timestamp).toLocaleTimeString();
                    if (ttyMode) {
                      console.log(`  ${status} [${change.changeType}] ${change.filePath} ${theme.muted(`(${time})`)}`);
                    } else {
                      console.log(`  ${status} [${change.changeType}] ${change.filePath} (${time})`);
                    }
                  }
                }
              } else {
                console.log(ttyMode ? theme.warning('History not enabled') : 'History not enabled');
              }
              console.log();
              prompt();
              return;
            }

            if (trimmed === '/help') {
              console.log(ttyMode ? theme.accent('\nCommands:') : '\nCommands:');
              console.log('  /undo    - Undo last file change');
              console.log('  /redo    - Redo last undone change');
              console.log('  /history - Show recent file changes');
              console.log('  /tools   - List available tools');
              console.log('  /help    - Show this help');
              console.log('  exit     - Exit the CLI\n');
              prompt();
              return;
            }

            if (!trimmed) {
              prompt();
              return;
            }

            try {
              // Track tool calls for displaying args in results
              const toolCalls = new Map<string, { name: string; args: Record<string, unknown>; startTime: number }>();

              if (streamRenderer) {
                streamRenderer.startThinking();
                await instance.stream(trimmed, {
                  onToken: (token) => {
                    streamRenderer.addToken(token);
                  },
                  onToolCall: (name, args) => {
                    const callId = `${name}-${Date.now()}`;
                    toolCalls.set(callId, { name, args, startTime: Date.now() });
                    streamRenderer.pauseForTool({
                      name,
                      args,
                      status: 'running',
                    });
                  },
                  onToolResult: (name, result) => {
                    // Find and remove the matching tool call
                    let callInfo: { name: string; args: Record<string, unknown>; startTime: number } | undefined;
                    for (const [id, info] of toolCalls) {
                      if (info.name === name) {
                        callInfo = info;
                        toolCalls.delete(id);
                        break;
                      }
                    }
                    const duration = callInfo ? Date.now() - callInfo.startTime : undefined;
                    streamRenderer.resumeAfterTool({
                      name,
                      args: callInfo?.args || {},
                      status: result.startsWith('Error') ? 'error' : 'completed',
                      result: result.length > 200 ? result.slice(0, 200) + '...' : result,
                      duration,
                    });
                  },
                });
                streamRenderer.complete();
              } else {
                process.stdout.write('\n');
                await instance.stream(trimmed, {
                  onToken: (token) => {
                    process.stdout.write(token);
                  },
                  onToolCall: (name, args) => {
                    const callId = `${name}-${Date.now()}`;
                    toolCalls.set(callId, { name, args, startTime: Date.now() });
                    console.log(theme.tool(`\n[${icons.tool} Calling: ${name}]`));
                    if (Object.keys(args).length > 0) {
                      const argsStr = JSON.stringify(args, null, 2).split('\n').map(l => '  ' + l).join('\n');
                      console.log(theme.muted(argsStr));
                    }
                  },
                  onToolResult: (name, result) => {
                    const status = result.startsWith('Error') ? theme.error('✗') : theme.success('✓');
                    console.log(`${status} ${name} completed\n`);
                  },
                });
              }
              console.log('\n');
            } catch (error) {
              if (streamRenderer) {
                streamRenderer.showError(error instanceof Error ? error.message : String(error));
              } else {
                console.error(`\nError: ${error instanceof Error ? error.message : error}\n`);
              }
            }

            prompt();
          });
        };

        rl.on('close', async () => {
          await instance.close();
          resolve();
        });

        prompt();
      });
    },
  };

  return instance;
}
