/**
 * @ai-stack/assistant - Memory Module
 */

export { createMarkdownMemory, type MarkdownMemoryInstance } from './markdown-memory.js';
export { createSqliteIndex, type SqliteIndexInstance, type StoredFileMetadata } from './sqlite-index.js';
export { createSyncEngine, type SyncEngineInstance, type SyncEngineConfig } from './sync-engine.js';
export { hashText, hashFile, getFileMetadata, hasFileChanged, getFilesMetadata, type FileMetadata } from './hash-utils.js';
export {
  parseMemoryFile,
  parseDailyLogFile,
  loadDailyLogs,
  getTodayDateString,
  getTodayLogPath,
} from './markdown-parser.js';
export {
  writeMemoryFile,
  serializeMemoryDocument,
  addFact,
  removeFact,
  addTodo,
  updateTodo,
  removeTodo,
  updateProfile,
  appendNotes,
  writeDailyLogEntry,
} from './markdown-writer.js';
export { mergeHybridResults, mergeWithRRF } from './hybrid-merge.js';
export type {
  MemoryDocument,
  ProfileSection,
  FactItem,
  TodoItem,
  DailyLogEntry,
  DailyLog,
  MarkdownMemoryConfig,
  SyncStatus,
  MemorySearchResult,
  MemoryQueryOptions,
  SearchMode,
  HybridSearchOptions,
} from './types.js';
