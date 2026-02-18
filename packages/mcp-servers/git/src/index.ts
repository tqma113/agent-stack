/**
 * @agent-stack-mcp/git
 *
 * MCP server providing Git repository interaction and automation tools
 */

// Server
export { createServer, runServer } from './server.js';

// Git operations
export {
  validateRepo,
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

// Types
export type {
  GitStatusInput,
  GitDiffUnstagedInput,
  GitDiffStagedInput,
  GitDiffInput,
  GitCommitInput,
  GitAddInput,
  GitResetInput,
  GitLogInput,
  GitCreateBranchInput,
  GitCheckoutInput,
  GitShowInput,
  GitBranchInput,
  BranchType,
  CommitLogEntry,
  ServerConfig,
} from './types.js';

export {
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
  BranchTypeSchema,
  GitError,
} from './types.js';
