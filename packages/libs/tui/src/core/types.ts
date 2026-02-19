/**
 * @ai-stack/tui - Core Types
 */

/**
 * Message role
 */
export type Role = 'user' | 'agent' | 'system' | 'tool';

/**
 * Chat message
 */
export interface Message {
  role: Role;
  content: string;
}

/**
 * Tool call status
 */
export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'error';

/**
 * Tool call information
 */
export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  status?: ToolCallStatus;
  result?: string;
  duration?: number;
}

/**
 * CLI header information
 */
export interface HeaderInfo {
  version: string;
  model: string;
  toolCount: number;
  configPath?: string;
}

/**
 * CLI footer information
 */
export interface FooterInfo {
  workDir?: string;
  sessionId?: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Stream state
 */
export type StreamState = 'idle' | 'thinking' | 'streaming' | 'tool';

/**
 * Render options
 */
export interface RenderOptions {
  width?: number;
  padding?: number;
  showTimestamp?: boolean;
}

/**
 * Diff line type
 */
export type DiffLineType = 'add' | 'remove' | 'unchanged';

/**
 * Diff line
 */
export interface DiffLine {
  type: DiffLineType;
  line: string;
  lineNumber: number;
}

/**
 * Diff result
 */
export interface DiffResult {
  hasChanges: boolean;
  additions: number;
  deletions: number;
  unified: string;
  lines: DiffLine[];
}

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Task item
 */
export interface TaskItem {
  id: string;
  subject: string;
  description: string;
  activeForm?: string;
  status: TaskStatus;
  blocks: string[];
  blockedBy: string[];
  owner?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/**
 * File change type
 */
export type FileChangeType = 'create' | 'modify' | 'delete';

/**
 * File change record
 */
export interface FileChange {
  id: string;
  filePath: string;
  changeType: FileChangeType;
  beforeContent: string | null;
  afterContent: string | null;
  timestamp: number;
  checkpoint?: string;
  undone: boolean;
}

/**
 * Confirmation callback type
 */
export type ConfirmCallback = (message: string) => Promise<boolean>;
