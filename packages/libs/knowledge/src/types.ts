/**
 * @ai-stack/knowledge - Type Definitions
 *
 * Core types for code and documentation indexing.
 */

import type {
  SemanticChunk,
  SemanticSearchResult,
} from '@ai-stack/memory-store-sqlite';

// Re-export common types
export type UUID = string;
export type Timestamp = number;

// =============================================================================
// Knowledge Source Types
// =============================================================================

/**
 * Knowledge source type
 */
export type KnowledgeSourceType =
  | 'code' // Code files
  | 'doc' // External documentation
  | 'memory'; // Session memory (for compatibility)

/**
 * Knowledge chunk (extends SemanticChunk)
 */
export interface KnowledgeChunk extends SemanticChunk {
  /** Source type */
  sourceType: KnowledgeSourceType;

  /** Source identifier (file path / URL / sessionId) */
  sourceUri: string;

  /** Content type (code: language; doc: mime-type) */
  contentType?: string;

  /** Code-specific metadata */
  code?: CodeMetadata;

  /** Document-specific metadata */
  doc?: DocMetadata;
}

/**
 * Code metadata
 */
export interface CodeMetadata {
  language: string;
  filePath: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  symbolType?: string;
  parentSymbol?: string;
  signature?: string;
}

/**
 * Document metadata
 */
export interface DocMetadata {
  url: string;
  title?: string;
  section?: string;
  fetchedAt: number;
  expiresAt?: number;
}

/**
 * Knowledge search result
 */
export interface KnowledgeSearchResult extends SemanticSearchResult {
  chunk: KnowledgeChunk;
  /** Source type */
  sourceType: KnowledgeSourceType;
  /** Code snippet highlight */
  highlight?: string;
}

/**
 * Search options
 */
export interface KnowledgeSearchOptions {
  /** Source types to search (default: all) */
  sources?: KnowledgeSourceType[];
  /** Filter by code languages */
  languages?: string[];
  /** File path glob patterns */
  filePatterns?: string[];
  /** URL prefix filters */
  urlPrefixes?: string[];
  /** Result limit */
  limit?: number;
  /** Minimum relevance score */
  minScore?: number;
  /** Use vector search */
  useVector?: boolean;
  /** Hybrid search weights */
  weights?: { fts: number; vector: number };
}

// =============================================================================
// Code Index Types
// =============================================================================

/**
 * Code symbol type
 */
export type CodeSymbolType =
  | 'file'
  | 'module'
  | 'namespace'
  | 'class'
  | 'interface'
  | 'function'
  | 'method'
  | 'variable'
  | 'type'
  | 'enum'
  | 'comment'
  | 'import'
  | 'export'
  | 'unknown';

/**
 * Code block
 */
export interface CodeBlock {
  /** Block ID */
  id: string;
  /** File path */
  filePath: string;
  /** Language */
  language: string;
  /** Symbol name */
  symbolName?: string;
  /** Symbol type */
  symbolType: CodeSymbolType;
  /** Parent symbol */
  parentSymbol?: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Code content */
  content: string;
  /** Doc comment */
  docComment?: string;
  /** Signature (function/type signature) */
  signature?: string;
  /** Dependencies (imports) */
  dependencies?: string[];
}

/**
 * Index status for a file
 */
export interface IndexStatus {
  /** File path */
  filePath: string;
  /** Content hash */
  contentHash: string;
  /** Last indexed time */
  indexedAt: Timestamp;
  /** Chunk count */
  chunkCount: number;
  /** Status */
  status: 'indexed' | 'pending' | 'error';
  /** Error message */
  error?: string;
}

/**
 * Index result
 */
export interface IndexResult {
  filePath: string;
  success: boolean;
  chunksAdded: number;
  chunksRemoved: number;
  durationMs: number;
  error?: string;
}

/**
 * Index summary
 */
export interface IndexSummary {
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  chunksAdded: number;
  chunksRemoved: number;
  totalDurationMs: number;
  errors: Array<{ file: string; error: string }>;
}

/**
 * Index status summary
 */
export interface IndexStatusSummary {
  totalFiles: number;
  indexedFiles: number;
  pendingFiles: number;
  errorFiles: number;
  totalChunks: number;
  lastIndexedAt?: Timestamp;
}

/**
 * Code indexer configuration
 */
export interface CodeIndexerConfig {
  /** Root directory */
  rootDir: string;
  /** Include glob patterns */
  include?: string[];
  /** Exclude glob patterns */
  exclude?: string[];
  /** Max file size (bytes) */
  maxFileSize?: number;
  /** Chunk size (tokens) */
  chunkTokens?: number;
  /** Chunk overlap (tokens) */
  overlapTokens?: number;
  /** Enable file watching */
  watch?: boolean;
  /** Watch debounce delay (ms) */
  watchDebounceMs?: number;
  /** Concurrency */
  concurrency?: number;
}

/**
 * Default code indexer configuration
 */
export const DEFAULT_CODE_INDEXER_CONFIG: Required<CodeIndexerConfig> = {
  rootDir: '.',
  include: ['**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,md,json}'],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.map',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  chunkTokens: 400,
  overlapTokens: 80,
  watch: false,
  watchDebounceMs: 1000,
  concurrency: 4,
};

/**
 * Code search options
 */
export interface CodeSearchOptions extends Omit<KnowledgeSearchOptions, 'sources' | 'urlPrefixes'> {
  /** Symbol types to filter */
  symbolTypes?: CodeSymbolType[];
}

// =============================================================================
// Document Index Types
// =============================================================================

/**
 * Document source type
 */
export type DocSourceType =
  | 'url' // Single URL
  | 'website' // Recursive crawl from entry URL
  | 'sitemap' // Sitemap
  | 'github' // GitHub repo docs
  | 'local'; // Local files

/**
 * Document source
 */
export interface DocSource {
  /** Source ID */
  id: UUID;
  /** Name */
  name: string;
  /** Type */
  type: DocSourceType;
  /** URL / path */
  url: string;
  /** Custom tags */
  tags?: string[];
  /** Crawl options */
  crawlOptions?: CrawlOptions;
  /** Enabled */
  enabled: boolean;
  /** Last crawled time */
  lastCrawledAt?: Timestamp;
  /** Refresh interval (ms) */
  refreshInterval?: number;
  /** Created time */
  createdAt: Timestamp;
}

/**
 * Document source input
 */
export type DocSourceInput = Omit<DocSource, 'id' | 'lastCrawledAt' | 'createdAt'>;

/**
 * Crawl options
 */
export interface CrawlOptions {
  /** Max pages */
  maxPages?: number;
  /** Max depth */
  maxDepth?: number;
  /** URL include patterns */
  includePatterns?: string[];
  /** URL exclude patterns */
  excludePatterns?: string[];
  /** Request delay (ms) */
  delayMs?: number;
  /** Timeout (ms) */
  timeoutMs?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Follow redirects */
  followRedirects?: boolean;
  /** CSS selector for content */
  contentSelector?: string;
  /** CSS selectors to exclude */
  excludeSelectors?: string[];
}

/**
 * Document page
 */
export interface DocPage {
  /** Page ID */
  id: UUID;
  /** Source ID */
  sourceId: UUID;
  /** URL */
  url: string;
  /** Title */
  title: string;
  /** Markdown content */
  content: string;
  /** Sections */
  sections?: DocSection[];
  /** Fetch time */
  fetchedAt: Timestamp;
  /** Content hash */
  contentHash: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document section
 */
export interface DocSection {
  /** Section ID (anchor) */
  id: string;
  /** Title */
  title: string;
  /** Level (1-6) */
  level: number;
  /** Content */
  content: string;
  /** Start offset */
  startOffset: number;
  /** End offset */
  endOffset: number;
}

/**
 * Crawl result
 */
export interface CrawlResult {
  sourceId: UUID;
  pagesProcessed: number;
  pagesAdded: number;
  pagesUpdated: number;
  pagesFailed: number;
  chunksAdded: number;
  durationMs: number;
  errors: Array<{ url: string; error: string }>;
}

/**
 * Crawl summary
 */
export interface CrawlSummary {
  sourcesProcessed: number;
  totalPagesProcessed: number;
  totalPagesAdded: number;
  totalPagesUpdated: number;
  totalPagesFailed: number;
  totalChunksAdded: number;
  totalDurationMs: number;
  results: CrawlResult[];
}

/**
 * Document indexer configuration
 */
export interface DocIndexerConfig {
  /** User agent */
  userAgent?: string;
  /** Default crawl options */
  defaultCrawlOptions?: CrawlOptions;
  /** Chunk size (tokens) */
  chunkTokens?: number;
  /** Chunk overlap (tokens) */
  overlapTokens?: number;
  /** Concurrency */
  concurrency?: number;
  /** Cache directory */
  cacheDir?: string;
  /** Cache TTL (ms) */
  cacheTtl?: number;
}

/**
 * Default document indexer configuration
 */
export const DEFAULT_DOC_INDEXER_CONFIG: Required<DocIndexerConfig> = {
  userAgent: 'AI-Stack-Bot/1.0',
  defaultCrawlOptions: {
    maxPages: 100,
    maxDepth: 3,
    delayMs: 500,
    timeoutMs: 30000,
    followRedirects: true,
  },
  chunkTokens: 400,
  overlapTokens: 80,
  concurrency: 2,
  cacheDir: '.ai-stack/doc-cache',
  cacheTtl: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Document search options
 */
export interface DocSearchOptions extends Omit<KnowledgeSearchOptions, 'sources' | 'filePatterns' | 'languages'> {
  /** Source IDs to filter */
  sourceIds?: string[];
}

// =============================================================================
// Knowledge Manager Types
// =============================================================================

/**
 * Knowledge manager configuration
 */
export interface KnowledgeManagerConfig {
  /** Code indexer config */
  code?: CodeIndexerConfig & { enabled?: boolean };

  /** Document indexer config */
  doc?: DocIndexerConfig & { enabled?: boolean };

  /** Search config */
  search?: {
    /** Default weights */
    defaultWeights?: { fts: number; vector: number };
    /** Default result limit */
    defaultLimit?: number;
    /** Temporal decay config */
    temporalDecay?: {
      enabled?: boolean;
      halfLifeDays?: number;
    };
    /** MMR config */
    mmr?: {
      enabled?: boolean;
      lambda?: number;
    };
  };
}

/**
 * Knowledge statistics
 */
export interface KnowledgeStats {
  code: {
    enabled: boolean;
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt?: Timestamp;
  };
  doc: {
    enabled: boolean;
    totalSources: number;
    totalPages: number;
    totalChunks: number;
    lastCrawledAt?: Timestamp;
  };
}
