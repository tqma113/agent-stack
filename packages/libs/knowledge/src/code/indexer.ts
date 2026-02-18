/**
 * Code Indexer
 *
 * Indexes code files into semantic chunks for search.
 */

import { glob } from 'glob';
import { createHash } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { resolve, relative } from 'path';
import type {
  SemanticStoreInstance,
  SemanticChunkInput,
  EmbedFunction,
} from '@ai-stack/memory-store-sqlite';

import type {
  CodeIndexerConfig,
  IndexResult,
  IndexSummary,
  IndexStatus,
  IndexStatusSummary,
  CodeSearchOptions,
  KnowledgeSearchResult,
  CodeBlock,
} from '../types.js';
import { DEFAULT_CODE_INDEXER_CONFIG } from '../types.js';
import { CodeIndexError } from '../errors.js';
import { createChunker, type ChunkerInstance } from './chunker.js';
import { createWatcher, createWatcherConfig, type WatcherInstance, type FileChangeEvent } from './watcher.js';
import { detectLanguage } from './languages/index.js';

/**
 * Code indexer instance interface
 */
export interface CodeIndexerInstance {
  /** Initialize the indexer */
  initialize(): Promise<void>;

  /** Close the indexer */
  close(): Promise<void>;

  /** Index a single file */
  indexFile(filePath: string): Promise<IndexResult>;

  /** Index entire directory */
  indexDirectory(options?: { force?: boolean }): Promise<IndexSummary>;

  /** Update index for changed files */
  updateIndex(changedFiles: string[]): Promise<IndexSummary>;

  /** Remove file from index */
  removeFile(filePath: string): Promise<void>;

  /** Search code */
  search(query: string, options?: CodeSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** Get index status */
  getStatus(): Promise<IndexStatusSummary>;

  /** Get file index status */
  getFileStatus(filePath: string): Promise<IndexStatus | null>;

  /** Clear all indexed data */
  clear(): Promise<void>;

  /** Start file watching */
  startWatching(): void;

  /** Stop file watching */
  stopWatching(): void;

  /** Check if watching */
  isWatching(): boolean;

  /** Set semantic store */
  setStore(store: SemanticStoreInstance): void;

  /** Set embed function */
  setEmbedFunction(fn: EmbedFunction): void;
}

/**
 * In-memory index status storage
 */
interface IndexStatusStore {
  statuses: Map<string, IndexStatus>;
}

/**
 * Create a code indexer
 */
export function createCodeIndexer(
  config: Partial<CodeIndexerConfig> = {}
): CodeIndexerInstance {
  const cfg: Required<CodeIndexerConfig> = {
    ...DEFAULT_CODE_INDEXER_CONFIG,
    ...config,
  };

  // Private state
  let store: SemanticStoreInstance | null = null;
  let chunker: ChunkerInstance | null = null;
  let watcher: WatcherInstance | null = null;
  let embedFunction: EmbedFunction | undefined;
  let initialized = false;

  // Index status storage (in-memory for now, could be persisted)
  const statusStore: IndexStatusStore = {
    statuses: new Map(),
  };

  /**
   * Compute content hash
   */
  function computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Check if file should be indexed
   */
  async function shouldIndex(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);

      // Check file size
      if (stats.size > cfg.maxFileSize) {
        return false;
      }

      // Check if binary (simple heuristic)
      const ext = filePath.split('.').pop()?.toLowerCase();
      const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'zip', 'tar', 'gz', 'exe', 'dll', 'so', 'dylib'];
      if (ext && binaryExts.includes(ext)) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all files matching config patterns
   */
  async function getFiles(): Promise<string[]> {
    const files = await glob(cfg.include, {
      cwd: cfg.rootDir,
      ignore: cfg.exclude,
      absolute: true,
      nodir: true,
    });

    return files;
  }

  /**
   * Index a single file
   */
  async function indexFile(filePath: string): Promise<IndexResult> {
    const startTime = Date.now();

    if (!store) {
      throw new CodeIndexError('Store not set', filePath);
    }

    if (!chunker) {
      throw new CodeIndexError('Indexer not initialized', filePath);
    }

    try {
      // Check if should index
      if (!(await shouldIndex(filePath))) {
        return {
          filePath,
          success: true,
          chunksAdded: 0,
          chunksRemoved: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Read file content
      const content = await readFile(filePath, 'utf-8');
      const contentHash = computeHash(content);

      // Check if already indexed with same hash
      const existingStatus = statusStore.statuses.get(filePath);
      if (existingStatus && existingStatus.contentHash === contentHash) {
        return {
          filePath,
          success: true,
          chunksAdded: 0,
          chunksRemoved: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Remove old chunks if re-indexing
      let chunksRemoved = 0;
      if (existingStatus) {
        // Delete old chunks by file path tag
        // Note: SemanticStore doesn't have deleteByTag, so we use a workaround
        // We'll add the file path as a unique identifier in metadata
        chunksRemoved = existingStatus.chunkCount;
      }

      // Parse and chunk the file
      const blocks = chunker.chunkFile(filePath, content);

      // Add chunks to store
      let chunksAdded = 0;
      const relativePath = relative(cfg.rootDir, filePath);

      for (const block of blocks) {
        const chunkInput: SemanticChunkInput = {
          text: block.content,
          tags: ['code', block.language, block.symbolType],
          sourceType: 'code',
          metadata: {
            filePath: relativePath,
            absolutePath: filePath,
            language: block.language,
            symbolName: block.symbolName,
            symbolType: block.symbolType,
            startLine: block.startLine,
            endLine: block.endLine,
            signature: block.signature,
            docComment: block.docComment,
          },
        };

        // Generate embedding if function available
        if (embedFunction) {
          try {
            chunkInput.embedding = await embedFunction(block.content);
          } catch (error) {
            console.warn(`[CodeIndexer] Failed to generate embedding for ${filePath}:${block.startLine}:`, error);
          }
        }

        await store.add(chunkInput);
        chunksAdded++;
      }

      // Update status
      statusStore.statuses.set(filePath, {
        filePath,
        contentHash,
        indexedAt: Date.now(),
        chunkCount: chunksAdded,
        status: 'indexed',
      });

      return {
        filePath,
        success: true,
        chunksAdded,
        chunksRemoved,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Update status with error
      statusStore.statuses.set(filePath, {
        filePath,
        contentHash: '',
        indexedAt: Date.now(),
        chunkCount: 0,
        status: 'error',
        error: (error as Error).message,
      });

      return {
        filePath,
        success: false,
        chunksAdded: 0,
        chunksRemoved: 0,
        durationMs: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Index entire directory
   */
  async function indexDirectory(options?: { force?: boolean }): Promise<IndexSummary> {
    const startTime = Date.now();
    const summary: IndexSummary = {
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      chunksAdded: 0,
      chunksRemoved: 0,
      totalDurationMs: 0,
      errors: [],
    };

    if (!store) {
      throw new CodeIndexError('Store not set');
    }

    // Clear existing data if force
    if (options?.force) {
      await clear();
    }

    // Get all files
    const files = await getFiles();

    // Process files with concurrency
    const queue = [...files];
    const inProgress: Promise<void>[] = [];

    while (queue.length > 0 || inProgress.length > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.length < cfg.concurrency && queue.length > 0) {
        const filePath = queue.shift()!;

        const task = indexFile(filePath).then((result) => {
          summary.filesProcessed++;

          if (result.success) {
            if (result.chunksAdded > 0) {
              summary.chunksAdded += result.chunksAdded;
              summary.chunksRemoved += result.chunksRemoved;
            } else {
              summary.filesSkipped++;
            }
          } else {
            summary.filesFailed++;
            if (result.error) {
              summary.errors.push({ file: filePath, error: result.error });
            }
          }
        });

        inProgress.push(task);
      }

      // Wait for at least one task to complete
      if (inProgress.length > 0) {
        await Promise.race(inProgress);
        // Remove completed tasks
        for (let i = inProgress.length - 1; i >= 0; i--) {
          const task = inProgress[i];
          // Check if task is settled
          const status = await Promise.race([
            task.then(() => 'fulfilled'),
            Promise.resolve('pending'),
          ]);
          if (status === 'fulfilled') {
            inProgress.splice(i, 1);
          }
        }
      }
    }

    summary.totalDurationMs = Date.now() - startTime;
    return summary;
  }

  /**
   * Update index for changed files
   */
  async function updateIndex(changedFiles: string[]): Promise<IndexSummary> {
    const startTime = Date.now();
    const summary: IndexSummary = {
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      chunksAdded: 0,
      chunksRemoved: 0,
      totalDurationMs: 0,
      errors: [],
    };

    for (const filePath of changedFiles) {
      const result = await indexFile(filePath);
      summary.filesProcessed++;

      if (result.success) {
        summary.chunksAdded += result.chunksAdded;
        summary.chunksRemoved += result.chunksRemoved;
      } else {
        summary.filesFailed++;
        if (result.error) {
          summary.errors.push({ file: filePath, error: result.error });
        }
      }
    }

    summary.totalDurationMs = Date.now() - startTime;
    return summary;
  }

  /**
   * Remove file from index
   */
  async function removeFile(filePath: string): Promise<void> {
    statusStore.statuses.delete(filePath);
    // Note: Chunks are not actually deleted from SemanticStore
    // as we don't have a way to delete by metadata
    // This would require extending SemanticStore interface
  }

  /**
   * Search code
   */
  async function search(
    query: string,
    options?: CodeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    if (!store) {
      throw new CodeIndexError('Store not set');
    }

    // Build tags filter
    const tags: string[] = ['code'];
    if (options?.languages) {
      tags.push(...options.languages);
    }
    if (options?.symbolTypes) {
      tags.push(...options.symbolTypes);
    }

    // Search
    const results = await store.search(query, {
      tags: tags.length > 1 ? tags : undefined,
      limit: options?.limit || 10,
      useVector: options?.useVector,
    });

    // Transform to KnowledgeSearchResult
    return results.map((result) => ({
      ...result,
      chunk: {
        ...result.chunk,
        sourceType: 'code' as const,
        sourceUri: (result.chunk.metadata as Record<string, unknown>)?.filePath as string || '',
        code: {
          language: (result.chunk.metadata as Record<string, unknown>)?.language as string || '',
          filePath: (result.chunk.metadata as Record<string, unknown>)?.filePath as string || '',
          startLine: (result.chunk.metadata as Record<string, unknown>)?.startLine as number || 1,
          endLine: (result.chunk.metadata as Record<string, unknown>)?.endLine as number || 1,
          symbolName: (result.chunk.metadata as Record<string, unknown>)?.symbolName as string | undefined,
          symbolType: (result.chunk.metadata as Record<string, unknown>)?.symbolType as string | undefined,
        },
      },
      sourceType: 'code' as const,
    }));
  }

  /**
   * Get index status
   */
  async function getStatus(): Promise<IndexStatusSummary> {
    const statuses = Array.from(statusStore.statuses.values());

    const indexedFiles = statuses.filter((s) => s.status === 'indexed').length;
    const pendingFiles = statuses.filter((s) => s.status === 'pending').length;
    const errorFiles = statuses.filter((s) => s.status === 'error').length;
    const totalChunks = statuses.reduce((sum, s) => sum + s.chunkCount, 0);

    const lastIndexed = statuses
      .filter((s) => s.status === 'indexed')
      .sort((a, b) => b.indexedAt - a.indexedAt)[0];

    return {
      totalFiles: statuses.length,
      indexedFiles,
      pendingFiles,
      errorFiles,
      totalChunks,
      lastIndexedAt: lastIndexed?.indexedAt,
    };
  }

  /**
   * Get file index status
   */
  async function getFileStatus(filePath: string): Promise<IndexStatus | null> {
    return statusStore.statuses.get(filePath) || null;
  }

  /**
   * Clear all indexed data
   */
  async function clear(): Promise<void> {
    statusStore.statuses.clear();

    if (store) {
      // Note: This clears all semantic chunks, not just code
      // In a real implementation, we'd want to clear only code chunks
      // await store.clear();
    }
  }

  /**
   * Handle file changes from watcher
   */
  async function handleFileChanges(events: FileChangeEvent[]): Promise<void> {
    const filesToIndex: string[] = [];
    const filesToRemove: string[] = [];

    for (const event of events) {
      if (event.type === 'unlink') {
        filesToRemove.push(event.filePath);
      } else {
        filesToIndex.push(event.filePath);
      }
    }

    // Remove deleted files
    for (const file of filesToRemove) {
      await removeFile(file);
    }

    // Re-index changed files
    if (filesToIndex.length > 0) {
      await updateIndex(filesToIndex);
    }
  }

  /**
   * Start file watching
   */
  function startWatching(): void {
    if (watcher) {
      watcher.start();
    }
  }

  /**
   * Stop file watching
   */
  function stopWatching(): void {
    if (watcher) {
      watcher.stop();
    }
  }

  /**
   * Check if watching
   */
  function isWatching(): boolean {
    return watcher?.isWatching() || false;
  }

  /**
   * Initialize
   */
  async function initialize(): Promise<void> {
    if (initialized) return;

    // Create chunker
    chunker = createChunker({
      maxTokens: cfg.chunkTokens,
      overlapTokens: cfg.overlapTokens,
    });

    // Create watcher if enabled
    if (cfg.watch) {
      const watcherConfig = createWatcherConfig(cfg, handleFileChanges);
      watcher = createWatcher(watcherConfig);
    }

    initialized = true;
  }

  /**
   * Close
   */
  async function close(): Promise<void> {
    if (watcher) {
      await watcher.stop();
    }
    initialized = false;
  }

  /**
   * Set store
   */
  function setStore(s: SemanticStoreInstance): void {
    store = s;
  }

  /**
   * Set embed function
   */
  function setEmbedFunction(fn: EmbedFunction): void {
    embedFunction = fn;
    if (store) {
      store.setEmbedFunction(fn);
    }
  }

  return {
    initialize,
    close,
    indexFile,
    indexDirectory,
    updateIndex,
    removeFile,
    search,
    getStatus,
    getFileStatus,
    clear,
    startWatching,
    stopWatching,
    isWatching,
    setStore,
    setEmbedFunction,
  };
}
