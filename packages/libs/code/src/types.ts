/**
 * @ai-stack/code - Type Definitions
 */

import type { AgentInstance, Tool, StreamCallbacks } from '@ai-stack/agent';

// Re-export for convenience
export type { StreamCallbacks };

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Safety configuration for path and content validation
 */
export interface SafetyConfig {
  /** Working directory */
  workingDir?: string;
  /** Glob patterns for allowed paths */
  allowedPaths?: string[];
  /** Glob patterns for blocked paths */
  blockedPaths?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Block files containing secrets */
  blockSecrets?: boolean;
  /** Confirm before destructive operations */
  confirmDestructive?: boolean;
}

/**
 * File history configuration for undo/redo
 */
export interface HistoryConfig {
  /** Enable file history */
  enabled?: boolean;
  /** SQLite database path */
  dbPath?: string;
  /** Maximum number of changes to store */
  maxChanges?: number;
}

/**
 * Task management configuration
 */
export interface TaskConfig {
  /** Enable task management */
  enabled?: boolean;
  /** SQLite database path */
  dbPath?: string;
}

/**
 * MCP configuration
 */
export interface CodeMCPConfig {
  /** Path to MCP configuration file */
  configPath?: string;
  /** Auto-connect to MCP servers on startup */
  autoConnect?: boolean;
}

/**
 * Knowledge configuration for code agent
 */
export interface CodeKnowledgeConfig {
  /** Enable knowledge system (default: false) */
  enabled?: boolean;
  /** SQLite database path (default: .ai-stack/knowledge/sqlite.db) */
  dbPath?: string;
  /** Code indexing configuration */
  code?: {
    /** Enable code indexing */
    enabled?: boolean;
    /** Root directory for indexing */
    rootDir?: string;
    /** Include glob patterns */
    include?: string[];
    /** Exclude glob patterns */
    exclude?: string[];
    /** Watch for file changes */
    watch?: boolean;
    /** Auto-index on startup (default: false) */
    autoIndex?: boolean;
  };
  /** Document indexing configuration */
  doc?: {
    /** Enable document indexing */
    enabled?: boolean;
    /** Document sources */
    sources?: Array<{
      name: string;
      type: 'url' | 'website' | 'sitemap' | 'github' | 'local';
      url: string;
      tags?: string[];
      enabled?: boolean;
    }>;
    /** Auto-index on startup (default: false) */
    autoIndex?: boolean;
  };
  /** Search configuration */
  search?: {
    /** Minimum relevance score */
    minScore?: number;
    /** Maximum results */
    maxResults?: number;
  };
}

/**
 * Code Agent configuration
 */
export interface CodeConfig {
  /** Model to use */
  model?: string;
  /** Temperature for responses */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Maximum iterations for tool calls */
  maxIterations?: number;
  /** API key */
  apiKey?: string;
  /** Base URL for API */
  baseURL?: string;

  /** Safety configuration */
  safety?: SafetyConfig;
  /** File history configuration */
  history?: HistoryConfig;
  /** Task management configuration */
  tasks?: TaskConfig;
  /** MCP configuration */
  mcp?: CodeMCPConfig;
  /** Knowledge configuration */
  knowledge?: CodeKnowledgeConfig;
}

// =============================================================================
// Tool Parameter Types
// =============================================================================

/**
 * Read output format
 */
export type ReadFormat = 'numbered' | 'plain' | 'snippet';

/**
 * Read tool parameters
 */
export interface ReadParams {
  /** Absolute path to the file to read */
  file_path: string;
  /** Line number to start reading from (1-based) */
  offset?: number;
  /** Number of lines to read */
  limit?: number;
  /** Output format (default: 'numbered') */
  format?: ReadFormat;
}

/**
 * Write tool parameters
 */
export interface WriteParams {
  /** Absolute path to the file to write */
  file_path: string;
  /** Content to write to the file */
  content: string;
}

/**
 * Edit mode for smart editing
 */
export type EditMode = 'exact' | 'fuzzy' | 'line' | 'instruction';

/**
 * Edit tool parameters (enhanced with multiple modes)
 */
export interface EditParams {
  /** Absolute path to the file to edit */
  file_path: string;

  // Mode 1: Exact replacement (default)
  /** Text to replace (exact match) */
  old_string?: string;
  /** Replacement text */
  new_string?: string;

  // Mode 2: Line-based replacement
  /** Starting line number (1-indexed) */
  start_line?: number;
  /** Ending line number (inclusive) */
  end_line?: number;
  /** New content to replace the lines */
  new_content?: string;

  // Mode 3: Fuzzy matching
  /** Pattern to search (supports * wildcard) */
  search_pattern?: string;
  /** Replacement for fuzzy match */
  replacement?: string;

  // Mode 4: Instruction-based (natural language)
  /** Natural language edit instruction */
  instruction?: string;

  // Options
  /** Edit mode (auto-detected if not specified) */
  mode?: EditMode;
  /** Replace all occurrences */
  replace_all?: boolean;
  /** Show diff without applying changes */
  preview_only?: boolean;
}

/**
 * Glob tool parameters
 */
export interface GlobParams {
  /** Glob pattern to match files */
  pattern: string;
  /** Directory to search in */
  path?: string;
}

/**
 * Grep output mode
 */
export type GrepOutputMode = 'content' | 'files_with_matches' | 'count';

/**
 * Grep tool parameters
 */
export interface GrepParams {
  /** Regular expression pattern to search for */
  pattern: string;
  /** Directory or file to search in */
  path?: string;
  /** Glob pattern to filter files */
  glob?: string;
  /** Output mode */
  output_mode?: GrepOutputMode;
  /** Number of context lines before/after match */
  context?: number;
  /** Case insensitive search */
  case_insensitive?: boolean;
}

// =============================================================================
// Task Types
// =============================================================================

/**
 * Task status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Task item
 */
export interface TaskItem {
  /** Unique task ID */
  id: string;
  /** Task subject/title */
  subject: string;
  /** Detailed description */
  description: string;
  /** Present continuous form for spinner */
  activeForm?: string;
  /** Current status */
  status: TaskStatus;
  /** Task IDs this task blocks */
  blocks: string[];
  /** Task IDs that block this task */
  blockedBy: string[];
  /** Task owner */
  owner?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Task create parameters
 */
export interface TaskCreateParams {
  /** Task subject/title */
  subject: string;
  /** Detailed description */
  description: string;
  /** Present continuous form for spinner */
  activeForm?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task update parameters
 */
export interface TaskUpdateParams {
  /** Task ID to update */
  taskId: string;
  /** New status */
  status?: TaskStatus | 'deleted';
  /** New subject */
  subject?: string;
  /** New description */
  description?: string;
  /** New active form */
  activeForm?: string;
  /** New owner */
  owner?: string;
  /** Metadata to merge */
  metadata?: Record<string, unknown>;
  /** Task IDs to add to blocks list */
  addBlocks?: string[];
  /** Task IDs to add to blockedBy list */
  addBlockedBy?: string[];
}

// =============================================================================
// File History Types
// =============================================================================

/**
 * File change type
 */
export type FileChangeType = 'create' | 'modify' | 'delete';

/**
 * File change record
 */
export interface FileChange {
  /** Unique change ID */
  id: string;
  /** File path */
  filePath: string;
  /** Change type */
  changeType: FileChangeType;
  /** Content before change (null for create) */
  beforeContent: string | null;
  /** Content after change (null for delete) */
  afterContent: string | null;
  /** Timestamp */
  timestamp: number;
  /** Checkpoint name (if part of a checkpoint) */
  checkpoint?: string;
  /** Whether this change has been undone */
  undone: boolean;
}

/**
 * Undo result
 */
export interface UndoResult {
  /** File path that was restored */
  file_path: string;
  /** What restoration action was taken */
  restored_to: 'previous_version' | 'deleted' | 'created';
  /** The change that was undone */
  change_id: string;
}

/**
 * Redo result
 */
export interface RedoResult {
  /** File path that was modified */
  file_path: string;
  /** What action was redone */
  action: 'create' | 'modify' | 'delete';
  /** The change that was redone */
  change_id: string;
}

// =============================================================================
// Code Agent Instance
// =============================================================================

/**
 * Knowledge search options for Code agent
 */
export interface CodeKnowledgeSearchOptions {
  /** Source types to search */
  sources?: Array<'code' | 'doc'>;
  /** Languages to filter (for code) */
  languages?: string[];
  /** File patterns to filter (for code) */
  filePatterns?: string[];
  /** URL prefixes to filter (for docs) */
  urlPrefixes?: string[];
  /** Result limit */
  limit?: number;
  /** Minimum relevance score */
  minScore?: number;
}

/**
 * Knowledge search result
 */
export interface CodeKnowledgeSearchResult {
  /** Chunk text */
  text: string;
  /** Relevance score */
  score: number;
  /** Source type */
  sourceType: 'code' | 'doc';
  /** Source URI (file path or URL) */
  sourceUri: string;
  /** Code metadata (if code source) */
  code?: {
    language: string;
    filePath: string;
    startLine: number;
    endLine: number;
    symbolName?: string;
  };
  /** Doc metadata (if doc source) */
  doc?: {
    url: string;
    title?: string;
    section?: string;
  };
}

/**
 * Index summary result
 */
export interface CodeIndexSummary {
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  chunksAdded: number;
  chunksRemoved: number;
  totalDurationMs: number;
}

/**
 * Crawl summary result
 */
export interface CodeCrawlSummary {
  sourcesProcessed: number;
  totalPagesProcessed: number;
  totalPagesAdded: number;
  totalChunksAdded: number;
  totalDurationMs: number;
}

/**
 * Knowledge statistics
 */
export interface CodeKnowledgeStats {
  code: {
    enabled: boolean;
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt?: number;
  };
  doc: {
    enabled: boolean;
    totalSources: number;
    totalPages: number;
    totalChunks: number;
    lastCrawledAt?: number;
  };
}

/**
 * Code Agent instance
 */
export interface CodeAgentInstance {
  /** Initialize the code agent */
  initialize(): Promise<void>;
  /** Close the code agent */
  close(): Promise<void>;

  /** Chat with the agent */
  chat(input: string): Promise<string>;
  /** Stream chat with the agent */
  stream(input: string, callbacks?: StreamCallbacks): Promise<string>;

  /** Get the underlying agent */
  getAgent(): AgentInstance;
  /** Get configuration */
  getConfig(): CodeConfig;

  /** Get all registered tools */
  getTools(): Tool[];
  /** Register a custom tool */
  registerTool(tool: Tool): void;

  /** Undo the last file change */
  undo(): Promise<UndoResult | null>;
  /** Redo the last undone change */
  redo(): Promise<RedoResult | null>;
  /** Create a named checkpoint */
  createCheckpoint(name: string): Promise<void>;
  /** Restore to a checkpoint */
  restoreCheckpoint(name: string): Promise<void>;

  // Knowledge methods
  /** Get knowledge manager (null if not enabled) */
  getKnowledge(): unknown | null;
  /** Search knowledge base */
  searchKnowledge(query: string, options?: CodeKnowledgeSearchOptions): Promise<CodeKnowledgeSearchResult[]>;
  /** Index code (manual trigger) */
  indexCode(options?: { force?: boolean }): Promise<CodeIndexSummary | null>;
  /** Add document source */
  addDocSource(source: { name: string; type: string; url: string; tags?: string[]; enabled: boolean }): Promise<void>;
  /** Crawl documents (manual trigger) */
  crawlDocs(options?: { force?: boolean }): Promise<CodeCrawlSummary | null>;
  /** Get knowledge statistics */
  getKnowledgeStats(): Promise<CodeKnowledgeStats | null>;

  /** Start interactive CLI mode */
  startCLI(): Promise<void>;
}

// =============================================================================
// Internal Types
// =============================================================================

/**
 * Option for AskUser tool
 */
export interface AskUserOption {
  label: string;
  value: string;
  description?: string;
}

/**
 * Context passed to tools
 */
export interface ToolContext {
  /** Working directory */
  workingDir: string;
  /** Safety configuration */
  safety: Required<SafetyConfig>;
  /** Record a file change for undo/redo */
  recordChange: (change: Omit<FileChange, 'id' | 'timestamp' | 'undone'>) => Promise<string>;
  /** Check if a file was read in this session */
  wasFileRead: (filePath: string) => boolean;
  /** Mark a file as read */
  markFileRead: (filePath: string) => void;
  /** Confirm callback for destructive operations */
  onConfirm?: (message: string) => Promise<boolean>;
  /** Ask user a question and get response */
  onAskUser?: (question: string, options?: AskUserOption[]) => Promise<string | null>;
}
