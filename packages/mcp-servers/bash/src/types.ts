/**
 * Types for @ai-stack-mcp/bash
 */

import { z } from 'zod';

/**
 * bash_execute input schema
 * Execute a command in bash shell
 */
export const BashExecuteInputSchema = z.object({
  command: z.string().min(1).describe('The bash command to execute'),
  working_dir: z.string().optional().describe('Working directory for command execution'),
  timeout_ms: z.number().int().min(100).max(600000).optional().default(30000)
    .describe('Command timeout in milliseconds (100-600000, default: 30000)'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
});
export type BashExecuteInput = z.infer<typeof BashExecuteInputSchema>;

/**
 * bash_script input schema
 * Execute a multi-line bash script
 */
export const BashScriptInputSchema = z.object({
  script: z.string().min(1).describe('Multi-line bash script to execute'),
  working_dir: z.string().optional().describe('Working directory for script execution'),
  timeout_ms: z.number().int().min(100).max(600000).optional().default(60000)
    .describe('Script timeout in milliseconds (100-600000, default: 60000)'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
});
export type BashScriptInput = z.infer<typeof BashScriptInputSchema>;

/**
 * bash_background input schema
 * Start a background process
 */
export const BashBackgroundInputSchema = z.object({
  command: z.string().min(1).describe('Command to run in background'),
  working_dir: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
  tag: z.string().optional().describe('Optional tag to identify the process'),
});
export type BashBackgroundInput = z.infer<typeof BashBackgroundInputSchema>;

/**
 * bash_kill input schema
 * Kill a background process
 */
export const BashKillInputSchema = z.object({
  pid: z.number().int().positive().describe('Process ID to kill'),
  signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP']).optional().default('SIGTERM')
    .describe('Signal to send (default: SIGTERM)'),
});
export type BashKillInput = z.infer<typeof BashKillInputSchema>;

/**
 * bash_processes input schema
 * List running background processes
 */
export const BashProcessesInputSchema = z.object({
  include_all: z.boolean().optional().default(false)
    .describe('Include all user processes, not just tracked ones'),
});
export type BashProcessesInput = z.infer<typeof BashProcessesInputSchema>;

/**
 * bash_read_output input schema
 * Read output from a background process
 */
export const BashReadOutputInputSchema = z.object({
  pid: z.number().int().positive().describe('Process ID'),
  lines: z.number().int().min(1).max(1000).optional().default(100)
    .describe('Number of lines to read (default: 100)'),
  stream: z.enum(['stdout', 'stderr', 'both']).optional().default('both')
    .describe('Which stream to read'),
});
export type BashReadOutputInput = z.infer<typeof BashReadOutputInputSchema>;

/**
 * bash_which input schema
 * Find executable location
 */
export const BashWhichInputSchema = z.object({
  command: z.string().min(1).describe('Command name to locate'),
});
export type BashWhichInput = z.infer<typeof BashWhichInputSchema>;

/**
 * bash_env input schema
 * Get environment variables
 */
export const BashEnvInputSchema = z.object({
  filter: z.string().optional().describe('Filter pattern (grep-style regex)'),
});
export type BashEnvInput = z.infer<typeof BashEnvInputSchema>;

/**
 * bash_pwd input schema
 * Get current working directory
 */
export const BashPwdInputSchema = z.object({});
export type BashPwdInput = z.infer<typeof BashPwdInputSchema>;

/**
 * bash_cd input schema
 * Change working directory for subsequent commands
 */
export const BashCdInputSchema = z.object({
  path: z.string().min(1).describe('Directory path to change to'),
});
export type BashCdInput = z.infer<typeof BashCdInputSchema>;

/**
 * Execution result
 */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Background process info
 */
export interface ProcessInfo {
  pid: number;
  command: string;
  tag?: string;
  startedAt: number;
  workingDir: string;
  status: 'running' | 'exited' | 'killed';
  exitCode?: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  /** Default working directory */
  defaultWorkingDir?: string;
  /** Default timeout in ms */
  defaultTimeout?: number;
  /** Maximum output buffer size in bytes */
  maxBufferSize?: number;
  /** Commands to block (security) */
  blockedCommands?: string[];
  /** Patterns to block in commands */
  blockedPatterns?: RegExp[];
  /** Allow only these commands (whitelist mode) */
  allowedCommands?: string[];
  /** Whether to allow background processes */
  allowBackground?: boolean;
  /** Maximum concurrent background processes */
  maxBackgroundProcesses?: number;
}

/**
 * Bash execution error
 */
export class BashError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly command?: string,
    public readonly exitCode?: number
  ) {
    super(message);
    this.name = 'BashError';
  }
}
