/**
 * @ai-stack/knowledge
 *
 * Code and documentation indexing for AI Stack.
 * Provides semantic search over codebases and external documentation.
 */

// Main manager
export { createKnowledgeManager, type KnowledgeManagerInstance } from './manager.js';

// Code indexing
export {
  createCodeIndexer,
  createChunker,
  createWatcher,
  detectLanguage,
  estimateTokens,
  type CodeIndexerInstance,
  type ChunkerInstance,
  type WatcherInstance,
} from './code/index.js';

// Document indexing
export {
  createDocIndexer,
  createCrawler,
  createParser,
  createRegistry,
  type DocIndexerInstance,
  type CrawlerInstance,
  type ParserInstance,
  type RegistryInstance,
} from './doc/index.js';

// Retrieval
export {
  createHybridSearch,
  type HybridSearchInstance,
  type HybridSearchConfig,
} from './retriever/index.js';

// Types
export type {
  // Common
  KnowledgeSourceType,
  KnowledgeChunk,
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeManagerConfig,
  KnowledgeStats,

  // Code
  CodeSymbolType,
  CodeBlock,
  CodeMetadata,
  CodeIndexerConfig,
  CodeSearchOptions,
  IndexStatus,
  IndexResult,
  IndexSummary,
  IndexStatusSummary,

  // Document
  DocSourceType,
  DocSource,
  DocSourceInput,
  DocPage,
  DocSection,
  DocMetadata,
  DocIndexerConfig,
  DocSearchOptions,
  CrawlOptions,
  CrawlResult,
  CrawlSummary,
} from './types.js';

// Errors
export {
  KnowledgeError,
  CodeIndexError,
  CrawlError,
  ParseError,
  SearchError,
  ConfigError,
} from './errors.js';

// Default configurations
export { DEFAULT_CODE_INDEXER_CONFIG, DEFAULT_DOC_INDEXER_CONFIG } from './types.js';
