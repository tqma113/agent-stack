/**
 * Bash operations using child_process
 */

import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { access, writeFile, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import type { ExecutionResult, ProcessInfo } from './types.js';
import { BashError } from './types.js';

const execAsync = promisify(exec);

// Default blocked commands for security
const DEFAULT_BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf /*',
  'mkfs',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  ':(){:|:&};:',  // Fork bomb
  '> /dev/sda',
  'chmod -R 777 /',
  'chown -R',
];

// Default blocked patterns
const DEFAULT_BLOCKED_PATTERNS = [
  /rm\s+(-[rRf]+\s+)*\s*\/\s*$/,  // rm -rf /
  />\s*\/dev\/sd[a-z]/,           // Write to disk devices
  /mkfs\./,                        // Format filesystem
  /:\(\)\{.*\}.*;.*:/,            // Fork bomb variants
];

/**
 * Background process manager
 */
class ProcessManager {
  private processes: Map<number, ProcessInfo & { process: ChildProcess; outputBuffer: { stdout: string[]; stderr: string[] } }> = new Map();
  private maxProcesses: number;

  constructor(maxProcesses: number = 10) {
    this.maxProcesses = maxProcesses;
  }

  add(pid: number, command: string, workingDir: string, childProcess: ChildProcess, tag?: string): void {
    if (this.processes.size >= this.maxProcesses) {
      throw new BashError(
        `Maximum number of background processes (${this.maxProcesses}) reached`,
        'MAX_PROCESSES_REACHED'
      );
    }

    const info: ProcessInfo & { process: ChildProcess; outputBuffer: { stdout: string[]; stderr: string[] } } = {
      pid,
      command,
      tag,
      startedAt: Date.now(),
      workingDir,
      status: 'running',
      exitCode: undefined,
      process: childProcess,
      outputBuffer: { stdout: [], stderr: [] },
    };

    // Capture output
    childProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      info.outputBuffer.stdout.push(...lines);
      // Keep only last 1000 lines
      if (info.outputBuffer.stdout.length > 1000) {
        info.outputBuffer.stdout = info.outputBuffer.stdout.slice(-1000);
      }
    });

    childProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      info.outputBuffer.stderr.push(...lines);
      if (info.outputBuffer.stderr.length > 1000) {
        info.outputBuffer.stderr = info.outputBuffer.stderr.slice(-1000);
      }
    });

    childProcess.on('exit', (code, signal) => {
      info.status = signal ? 'killed' : 'exited';
      info.exitCode = code ?? undefined;
    });

    this.processes.set(pid, info);
  }

  get(pid: number): (ProcessInfo & { outputBuffer: { stdout: string[]; stderr: string[] } }) | undefined {
    const info = this.processes.get(pid);
    if (!info) return undefined;

    return {
      pid: info.pid,
      command: info.command,
      tag: info.tag,
      startedAt: info.startedAt,
      workingDir: info.workingDir,
      status: info.status,
      exitCode: info.exitCode,
      outputBuffer: info.outputBuffer,
    };
  }

  kill(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const info = this.processes.get(pid);
    if (!info) return false;

    try {
      info.process.kill(signal);
      return true;
    } catch {
      return false;
    }
  }

  list(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(({ process: _, outputBuffer: __, ...info }) => info);
  }

  cleanup(): void {
    for (const [pid, info] of this.processes) {
      if (info.status !== 'running') {
        this.processes.delete(pid);
      }
    }
  }
}

// Global process manager instance
const processManager = new ProcessManager();

/**
 * Validate working directory exists
 */
async function validateWorkingDir(dir: string): Promise<string> {
  const absolutePath = path.resolve(dir);
  try {
    await access(absolutePath);
    return absolutePath;
  } catch {
    throw new BashError(
      `Working directory does not exist: ${absolutePath}`,
      'DIR_NOT_FOUND'
    );
  }
}

/**
 * Check if command is blocked
 */
function isCommandBlocked(
  command: string,
  blockedCommands: string[] = DEFAULT_BLOCKED_COMMANDS,
  blockedPatterns: RegExp[] = DEFAULT_BLOCKED_PATTERNS,
  allowedCommands?: string[]
): { blocked: boolean; reason?: string } {
  // If whitelist mode, check if command starts with allowed command
  if (allowedCommands && allowedCommands.length > 0) {
    const firstWord = command.trim().split(/\s+/)[0];
    if (!allowedCommands.includes(firstWord)) {
      return { blocked: true, reason: `Command '${firstWord}' is not in the allowed list` };
    }
  }

  // Check blocked commands
  for (const blocked of blockedCommands) {
    if (command.includes(blocked)) {
      return { blocked: true, reason: `Command contains blocked pattern: ${blocked}` };
    }
  }

  // Check blocked patterns
  for (const pattern of blockedPatterns) {
    if (pattern.test(command)) {
      return { blocked: true, reason: `Command matches blocked pattern` };
    }
  }

  return { blocked: false };
}

/**
 * Execute a bash command
 */
export async function bashExecute(
  command: string,
  options: {
    workingDir?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
    maxBufferSize?: number;
    blockedCommands?: string[];
    blockedPatterns?: RegExp[];
    allowedCommands?: string[];
  } = {}
): Promise<ExecutionResult> {
  const {
    workingDir = process.cwd(),
    timeoutMs = 30000,
    env = {},
    maxBufferSize = 10 * 1024 * 1024,
    blockedCommands,
    blockedPatterns,
    allowedCommands,
  } = options;

  // Security check
  const blockCheck = isCommandBlocked(command, blockedCommands, blockedPatterns, allowedCommands);
  if (blockCheck.blocked) {
    throw new BashError(
      blockCheck.reason || 'Command is blocked',
      'COMMAND_BLOCKED',
      command
    );
  }

  const cwd = await validateWorkingDir(workingDir);
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const childProcess = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let killed = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      childProcess.kill('SIGKILL');
    }, timeoutMs);

    childProcess.stdout?.on('data', (data) => {
      if (stdout.length < maxBufferSize) {
        stdout += data.toString();
      }
    });

    childProcess.stderr?.on('data', (data) => {
      if (stderr.length < maxBufferSize) {
        stderr += data.toString();
      }
    });

    childProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(new BashError(err.message, 'SPAWN_ERROR', command));
    });

    childProcess.on('exit', (code, signal) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - startTime;

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? (timedOut ? 124 : (killed ? 137 : 1)),
        signal: signal || undefined,
        timedOut,
        durationMs,
      });
    });
  });
}

/**
 * Execute a multi-line bash script
 */
export async function bashScript(
  script: string,
  options: {
    workingDir?: string;
    timeoutMs?: number;
    env?: Record<string, string>;
    maxBufferSize?: number;
    blockedCommands?: string[];
    blockedPatterns?: RegExp[];
    allowedCommands?: string[];
  } = {}
): Promise<ExecutionResult> {
  const {
    workingDir = process.cwd(),
    timeoutMs = 60000,
    env = {},
    maxBufferSize = 10 * 1024 * 1024,
    blockedCommands,
    blockedPatterns,
    allowedCommands,
  } = options;

  // Check each line for blocked commands
  const lines = script.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const blockCheck = isCommandBlocked(trimmed, blockedCommands, blockedPatterns, allowedCommands);
      if (blockCheck.blocked) {
        throw new BashError(
          blockCheck.reason || 'Script contains blocked command',
          'COMMAND_BLOCKED',
          trimmed
        );
      }
    }
  }

  const cwd = await validateWorkingDir(workingDir);

  // Create temp script file
  const tempDir = await mkdtemp(path.join(tmpdir(), 'mcp-bash-'));
  const scriptPath = path.join(tempDir, 'script.sh');

  try {
    await writeFile(scriptPath, script, { mode: 0o700 });

    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const childProcess = spawn('bash', [scriptPath], {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeout = setTimeout(() => {
        timedOut = true;
        childProcess.kill('SIGKILL');
      }, timeoutMs);

      childProcess.stdout?.on('data', (data) => {
        if (stdout.length < maxBufferSize) {
          stdout += data.toString();
        }
      });

      childProcess.stderr?.on('data', (data) => {
        if (stderr.length < maxBufferSize) {
          stderr += data.toString();
        }
      });

      childProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new BashError(err.message, 'SPAWN_ERROR'));
      });

      childProcess.on('exit', (code, signal) => {
        clearTimeout(timeout);
        const durationMs = Date.now() - startTime;

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? (timedOut ? 124 : 1),
          signal: signal || undefined,
          timedOut,
          durationMs,
        });
      });
    });
  } finally {
    // Cleanup temp files
    try {
      await rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Start a background process
 */
export async function bashBackground(
  command: string,
  options: {
    workingDir?: string;
    env?: Record<string, string>;
    tag?: string;
    blockedCommands?: string[];
    blockedPatterns?: RegExp[];
    allowedCommands?: string[];
    maxProcesses?: number;
  } = {}
): Promise<ProcessInfo> {
  const {
    workingDir = process.cwd(),
    env = {},
    tag,
    blockedCommands,
    blockedPatterns,
    allowedCommands,
  } = options;

  // Security check
  const blockCheck = isCommandBlocked(command, blockedCommands, blockedPatterns, allowedCommands);
  if (blockCheck.blocked) {
    throw new BashError(
      blockCheck.reason || 'Command is blocked',
      'COMMAND_BLOCKED',
      command
    );
  }

  const cwd = await validateWorkingDir(workingDir);

  const childProcess = spawn('bash', ['-c', command], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  if (!childProcess.pid) {
    throw new BashError('Failed to start background process', 'SPAWN_ERROR', command);
  }

  processManager.add(childProcess.pid, command, cwd, childProcess, tag);

  return {
    pid: childProcess.pid,
    command,
    tag,
    startedAt: Date.now(),
    workingDir: cwd,
    status: 'running',
  };
}

/**
 * Kill a background process
 */
export function bashKill(pid: number, signal: NodeJS.Signals = 'SIGTERM'): boolean {
  // First try our tracked processes
  if (processManager.kill(pid, signal)) {
    return true;
  }

  // Try to kill directly
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * List background processes
 */
export async function bashProcesses(includeAll: boolean = false): Promise<ProcessInfo[]> {
  // Cleanup exited processes
  processManager.cleanup();

  if (!includeAll) {
    return processManager.list();
  }

  // Get all user processes
  try {
    const { stdout } = await execAsync('ps -u $USER -o pid,comm,etime,state');
    const lines = stdout.trim().split('\n').slice(1); // Skip header

    const processes: ProcessInfo[] = [];
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const pid = parseInt(parts[0], 10);
        const command = parts[1];
        const etime = parts[2];
        const state = parts[3];

        // Parse elapsed time to approximate start time
        const startedAt = Date.now() - parseElapsedTime(etime);

        processes.push({
          pid,
          command,
          startedAt,
          workingDir: process.cwd(),
          status: state === 'Z' ? 'exited' : 'running',
        });
      }
    }

    return processes;
  } catch {
    // Fallback to tracked processes
    return processManager.list();
  }
}

/**
 * Parse ps etime format (e.g., "01:23:45" or "2-01:23:45")
 */
function parseElapsedTime(etime: string): number {
  const parts = etime.split('-');
  let days = 0;
  let time = etime;

  if (parts.length === 2) {
    days = parseInt(parts[0], 10);
    time = parts[1];
  }

  const timeParts = time.split(':').map(Number);
  let seconds = 0;

  if (timeParts.length === 3) {
    seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  } else if (timeParts.length === 2) {
    seconds = timeParts[0] * 60 + timeParts[1];
  } else {
    seconds = timeParts[0];
  }

  return (days * 86400 + seconds) * 1000;
}

/**
 * Read output from a background process
 */
export function bashReadOutput(
  pid: number,
  lines: number = 100,
  stream: 'stdout' | 'stderr' | 'both' = 'both'
): { stdout?: string; stderr?: string } | null {
  const info = processManager.get(pid);
  if (!info) return null;

  const result: { stdout?: string; stderr?: string } = {};

  if (stream === 'stdout' || stream === 'both') {
    result.stdout = info.outputBuffer.stdout.slice(-lines).join('\n');
  }

  if (stream === 'stderr' || stream === 'both') {
    result.stderr = info.outputBuffer.stderr.slice(-lines).join('\n');
  }

  return result;
}

/**
 * Find executable location
 */
export async function bashWhich(command: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`which ${command}`);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Get environment variables
 */
export async function bashEnv(filter?: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      if (!filter || key.match(new RegExp(filter, 'i')) || value.match(new RegExp(filter, 'i'))) {
        env[key] = value;
      }
    }
  }

  return env;
}

/**
 * Get current working directory
 */
export function bashPwd(): string {
  return process.cwd();
}

/**
 * Change working directory
 */
export async function bashCd(dir: string): Promise<string> {
  const absolutePath = await validateWorkingDir(dir);
  process.chdir(absolutePath);
  return absolutePath;
}
