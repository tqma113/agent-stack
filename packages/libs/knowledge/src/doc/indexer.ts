/**
 * Document Indexer
 *
 * Indexes external documents into semantic chunks for search.
 */

import type {
  SemanticStoreInstance,
  SemanticChunkInput,
  EmbedFunction,
  DatabaseType,
} from '@ai-stack/memory-store-sqlite';

import type {
  DocIndexerConfig,
  DocSource,
  DocSourceInput,
  DocPage,
  CrawlResult,
  CrawlSummary,
  CrawlOptions,
  DocSearchOptions,
  KnowledgeSearchResult,
  UUID,
  IndexAction,
} from '../types.js';
import { DEFAULT_DOC_INDEXER_CONFIG } from '../types.js';
import { CrawlError } from '../errors.js';
import { createCrawler, type CrawlerInstance } from './crawler.js';
import { createRegistry, type RegistryInstance } from './registry.js';
import { createDocRegistryStore, type DocRegistryStoreInstance } from '../stores/doc-registry-store.js';
import { createParser } from './parser.js';

/**
 * Estimate token count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks with overlap
 */
function chunkText(
  text: string,
  maxTokens: number,
  overlapTokens: number
): Array<{ content: string; startOffset: number; endOffset: number }> {
  const chunks: Array<{ content: string; startOffset: number; endOffset: number }> = [];

  if (estimateTokens(text) <= maxTokens) {
    return [{ content: text, startOffset: 0, endOffset: text.length }];
  }

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';
  let currentTokens = 0;
  let startOffset = 0;
  let currentOffset = 0;

  for (const para of paragraphs) {
    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        startOffset,
        endOffset: currentOffset,
      });

      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlapTokens * 4);
      currentChunk = overlapText + '\n\n' + para;
      currentTokens = estimateTokens(currentChunk);
      startOffset = currentOffset - overlapText.length;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
      currentTokens += paraTokens;
    }

    currentOffset += para.length + 2; // +2 for \n\n
  }

  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      startOffset,
      endOffset: text.length,
    });
  }

  return chunks;
}

/**
 * Document indexer instance interface
 */
export interface DocIndexerInstance {
  /** Initialize */
  initialize(): Promise<void>;

  /** Close */
  close(): Promise<void>;

  /** Add a document source */
  addSource(input: DocSourceInput): Promise<DocSource>;

  /** Remove a document source */
  removeSource(sourceId: UUID): Promise<void>;

  /** Update a document source */
  updateSource(sourceId: UUID, update: { name?: string; tags?: string[]; enabled?: boolean }): Promise<DocSource | undefined>;

  /** Get a document source */
  getSource(sourceId: UUID): Promise<DocSource | null>;

  /** List all document sources */
  listSources(): Promise<DocSource[]>;

  /** Crawl a single source */
  crawlSource(sourceId: UUID, options?: { force?: boolean }): Promise<CrawlResult>;

  /** Crawl all enabled sources */
  crawlAll(options?: { force?: boolean }): Promise<CrawlSummary>;

  /** Fetch a single URL (without saving as source) */
  fetchUrl(url: string, options?: CrawlOptions): Promise<DocPage>;

  /** Search documents */
  search(query: string, options?: DocSearchOptions): Promise<KnowledgeSearchResult[]>;

  /** Get a page */
  getPage(pageId: UUID): Promise<DocPage | null>;

  /** Remove a page */
  removePage(pageId: UUID): Promise<void>;

  /** Clear all data */
  clear(): Promise<void>;

  /** Set semantic store */
  setStore(store: SemanticStoreInstance): void;

  /** Set embed function */
  setEmbedFunction(fn: EmbedFunction): void;

  /** Set database for persistent storage */
  setDatabase(db: DatabaseType): void;
}

/**
 * Create a document indexer
 */
export function createDocIndexer(
  config: Partial<DocIndexerConfig> = {}
): DocIndexerInstance {
  const cfg = {
    ...DEFAULT_DOC_INDEXER_CONFIG,
    ...config,
  };

  // Private state
  let store: SemanticStoreInstance | null = null;
  let crawler: CrawlerInstance | null = null;
  let registry: RegistryInstance | null = null;
  let embedFunction: EmbedFunction | undefined;
  let initialized = false;
  let skipIndexing = false;

  // Persistent registry store
  const registryStore = createDocRegistryStore();
  let dbSet = false;

  /**
   * Index a page into semantic chunks
   */
  async function indexPage(page: DocPage): Promise<number> {
    if (!store) {
      throw new CrawlError('Store not set', page.url);
    }

    let chunksAdded = 0;

    // If page has sections, index each section
    if (page.sections && page.sections.length > 0) {
      for (const section of page.sections) {
        const sectionChunks = chunkText(section.content, cfg.chunkTokens, cfg.overlapTokens);

        for (const chunk of sectionChunks) {
          const chunkInput: SemanticChunkInput = {
            text: chunk.content,
            tags: ['doc', page.sourceId],
            sourceType: 'doc',
            metadata: {
              sourceId: page.sourceId,
              pageId: page.id,
              url: page.url,
              title: page.title,
              section: section.title,
              sectionId: section.id,
              fetchedAt: page.fetchedAt,
            },
          };

          // Generate embedding if function available
          if (embedFunction) {
            try {
              chunkInput.embedding = await embedFunction(chunk.content);
            } catch (error) {
              console.warn(`[DocIndexer] Failed to generate embedding:`, error);
            }
          }

          await store.add(chunkInput);
          chunksAdded++;
        }
      }
    } else {
      // Index entire content
      const contentChunks = chunkText(page.content, cfg.chunkTokens, cfg.overlapTokens);

      for (const chunk of contentChunks) {
        const chunkInput: SemanticChunkInput = {
          text: chunk.content,
          tags: ['doc', page.sourceId],
          sourceType: 'doc',
          metadata: {
            sourceId: page.sourceId,
            pageId: page.id,
            url: page.url,
            title: page.title,
            fetchedAt: page.fetchedAt,
          },
        };

        if (embedFunction) {
          try {
            chunkInput.embedding = await embedFunction(chunk.content);
          } catch (error) {
            console.warn(`[DocIndexer] Failed to generate embedding:`, error);
          }
        }

        await store.add(chunkInput);
        chunksAdded++;
      }
    }

    return chunksAdded;
  }

  /**
   * Initialize
   */
  async function initialize(): Promise<void> {
    if (initialized) return;

    // Initialize persistent store if database is set
    if (dbSet) {
      await registryStore.initialize();

      // Check for existing sources and ask user what to do
      if (registryStore.hasIndexedSources()) {
        const summary = registryStore.getSummary();

        let action: IndexAction = cfg.defaultAction ?? 'incremental';

        if (cfg.onExistingIndex) {
          action = await cfg.onExistingIndex({
            type: 'doc',
            summary: {
              totalItems: summary.totalSources,
              totalChunks: summary.totalChunks,
              lastUpdatedAt: summary.lastCrawledAt,
              details: `${summary.totalSources} sources, ${summary.totalPages} pages`,
            },
          });
        }

        if (action === 'reindex_all') {
          // Clear existing registry data
          await registryStore.clear();
        } else if (action === 'skip') {
          // Set flag to skip crawling
          skipIndexing = true;
        }
        // 'incremental' is the default behavior - just continue normally
      }
    }

    // Create parser and crawler
    const parser = createParser();
    crawler = createCrawler({
      userAgent: cfg.userAgent,
      parser,
    });

    // Create in-memory registry as fallback (or use persistent store)
    // The registry interface is used for in-memory operations during crawling
    registry = createRegistry();

    initialized = true;
  }

  /**
   * Close
   */
  async function close(): Promise<void> {
    if (crawler) {
      crawler.stop();
    }
    await registryStore.close();
    initialized = false;
  }

  /**
   * Add a document source
   */
  async function addSource(input: DocSourceInput): Promise<DocSource> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    // Use persistent store if available
    if (dbSet) {
      const source = registryStore.addSource(input);
      // Also add to in-memory registry for consistency during crawl
      registry.addSource({ ...input });
      return source;
    }

    return registry.addSource(input);
  }

  /**
   * Remove a document source
   */
  async function removeSource(sourceId: UUID): Promise<void> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      registryStore.removeSource(sourceId);
    }
    registry.removeSource(sourceId);
  }

  /**
   * Update a document source
   */
  async function updateSource(sourceId: UUID, update: { name?: string; tags?: string[]; enabled?: boolean }): Promise<DocSource | undefined> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      return registryStore.updateSource(sourceId, update);
    }
    return registry.updateSource(sourceId, update);
  }

  /**
   * Get a document source
   */
  async function getSource(sourceId: UUID): Promise<DocSource | null> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      return registryStore.getSource(sourceId) || null;
    }
    return registry.getSource(sourceId) || null;
  }

  /**
   * List all document sources
   */
  async function listSources(): Promise<DocSource[]> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      return registryStore.listSources();
    }
    return registry.listSources();
  }

  /**
   * Crawl a single source
   */
  async function crawlSource(
    sourceId: UUID,
    options?: { force?: boolean }
  ): Promise<CrawlResult> {
    if (!registry || !crawler || !store) {
      throw new CrawlError('Indexer not initialized');
    }

    // Skip crawling if user chose to skip
    if (skipIndexing) {
      return {
        sourceId,
        pagesProcessed: 0,
        pagesAdded: 0,
        pagesUpdated: 0,
        pagesFailed: 0,
        chunksAdded: 0,
        durationMs: 0,
        errors: [],
      };
    }

    // Get source from persistent store or in-memory
    const source = dbSet
      ? registryStore.getSource(sourceId)
      : registry.getSource(sourceId);
    if (!source) {
      throw new CrawlError(`Source not found: ${sourceId}`);
    }

    const startTime = Date.now();
    const result: CrawlResult = {
      sourceId,
      pagesProcessed: 0,
      pagesAdded: 0,
      pagesUpdated: 0,
      pagesFailed: 0,
      chunksAdded: 0,
      durationMs: 0,
      errors: [],
    };

    try {
      // Determine crawl strategy based on source type
      let pages: AsyncGenerator<DocPage>;

      if (source.type === 'sitemap') {
        // Crawl all URLs from sitemap.xml
        pages = crawler.crawlSitemap(source.url, source.crawlOptions);
      } else if (source.type === 'website') {
        // Recursive crawl from entry URL (follows links)
        pages = crawler.crawlRecursive(source.url, source.crawlOptions);
      } else if (source.type === 'url') {
        // Single URL - just fetch it (no recursion)
        const page = await crawler.fetch(source.url, source.crawlOptions);
        page.sourceId = sourceId;

        const existingPage = dbSet
          ? registryStore.getPageByUrl(page.url)
          : registry.getPageByUrl(page.url);

        if (existingPage && existingPage.contentHash === page.contentHash && !options?.force) {
          // No changes
          result.pagesProcessed = 1;
        } else {
          // New or updated
          if (existingPage) {
            if (dbSet) {
              registryStore.updatePage(existingPage.id, page);
            }
            registry.updatePage(existingPage.id, page);
            result.pagesUpdated = 1;
          } else {
            if (dbSet) {
              registryStore.addPage(page);
            }
            registry.addPage(page);
            result.pagesAdded = 1;
          }

          result.chunksAdded = await indexPage(page);
          result.pagesProcessed = 1;
        }

        result.durationMs = Date.now() - startTime;
        return result;
      } else {
        // Other types (github, local) - recursive crawl
        pages = crawler.crawlRecursive(source.url, source.crawlOptions);
      }

      // Process pages from generator
      for await (const page of pages) {
        page.sourceId = sourceId;
        result.pagesProcessed++;

        try {
          const existingPage = dbSet
            ? registryStore.getPageByUrl(page.url)
            : registry.getPageByUrl(page.url);

          if (existingPage && existingPage.contentHash === page.contentHash && !options?.force) {
            // No changes, skip
            continue;
          }

          if (existingPage) {
            if (dbSet) {
              registryStore.updatePage(existingPage.id, page);
            }
            registry.updatePage(existingPage.id, page);
            result.pagesUpdated++;
          } else {
            if (dbSet) {
              registryStore.addPage(page);
            }
            registry.addPage(page);
            result.pagesAdded++;
          }

          result.chunksAdded += await indexPage(page);
        } catch (error) {
          result.pagesFailed++;
          result.errors.push({ url: page.url, error: (error as Error).message });
        }
      }

      // Update source last crawled time
      if (dbSet) {
        registryStore.updateSource(sourceId, { lastCrawledAt: Date.now() });
      }
      registry.updateSource(sourceId, { lastCrawledAt: Date.now() });
    } catch (error) {
      result.errors.push({ url: source.url, error: (error as Error).message });
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  /**
   * Crawl all enabled sources
   */
  async function crawlAll(options?: { force?: boolean }): Promise<CrawlSummary> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    const startTime = Date.now();
    const summary: CrawlSummary = {
      sourcesProcessed: 0,
      totalPagesProcessed: 0,
      totalPagesAdded: 0,
      totalPagesUpdated: 0,
      totalPagesFailed: 0,
      totalChunksAdded: 0,
      totalDurationMs: 0,
      results: [],
    };

    // Skip crawling if user chose to skip
    if (skipIndexing) {
      summary.totalDurationMs = Date.now() - startTime;
      return summary;
    }

    const enabledSources = dbSet
      ? registryStore.getEnabledSources()
      : registry.getEnabledSources();

    for (const source of enabledSources) {
      try {
        const result = await crawlSource(source.id, options);
        summary.results.push(result);
        summary.sourcesProcessed++;
        summary.totalPagesProcessed += result.pagesProcessed;
        summary.totalPagesAdded += result.pagesAdded;
        summary.totalPagesUpdated += result.pagesUpdated;
        summary.totalPagesFailed += result.pagesFailed;
        summary.totalChunksAdded += result.chunksAdded;
      } catch (error) {
        console.error(`[DocIndexer] Failed to crawl source ${source.id}:`, error);
      }
    }

    summary.totalDurationMs = Date.now() - startTime;
    return summary;
  }

  /**
   * Fetch a single URL (without saving as source)
   */
  async function fetchUrl(url: string, options?: CrawlOptions): Promise<DocPage> {
    if (!crawler) {
      throw new CrawlError('Indexer not initialized');
    }

    return crawler.fetch(url, options);
  }

  /**
   * Search documents
   */
  async function search(
    query: string,
    options?: DocSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    if (!store) {
      throw new CrawlError('Store not set');
    }

    // Build tags filter
    const tags: string[] = ['doc'];
    if (options?.sourceIds) {
      tags.push(...options.sourceIds);
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
        sourceType: 'doc' as const,
        sourceUri: (result.chunk.metadata as Record<string, unknown>)?.url as string || '',
        doc: {
          url: (result.chunk.metadata as Record<string, unknown>)?.url as string || '',
          title: (result.chunk.metadata as Record<string, unknown>)?.title as string | undefined,
          section: (result.chunk.metadata as Record<string, unknown>)?.section as string | undefined,
          fetchedAt: (result.chunk.metadata as Record<string, unknown>)?.fetchedAt as number || 0,
        },
      },
      sourceType: 'doc' as const,
    }));
  }

  /**
   * Get a page
   */
  async function getPage(pageId: UUID): Promise<DocPage | null> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      return registryStore.getPage(pageId) || null;
    }
    return registry.getPage(pageId) || null;
  }

  /**
   * Remove a page
   */
  async function removePage(pageId: UUID): Promise<void> {
    if (!registry) {
      throw new CrawlError('Indexer not initialized');
    }

    if (dbSet) {
      registryStore.removePage(pageId);
    }
    registry.removePage(pageId);
  }

  /**
   * Clear all data
   */
  async function clear(): Promise<void> {
    if (dbSet) {
      await registryStore.clear();
    }
    if (registry) {
      registry.clear();
    }
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

  /**
   * Set database for persistent storage
   */
  function setDatabase(db: DatabaseType): void {
    registryStore.setDatabase(db);
    dbSet = true;
  }

  return {
    initialize,
    close,
    addSource,
    removeSource,
    updateSource,
    getSource,
    listSources,
    crawlSource,
    crawlAll,
    fetchUrl,
    search,
    getPage,
    removePage,
    clear,
    setStore,
    setEmbedFunction,
    setDatabase,
  };
}
