/**
 * Shell Skill Handlers
 *
 * Execute shell commands with safety checks
 */

const { exec } = require('child_process');
const path = require('path');

/**
 * Dangerous command patterns that should trigger a warning
 */
const DANGEROUS_PATTERNS = [
  // Destructive file operations
  /\brm\s+(-[rRf]+\s+)*[^\s]+/i,
  /\brmdir\b/i,
  // Permission changes
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  // Disk operations
  /\bdd\b/i,
  /\bmkfs\b/i,
  /\bfdisk\b/i,
  // System control
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bhalt\b/i,
  // Process control
  /\bkill\s+-9\b/i,
  /\bpkill\b/i,
  /\bkillall\b/i,
  // Git dangerous operations
  /\bgit\s+push\s+.*--force\b/i,
  /\bgit\s+reset\s+--hard\b/i,
];

/**
 * Check if a command is potentially dangerous
 */
function checkDangerous(command) {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return {
        dangerous: true,
        reason: `Command matches dangerous pattern: ${pattern.source}`,
      };
    }
  }
  return { dangerous: false };
}

/**
 * Execute a shell command
 */
async function executeCommand(args) {
  const command = args.command;
  const cwd = args.cwd || process.cwd();
  const timeout = args.timeout || 30000;

  if (!command) {
    return 'Error: command is required';
  }

  // Check for dangerous commands
  const dangerCheck = checkDangerous(command);
  if (dangerCheck.dangerous) {
    return `WARNING: This command may be dangerous.\nReason: ${dangerCheck.reason}\n\nCommand: ${command}\n\nThe command was NOT executed. If you're sure you want to run it, please confirm with the user first.`;
  }

  return new Promise((resolve) => {
    const resolvedCwd = path.resolve(cwd);

    exec(
      command,
      {
        cwd: resolvedCwd,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
        encoding: 'utf-8',
      },
      (error, stdout, stderr) => {
        if (error) {
          if (error.killed) {
            resolve(`Error: Command timed out after ${timeout}ms\nCommand: ${command}`);
            return;
          }
          resolve(`Error: Command failed with exit code ${error.code}\n\nStderr:\n${stderr}\n\nStdout:\n${stdout}`);
          return;
        }

        let result = '';
        if (stdout) {
          result += `Output:\n${stdout}`;
        }
        if (stderr) {
          result += `${stdout ? '\n\n' : ''}Stderr:\n${stderr}`;
        }
        if (!result) {
          result = 'Command completed successfully (no output)';
        }

        resolve(result);
      }
    );
  });
}

module.exports = {
  executeCommand,
};
