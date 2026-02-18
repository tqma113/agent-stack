/**
 * MCP Server implementation for bash
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from './types.js';
import {
  BashExecuteInputSchema,
  BashScriptInputSchema,
  BashBackgroundInputSchema,
  BashKillInputSchema,
  BashProcessesInputSchema,
  BashReadOutputInputSchema,
  BashWhichInputSchema,
  BashEnvInputSchema,
  BashPwdInputSchema,
  BashCdInputSchema,
  BashError,
} from './types.js';
import {
  bashExecute,
  bashScript,
  bashBackground,
  bashKill,
  bashProcesses,
  bashReadOutput,
  bashWhich,
  bashEnv,
  bashPwd,
  bashCd,
} from './bash-operations.js';

// Tool names
const TOOLS = {
  EXECUTE: 'bash_execute',
  SCRIPT: 'bash_script',
  BACKGROUND: 'bash_background',
  KILL: 'bash_kill',
  PROCESSES: 'bash_processes',
  READ_OUTPUT: 'bash_read_output',
  WHICH: 'bash_which',
  ENV: 'bash_env',
  PWD: 'bash_pwd',
  CD: 'bash_cd',
} as const;

/**
 * Create and configure the MCP server
 */
export function createServer(config: ServerConfig = {}) {
  const serverName = config.name || 'ai-stack-mcp-bash';
  const serverVersion = config.version || '0.0.1';
  const defaultWorkingDir = config.defaultWorkingDir || process.cwd();
  const defaultTimeout = config.defaultTimeout || 30000;
  const maxBufferSize = config.maxBufferSize || 10 * 1024 * 1024;
  const allowBackground = config.allowBackground !== false;

  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Tool definition type
  type ToolDef = {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  };

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: ToolDef[] = [
      {
        name: TOOLS.EXECUTE,
        description: 'Execute a bash command and return the output. Supports timeout and custom environment variables.',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute',
            },
            working_dir: {
              type: 'string',
              description: `Working directory (default: ${defaultWorkingDir})`,
            },
            timeout_ms: {
              type: 'number',
              description: `Timeout in milliseconds (default: ${defaultTimeout}, max: 600000)`,
            },
            env: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Additional environment variables',
            },
          },
          required: ['command'],
        },
      },
      {
        name: TOOLS.SCRIPT,
        description: 'Execute a multi-line bash script. Creates a temporary script file and executes it.',
        inputSchema: {
          type: 'object',
          properties: {
            script: {
              type: 'string',
              description: 'Multi-line bash script to execute',
            },
            working_dir: {
              type: 'string',
              description: `Working directory (default: ${defaultWorkingDir})`,
            },
            timeout_ms: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 60000, max: 600000)',
            },
            env: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: 'Additional environment variables',
            },
          },
          required: ['script'],
        },
      },
      {
        name: TOOLS.WHICH,
        description: 'Find the location of an executable command',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'Command name to locate',
            },
          },
          required: ['command'],
        },
      },
      {
        name: TOOLS.ENV,
        description: 'Get environment variables, optionally filtered by pattern',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter pattern (regex) to match variable names or values',
            },
          },
        },
      },
      {
        name: TOOLS.PWD,
        description: 'Get the current working directory',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: TOOLS.CD,
        description: 'Change the current working directory for subsequent commands',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path to change to',
            },
          },
          required: ['path'],
        },
      },
    ];

    // Add background process tools if enabled
    if (allowBackground) {
      tools.push(
        {
          name: TOOLS.BACKGROUND,
          description: 'Start a command as a background process. Returns the process ID for later management.',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Command to run in background',
              },
              working_dir: {
                type: 'string',
                description: `Working directory (default: ${defaultWorkingDir})`,
              },
              env: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Additional environment variables',
              },
              tag: {
                type: 'string',
                description: 'Optional tag to identify the process',
              },
            },
            required: ['command'],
          },
        },
        {
          name: TOOLS.KILL,
          description: 'Kill a background process by PID',
          inputSchema: {
            type: 'object',
            properties: {
              pid: {
                type: 'number',
                description: 'Process ID to kill',
              },
              signal: {
                type: 'string',
                enum: ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP'],
                description: 'Signal to send (default: SIGTERM)',
              },
            },
            required: ['pid'],
          },
        },
        {
          name: TOOLS.PROCESSES,
          description: 'List running background processes',
          inputSchema: {
            type: 'object',
            properties: {
              include_all: {
                type: 'boolean',
                description: 'Include all user processes, not just tracked ones',
              },
            },
          },
        },
        {
          name: TOOLS.READ_OUTPUT,
          description: 'Read output from a background process',
          inputSchema: {
            type: 'object',
            properties: {
              pid: {
                type: 'number',
                description: 'Process ID',
              },
              lines: {
                type: 'number',
                description: 'Number of lines to read (default: 100, max: 1000)',
              },
              stream: {
                type: 'string',
                enum: ['stdout', 'stderr', 'both'],
                description: 'Which stream to read (default: both)',
              },
            },
            required: ['pid'],
          },
        }
      );
    }

    return { tools };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments;

    try {
      switch (toolName) {
        case TOOLS.EXECUTE: {
          const input = BashExecuteInputSchema.parse(args);
          const result = await bashExecute(input.command, {
            workingDir: input.working_dir || defaultWorkingDir,
            timeoutMs: input.timeout_ms || defaultTimeout,
            env: input.env,
            maxBufferSize,
            blockedCommands: config.blockedCommands,
            blockedPatterns: config.blockedPatterns,
            allowedCommands: config.allowedCommands,
          });

          const output = formatExecutionResult(result);
          return {
            content: [{ type: 'text', text: output }],
            isError: result.exitCode !== 0,
          };
        }

        case TOOLS.SCRIPT: {
          const input = BashScriptInputSchema.parse(args);
          const result = await bashScript(input.script, {
            workingDir: input.working_dir || defaultWorkingDir,
            timeoutMs: input.timeout_ms || 60000,
            env: input.env,
            maxBufferSize,
            blockedCommands: config.blockedCommands,
            blockedPatterns: config.blockedPatterns,
            allowedCommands: config.allowedCommands,
          });

          const output = formatExecutionResult(result);
          return {
            content: [{ type: 'text', text: output }],
            isError: result.exitCode !== 0,
          };
        }

        case TOOLS.BACKGROUND: {
          if (!allowBackground) {
            return {
              content: [{ type: 'text', text: 'Background processes are disabled' }],
              isError: true,
            };
          }
          const input = BashBackgroundInputSchema.parse(args);
          const result = await bashBackground(input.command, {
            workingDir: input.working_dir || defaultWorkingDir,
            env: input.env,
            tag: input.tag,
            blockedCommands: config.blockedCommands,
            blockedPatterns: config.blockedPatterns,
            allowedCommands: config.allowedCommands,
            maxProcesses: config.maxBackgroundProcesses,
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                pid: result.pid,
                command: result.command,
                tag: result.tag,
                workingDir: result.workingDir,
                status: 'started',
              }, null, 2),
            }],
          };
        }

        case TOOLS.KILL: {
          if (!allowBackground) {
            return {
              content: [{ type: 'text', text: 'Background processes are disabled' }],
              isError: true,
            };
          }
          const input = BashKillInputSchema.parse(args);
          const success = bashKill(input.pid, input.signal as NodeJS.Signals);

          return {
            content: [{
              type: 'text',
              text: success
                ? `Process ${input.pid} killed with ${input.signal}`
                : `Failed to kill process ${input.pid}`,
            }],
            isError: !success,
          };
        }

        case TOOLS.PROCESSES: {
          if (!allowBackground) {
            return {
              content: [{ type: 'text', text: 'Background processes are disabled' }],
              isError: true,
            };
          }
          const input = BashProcessesInputSchema.parse(args);
          const processes = await bashProcesses(input.include_all);

          return {
            content: [{
              type: 'text',
              text: processes.length > 0
                ? JSON.stringify(processes, null, 2)
                : 'No background processes',
            }],
          };
        }

        case TOOLS.READ_OUTPUT: {
          if (!allowBackground) {
            return {
              content: [{ type: 'text', text: 'Background processes are disabled' }],
              isError: true,
            };
          }
          const input = BashReadOutputInputSchema.parse(args);
          const output = bashReadOutput(input.pid, input.lines, input.stream);

          if (!output) {
            return {
              content: [{ type: 'text', text: `Process ${input.pid} not found or not tracked` }],
              isError: true,
            };
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(output, null, 2),
            }],
          };
        }

        case TOOLS.WHICH: {
          const input = BashWhichInputSchema.parse(args);
          const location = await bashWhich(input.command);

          return {
            content: [{
              type: 'text',
              text: location || `Command '${input.command}' not found`,
            }],
            isError: !location,
          };
        }

        case TOOLS.ENV: {
          const input = BashEnvInputSchema.parse(args);
          const env = await bashEnv(input.filter);

          const entries = Object.entries(env);
          if (entries.length === 0) {
            return {
              content: [{ type: 'text', text: 'No matching environment variables' }],
            };
          }

          // Format as KEY=value
          const output = entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

          return {
            content: [{ type: 'text', text: output }],
          };
        }

        case TOOLS.PWD: {
          BashPwdInputSchema.parse(args);
          const pwd = bashPwd();
          return {
            content: [{ type: 'text', text: pwd }],
          };
        }

        case TOOLS.CD: {
          const input = BashCdInputSchema.parse(args);
          const newDir = await bashCd(input.path);
          return {
            content: [{ type: 'text', text: `Changed directory to: ${newDir}` }],
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
      }
    } catch (error) {
      let errorMessage: string;

      if (error instanceof BashError) {
        errorMessage = `Bash error [${error.code}]: ${error.message}`;
        if (error.command) {
          errorMessage += `\nCommand: ${error.command}`;
        }
        if (error.exitCode !== undefined) {
          errorMessage += `\nExit code: ${error.exitCode}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      } else {
        errorMessage = String(error);
      }

      return {
        content: [{ type: 'text', text: errorMessage }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Format execution result for output
 */
function formatExecutionResult(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  timedOut: boolean;
  durationMs: number;
}): string {
  const parts: string[] = [];

  if (result.stdout) {
    parts.push(result.stdout);
  }

  if (result.stderr) {
    if (parts.length > 0) parts.push('');
    parts.push('--- STDERR ---');
    parts.push(result.stderr);
  }

  // Add metadata for non-zero exit or timeout
  if (result.exitCode !== 0 || result.timedOut) {
    if (parts.length > 0) parts.push('');
    parts.push('--- EXECUTION INFO ---');

    if (result.timedOut) {
      parts.push('Status: TIMED OUT');
    }

    parts.push(`Exit code: ${result.exitCode}`);

    if (result.signal) {
      parts.push(`Signal: ${result.signal}`);
    }

    parts.push(`Duration: ${result.durationMs}ms`);
  }

  return parts.join('\n') || '(no output)';
}

/**
 * Run the server with stdio transport
 */
export async function runServer(config: ServerConfig = {}): Promise<void> {
  const server = createServer(config);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.close();
    process.exit(0);
  });
}
