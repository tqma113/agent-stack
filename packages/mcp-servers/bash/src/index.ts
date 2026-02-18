/**
 * @ai-stack-mcp/bash
 *
 * MCP server providing secure bash/shell command execution with sandboxing and safety controls
 */

// Server
export { createServer, runServer } from './server.js';

// Bash operations
export {
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

// Types
export type {
  BashExecuteInput,
  BashScriptInput,
  BashBackgroundInput,
  BashKillInput,
  BashProcessesInput,
  BashReadOutputInput,
  BashWhichInput,
  BashEnvInput,
  BashPwdInput,
  BashCdInput,
  ExecutionResult,
  ProcessInfo,
  ServerConfig,
} from './types.js';

export {
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
