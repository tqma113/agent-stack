/**
 * @ai-stack/code - File History Module
 */

export { createFileHistoryStore, type FileHistoryStore, type FileHistoryStoreConfig, type FileHistoryStoreInstance } from './store.js';
export { computeDiff, applyPatch, getDiffSummary, createPatch, wordDiff, lineDiff, type DiffResult } from './diff-engine.js';
export type { FileChange, FileChangeType, UndoResult, RedoResult } from './types.js';
