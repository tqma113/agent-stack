/**
 * Code Index Module
 *
 * Exports code indexing functionality.
 */

export { createCodeIndexer, type CodeIndexerInstance } from './indexer.js';
export { createChunker, type ChunkerInstance, type ChunkerConfig, estimateTokens } from './chunker.js';
export {
  createWatcher,
  createWatcherConfig,
  type WatcherInstance,
  type WatcherConfig,
  type FileChangeEvent,
  type WatcherCallback,
} from './watcher.js';
export {
  registerParser,
  getParser,
  getParserForFile,
  detectLanguage,
  getSupportedExtensions,
  generateBlockId,
  type LanguageParser,
} from './languages/index.js';
