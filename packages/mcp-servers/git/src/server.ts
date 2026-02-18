/**
 * MCP Server implementation for git
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ServerConfig } from './types.js';
import {
  GitStatusInputSchema,
  GitDiffUnstagedInputSchema,
  GitDiffStagedInputSchema,
  GitDiffInputSchema,
  GitCommitInputSchema,
  GitAddInputSchema,
  GitResetInputSchema,
  GitLogInputSchema,
  GitCreateBranchInputSchema,
  GitCheckoutInputSchema,
  GitShowInputSchema,
  GitBranchInputSchema,
  GitError,
} from './types.js';
import {
  gitStatus,
  gitDiffUnstaged,
  gitDiffStaged,
  gitDiff,
  gitCommit,
  gitAdd,
  gitReset,
  gitLog,
  gitCreateBranch,
  gitCheckout,
  gitShow,
  gitBranch,
} from './git-operations.js';

// Tool names
const TOOLS = {
  STATUS: 'git_status',
  DIFF_UNSTAGED: 'git_diff_unstaged',
  DIFF_STAGED: 'git_diff_staged',
  DIFF: 'git_diff',
  COMMIT: 'git_commit',
  ADD: 'git_add',
  RESET: 'git_reset',
  LOG: 'git_log',
  CREATE_BRANCH: 'git_create_branch',
  CHECKOUT: 'git_checkout',
  SHOW: 'git_show',
  BRANCH: 'git_branch',
} as const;

/**
 * Create and configure the MCP server
 */
export function createServer(config: ServerConfig = {}) {
  const serverName = config.name || 'agent-stack-mcp-git';
  const serverVersion = config.version || '0.0.1';

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

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: TOOLS.STATUS,
          description: 'Shows the working tree status of a Git repository',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
            },
            required: ['repo_path'],
          },
        },
        {
          name: TOOLS.DIFF_UNSTAGED,
          description: 'Shows changes in working directory not yet staged',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              context_lines: {
                type: 'number',
                description: 'Number of context lines (default: 3)',
              },
            },
            required: ['repo_path'],
          },
        },
        {
          name: TOOLS.DIFF_STAGED,
          description: 'Shows changes staged for commit',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              context_lines: {
                type: 'number',
                description: 'Number of context lines (default: 3)',
              },
            },
            required: ['repo_path'],
          },
        },
        {
          name: TOOLS.DIFF,
          description: 'Shows differences between current state and a target branch or commit',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              target: {
                type: 'string',
                description: 'Target branch or commit to compare with',
              },
              context_lines: {
                type: 'number',
                description: 'Number of context lines (default: 3)',
              },
            },
            required: ['repo_path', 'target'],
          },
        },
        {
          name: TOOLS.COMMIT,
          description: 'Records changes to the repository with a commit message',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              message: {
                type: 'string',
                description: 'Commit message',
              },
            },
            required: ['repo_path', 'message'],
          },
        },
        {
          name: TOOLS.ADD,
          description: 'Adds file contents to the staging area',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of file paths to stage',
              },
            },
            required: ['repo_path', 'files'],
          },
        },
        {
          name: TOOLS.RESET,
          description: 'Unstages all staged changes',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
            },
            required: ['repo_path'],
          },
        },
        {
          name: TOOLS.LOG,
          description: 'Shows commit logs with optional filtering by date range',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              max_count: {
                type: 'number',
                description: 'Maximum number of commits to show (default: 10)',
              },
              start_timestamp: {
                type: 'string',
                description: 'Start timestamp (ISO 8601, relative dates like "1 week ago", or absolute dates)',
              },
              end_timestamp: {
                type: 'string',
                description: 'End timestamp (same formats as start_timestamp)',
              },
            },
            required: ['repo_path'],
          },
        },
        {
          name: TOOLS.CREATE_BRANCH,
          description: 'Creates a new branch and switches to it',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              branch_name: {
                type: 'string',
                description: 'Name of the new branch',
              },
              base_branch: {
                type: 'string',
                description: 'Base branch to create from (defaults to current branch)',
              },
            },
            required: ['repo_path', 'branch_name'],
          },
        },
        {
          name: TOOLS.CHECKOUT,
          description: 'Switches to a different branch',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              branch_name: {
                type: 'string',
                description: 'Name of branch to checkout',
              },
            },
            required: ['repo_path', 'branch_name'],
          },
        },
        {
          name: TOOLS.SHOW,
          description: 'Shows the contents of a commit',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              revision: {
                type: 'string',
                description: 'The revision (commit hash, branch name, tag) to show',
              },
            },
            required: ['repo_path', 'revision'],
          },
        },
        {
          name: TOOLS.BRANCH,
          description: 'Lists Git branches with optional filtering',
          inputSchema: {
            type: 'object',
            properties: {
              repo_path: {
                type: 'string',
                description: 'Path to Git repository',
              },
              branch_type: {
                type: 'string',
                enum: ['local', 'remote', 'all'],
                description: "Type of branches to list: 'local', 'remote', or 'all' (default: 'local')",
              },
              contains: {
                type: 'string',
                description: 'Filter branches containing this commit',
              },
              not_contains: {
                type: 'string',
                description: 'Filter branches NOT containing this commit',
              },
            },
            required: ['repo_path'],
          },
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const args = request.params.arguments;

    try {
      switch (toolName) {
        case TOOLS.STATUS: {
          const input = GitStatusInputSchema.parse(args);
          const result = await gitStatus(input.repo_path);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.DIFF_UNSTAGED: {
          const input = GitDiffUnstagedInputSchema.parse(args);
          const result = await gitDiffUnstaged(input.repo_path, input.context_lines);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.DIFF_STAGED: {
          const input = GitDiffStagedInputSchema.parse(args);
          const result = await gitDiffStaged(input.repo_path, input.context_lines);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.DIFF: {
          const input = GitDiffInputSchema.parse(args);
          const result = await gitDiff(input.repo_path, input.target, input.context_lines);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.COMMIT: {
          const input = GitCommitInputSchema.parse(args);
          const result = await gitCommit(input.repo_path, input.message);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.ADD: {
          const input = GitAddInputSchema.parse(args);
          const result = await gitAdd(input.repo_path, input.files);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.RESET: {
          const input = GitResetInputSchema.parse(args);
          const result = await gitReset(input.repo_path);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.LOG: {
          const input = GitLogInputSchema.parse(args);
          const commits = await gitLog(
            input.repo_path,
            input.max_count,
            input.start_timestamp,
            input.end_timestamp
          );
          return { content: [{ type: 'text', text: JSON.stringify(commits, null, 2) }] };
        }

        case TOOLS.CREATE_BRANCH: {
          const input = GitCreateBranchInputSchema.parse(args);
          const result = await gitCreateBranch(input.repo_path, input.branch_name, input.base_branch);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.CHECKOUT: {
          const input = GitCheckoutInputSchema.parse(args);
          const result = await gitCheckout(input.repo_path, input.branch_name);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.SHOW: {
          const input = GitShowInputSchema.parse(args);
          const result = await gitShow(input.repo_path, input.revision);
          return { content: [{ type: 'text', text: result }] };
        }

        case TOOLS.BRANCH: {
          const input = GitBranchInputSchema.parse(args);
          const branches = await gitBranch(
            input.repo_path,
            input.branch_type,
            input.contains,
            input.not_contains
          );
          return { content: [{ type: 'text', text: JSON.stringify(branches, null, 2) }] };
        }

        default:
          return {
            content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
      }
    } catch (error) {
      let errorMessage: string;

      if (error instanceof GitError) {
        errorMessage = `Git error [${error.code}]: ${error.message}`;
        if (error.command) {
          errorMessage += `\nCommand: ${error.command}`;
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
