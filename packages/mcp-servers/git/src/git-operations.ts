/**
 * Git operations using child_process
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { access } from 'fs/promises';
import path from 'path';
import type { CommitLogEntry } from './types.js';
import { GitError } from './types.js';

const execAsync = promisify(exec);

/**
 * Execute a git command in a repository
 */
async function execGit(repoPath: string, args: string[]): Promise<string> {
  const command = `git ${args.join(' ')}`;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: repoPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    // Git often writes to stderr for non-error messages
    return stdout || stderr;
  } catch (error) {
    const err = error as Error & { stderr?: string; code?: number };
    throw new GitError(
      err.stderr || err.message,
      'GIT_COMMAND_FAILED',
      command
    );
  }
}

/**
 * Validate that a path is a git repository
 */
export async function validateRepo(repoPath: string): Promise<void> {
  const absolutePath = path.resolve(repoPath);

  // Check if directory exists
  try {
    await access(absolutePath);
  } catch {
    throw new GitError(
      `Repository path does not exist: ${absolutePath}`,
      'REPO_NOT_FOUND'
    );
  }

  // Check if it's a git repository
  try {
    await execGit(absolutePath, ['rev-parse', '--git-dir']);
  } catch {
    throw new GitError(
      `Not a git repository: ${absolutePath}`,
      'NOT_A_REPO'
    );
  }
}

/**
 * git status
 */
export async function gitStatus(repoPath: string): Promise<string> {
  await validateRepo(repoPath);
  return execGit(repoPath, ['status']);
}

/**
 * git diff (unstaged changes)
 */
export async function gitDiffUnstaged(repoPath: string, contextLines: number = 3): Promise<string> {
  await validateRepo(repoPath);
  const result = await execGit(repoPath, ['diff', `-U${contextLines}`]);
  return result || 'No unstaged changes';
}

/**
 * git diff --staged (staged changes)
 */
export async function gitDiffStaged(repoPath: string, contextLines: number = 3): Promise<string> {
  await validateRepo(repoPath);
  const result = await execGit(repoPath, ['diff', '--staged', `-U${contextLines}`]);
  return result || 'No staged changes';
}

/**
 * git diff against a target (branch or commit)
 */
export async function gitDiff(repoPath: string, target: string, contextLines: number = 3): Promise<string> {
  await validateRepo(repoPath);
  const result = await execGit(repoPath, ['diff', `-U${contextLines}`, target]);
  return result || 'No differences';
}

/**
 * git commit
 */
export async function gitCommit(repoPath: string, message: string): Promise<string> {
  await validateRepo(repoPath);

  // Escape message for shell
  const escapedMessage = message.replace(/"/g, '\\"');
  const result = await execGit(repoPath, ['commit', '-m', `"${escapedMessage}"`]);

  return result;
}

/**
 * git add
 */
export async function gitAdd(repoPath: string, files: string[]): Promise<string> {
  await validateRepo(repoPath);

  // Quote file paths to handle spaces
  const quotedFiles = files.map(f => `"${f}"`).join(' ');
  await execGit(repoPath, ['add', '--', quotedFiles]);

  return `Staged ${files.length} file(s): ${files.join(', ')}`;
}

/**
 * git reset (unstage all)
 */
export async function gitReset(repoPath: string): Promise<string> {
  await validateRepo(repoPath);
  await execGit(repoPath, ['reset']);
  return 'Unstaged all changes';
}

/**
 * git log
 */
export async function gitLog(
  repoPath: string,
  maxCount: number = 10,
  startTimestamp?: string,
  endTimestamp?: string
): Promise<CommitLogEntry[]> {
  await validateRepo(repoPath);

  const args = [
    'log',
    `--max-count=${maxCount}`,
    '--format=%H%n%an%n%aI%n%s%n---COMMIT_END---',
  ];

  if (startTimestamp) {
    args.push(`--since="${startTimestamp}"`);
  }
  if (endTimestamp) {
    args.push(`--until="${endTimestamp}"`);
  }

  const result = await execGit(repoPath, args);

  if (!result.trim()) {
    return [];
  }

  const commits = result.split('---COMMIT_END---')
    .filter(block => block.trim())
    .map(block => {
      const lines = block.trim().split('\n');
      return {
        hash: lines[0] || '',
        author: lines[1] || '',
        date: lines[2] || '',
        message: lines[3] || '',
      };
    });

  return commits;
}

/**
 * git branch -b (create new branch)
 */
export async function gitCreateBranch(
  repoPath: string,
  branchName: string,
  baseBranch?: string
): Promise<string> {
  await validateRepo(repoPath);

  const args = ['checkout', '-b', branchName];
  if (baseBranch) {
    args.push(baseBranch);
  }

  await execGit(repoPath, args);
  return `Created and switched to branch '${branchName}'${baseBranch ? ` from '${baseBranch}'` : ''}`;
}

/**
 * git checkout
 */
export async function gitCheckout(repoPath: string, branchName: string): Promise<string> {
  await validateRepo(repoPath);
  await execGit(repoPath, ['checkout', branchName]);
  return `Switched to branch '${branchName}'`;
}

/**
 * git show
 */
export async function gitShow(repoPath: string, revision: string): Promise<string> {
  await validateRepo(repoPath);
  return execGit(repoPath, ['show', revision]);
}

/**
 * git branch (list branches)
 */
export async function gitBranch(
  repoPath: string,
  branchType: 'local' | 'remote' | 'all' = 'local',
  contains?: string,
  notContains?: string
): Promise<string[]> {
  await validateRepo(repoPath);

  const args = ['branch'];

  switch (branchType) {
    case 'remote':
      args.push('-r');
      break;
    case 'all':
      args.push('-a');
      break;
    // 'local' is default, no flag needed
  }

  if (contains) {
    args.push(`--contains=${contains}`);
  }
  if (notContains) {
    args.push(`--no-contains=${notContains}`);
  }

  const result = await execGit(repoPath, args);

  return result
    .split('\n')
    .map(line => line.trim().replace(/^\* /, '')) // Remove current branch marker
    .filter(line => line.length > 0);
}
