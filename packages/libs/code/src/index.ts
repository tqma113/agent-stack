/**
 * @ai-stack/code
 *
 * AI Code Agent with file operations, search, git integration, and undo/redo capabilities.
 *
 * Features:
 * - File operations: Read, Write, Edit (search & replace)
 * - Search: Glob (file patterns), Grep (content search)
 * - Undo/Redo: Track file changes with SQLite history
 * - Task management: Create, update, list, track tasks
 * - Safety: Path sandboxing, secret detection, blocked paths
 *
 * @packageDocumentation
 */

// Code Agent
export { createCodeAgent } from './code-agent/index.js';
export type { CodeAgentInstance } from './types.js';

// Configuration
export {
  loadConfig,
  getDefaultConfig,
  resolveConfig,
  generateConfigTemplate,
  serializeConfig,
  findConfigFile,
  DEFAULT_BASE_DIR,
  type LoadConfigResult,
} from './config.js';

export { validateConfig, safeValidateConfig, CodeConfigSchema } from './config-schema.js';

// Types
export type {
  CodeConfig,
  SafetyConfig,
  HistoryConfig,
  TaskConfig,
  CodeMCPConfig,
  ReadParams,
  WriteParams,
  EditParams,
  GlobParams,
  GrepParams,
  GrepOutputMode,
  TaskItem,
  TaskStatus,
  TaskCreateParams,
  TaskUpdateParams,
  FileChange,
  FileChangeType,
  UndoResult,
  RedoResult,
  ToolContext,
} from './types.js';

// Errors
export {
  CodeError,
  ConfigError,
  PathError,
  FileNotFoundError,
  FileTooLargeError,
  ContentError,
  EditError,
  FileNotReadError,
  HistoryError,
  TaskError,
  OperationDeniedError,
} from './errors.js';

// Safety
export {
  createPathValidator,
  createContentValidator,
  type PathValidator,
  type ContentValidator,
  type PathValidationResult,
  type SecretDetectionResult,
} from './safety/index.js';

// File History
export {
  createFileHistoryStore,
  computeDiff,
  applyPatch,
  getDiffSummary,
  wordDiff,
  lineDiff,
  type FileHistoryStore,
  type FileHistoryStoreConfig,
  type FileHistoryStoreInstance,
  type DiffResult,
} from './file-history/index.js';

// Task Store
export {
  createTaskStore,
  type TaskStore,
  type TaskStoreConfig,
  type TaskStoreInstance,
} from './task/index.js';

// Tools (for advanced usage)
export {
  createReadTool,
  createWriteTool,
  createEditTool,
  createGlobTool,
  createGrepTool,
  createUndoTool,
  createRedoTool,
  createTaskTools,
  createTaskCreateTool,
  createTaskUpdateTool,
  createTaskListTool,
  createTaskGetTool,
} from './tools/index.js';

// Re-export useful types from dependencies
export type { Tool, AgentInstance, AgentConfig } from '@ai-stack/agent';
