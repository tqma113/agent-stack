/**
 * Types for @agent-stack-mcp/git
 */

import { z } from 'zod';

/**
 * Common repo_path parameter
 */
const repoPathSchema = z.string().describe('Path to Git repository');

/**
 * git_status input schema
 */
export const GitStatusInputSchema = z.object({
  repo_path: repoPathSchema,
});
export type GitStatusInput = z.infer<typeof GitStatusInputSchema>;

/**
 * git_diff_unstaged input schema
 */
export const GitDiffUnstagedInputSchema = z.object({
  repo_path: repoPathSchema,
  context_lines: z.number().int().min(0).optional().default(3).describe('Number of context lines (default: 3)'),
});
export type GitDiffUnstagedInput = z.infer<typeof GitDiffUnstagedInputSchema>;

/**
 * git_diff_staged input schema
 */
export const GitDiffStagedInputSchema = z.object({
  repo_path: repoPathSchema,
  context_lines: z.number().int().min(0).optional().default(3).describe('Number of context lines (default: 3)'),
});
export type GitDiffStagedInput = z.infer<typeof GitDiffStagedInputSchema>;

/**
 * git_diff input schema
 */
export const GitDiffInputSchema = z.object({
  repo_path: repoPathSchema,
  target: z.string().describe('Target branch or commit to compare with'),
  context_lines: z.number().int().min(0).optional().default(3).describe('Number of context lines (default: 3)'),
});
export type GitDiffInput = z.infer<typeof GitDiffInputSchema>;

/**
 * git_commit input schema
 */
export const GitCommitInputSchema = z.object({
  repo_path: repoPathSchema,
  message: z.string().min(1).describe('Commit message'),
});
export type GitCommitInput = z.infer<typeof GitCommitInputSchema>;

/**
 * git_add input schema
 */
export const GitAddInputSchema = z.object({
  repo_path: repoPathSchema,
  files: z.array(z.string()).min(1).describe('Array of file paths to stage'),
});
export type GitAddInput = z.infer<typeof GitAddInputSchema>;

/**
 * git_reset input schema
 */
export const GitResetInputSchema = z.object({
  repo_path: repoPathSchema,
});
export type GitResetInput = z.infer<typeof GitResetInputSchema>;

/**
 * git_log input schema
 */
export const GitLogInputSchema = z.object({
  repo_path: repoPathSchema,
  max_count: z.number().int().min(1).optional().default(10).describe('Maximum number of commits to show (default: 10)'),
  start_timestamp: z.string().optional().describe('Start timestamp (ISO 8601, relative dates, or absolute dates)'),
  end_timestamp: z.string().optional().describe('End timestamp (ISO 8601, relative dates, or absolute dates)'),
});
export type GitLogInput = z.infer<typeof GitLogInputSchema>;

/**
 * git_create_branch input schema
 */
export const GitCreateBranchInputSchema = z.object({
  repo_path: repoPathSchema,
  branch_name: z.string().min(1).describe('Name of the new branch'),
  base_branch: z.string().optional().describe('Base branch to create from (defaults to current branch)'),
});
export type GitCreateBranchInput = z.infer<typeof GitCreateBranchInputSchema>;

/**
 * git_checkout input schema
 */
export const GitCheckoutInputSchema = z.object({
  repo_path: repoPathSchema,
  branch_name: z.string().min(1).describe('Name of branch to checkout'),
});
export type GitCheckoutInput = z.infer<typeof GitCheckoutInputSchema>;

/**
 * git_show input schema
 */
export const GitShowInputSchema = z.object({
  repo_path: repoPathSchema,
  revision: z.string().describe('The revision (commit hash, branch name, tag) to show'),
});
export type GitShowInput = z.infer<typeof GitShowInputSchema>;

/**
 * Branch type enum
 */
export const BranchTypeSchema = z.enum(['local', 'remote', 'all']);
export type BranchType = z.infer<typeof BranchTypeSchema>;

/**
 * git_branch input schema
 */
export const GitBranchInputSchema = z.object({
  repo_path: repoPathSchema,
  branch_type: BranchTypeSchema.default('local').describe("Branch type: 'local', 'remote', or 'all'"),
  contains: z.string().optional().describe('Filter branches containing this commit'),
  not_contains: z.string().optional().describe('Filter branches NOT containing this commit'),
});
export type GitBranchInput = z.infer<typeof GitBranchInputSchema>;

/**
 * Commit log entry
 */
export interface CommitLogEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  defaultRepository?: string;
}

/**
 * Git error
 */
export class GitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly command?: string
  ) {
    super(message);
    this.name = 'GitError';
  }
}
