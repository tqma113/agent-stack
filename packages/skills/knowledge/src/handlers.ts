/**
 * @ai-stack-skill/knowledge - Handler Implementations
 *
 * Implements the search, index, and document management handlers for the knowledge skill.
 */

import { getKnowledgeContext } from './store-context.js';
import type {
  KnowledgeSearchResult,
  IndexSummary,
  CrawlSummary,
  DocSource,
  KnowledgeStats,
  CodeSymbolType,
} from '@ai-stack/knowledge';

/**
 * Format code search results for display
 */
function formatCodeResults(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) {
    return 'No code matches found.';
  }

  const formatted = results.map((result, i) => {
    const meta = result.chunk.code;
    const header = meta
      ? `[${i + 1}] ${meta.filePath}:${meta.startLine}-${meta.endLine} (${meta.language})`
      : `[${i + 1}] Code snippet`;

    let symbolInfo = '';
    if (meta?.symbolName) {
      symbolInfo = `\nSymbol: ${meta.symbolName} (${meta.symbolType})`;
    }

    return `${header}${symbolInfo}\nScore: ${result.score.toFixed(3)}\n\`\`\`\n${result.chunk.text.trim()}\n\`\`\``;
  });

  return formatted.join('\n\n');
}

/**
 * Format doc search results for display
 */
function formatDocResults(results: KnowledgeSearchResult[]): string {
  if (results.length === 0) {
    return 'No documentation matches found.';
  }

  const formatted = results.map((result, i) => {
    const meta = result.chunk.doc;
    const header = meta
      ? `[${i + 1}] ${meta.title || 'Untitled'}`
      : `[${i + 1}] Documentation`;

    let urlInfo = '';
    if (meta?.url) {
      urlInfo = `\nURL: ${meta.url}`;
    }

    let sectionInfo = '';
    if (meta?.section) {
      sectionInfo = `\nSection: ${meta.section}`;
    }

    return `${header}${urlInfo}${sectionInfo}\nScore: ${result.score.toFixed(3)}\n\n${result.chunk.text.trim()}`;
  });

  return formatted.join('\n\n---\n\n');
}

/**
 * Search code
 */
export async function searchCode(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  if (!query) {
    return JSON.stringify({ error: 'Query is required' });
  }

  const ctx = await getKnowledgeContext();

  try {
    const results = await ctx.manager.searchCode(query, {
      languages: args.languages as string[] | undefined,
      filePatterns: args.filePatterns as string[] | undefined,
      symbolTypes: args.symbolTypes as CodeSymbolType[] | undefined,
      limit: (args.limit as number) || 10,
    });

    return JSON.stringify({
      query,
      count: results.length,
      results: results.map((r) => ({
        score: r.score,
        filePath: r.chunk.code?.filePath,
        startLine: r.chunk.code?.startLine,
        endLine: r.chunk.code?.endLine,
        language: r.chunk.code?.language,
        symbolName: r.chunk.code?.symbolName,
        symbolType: r.chunk.code?.symbolType,
        content: r.chunk.text,
      })),
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: (error as Error).message,
      query,
    });
  }
}

/**
 * Search documentation
 */
export async function searchDocs(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string;
  if (!query) {
    return JSON.stringify({ error: 'Query is required' });
  }

  const ctx = await getKnowledgeContext();

  try {
    const results = await ctx.manager.searchDocs(query, {
      sourceIds: args.sourceIds as string[] | undefined,
      limit: (args.limit as number) || 10,
    });

    return JSON.stringify({
      query,
      count: results.length,
      results: results.map((r) => ({
        score: r.score,
        url: r.chunk.doc?.url,
        title: r.chunk.doc?.title,
        section: r.chunk.doc?.section,
        content: r.chunk.text,
      })),
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: (error as Error).message,
      query,
    });
  }
}

/**
 * Index code
 */
export async function indexCode(args: Record<string, unknown>): Promise<string> {
  const ctx = await getKnowledgeContext();

  try {
    const summary = await ctx.manager.indexCode({
      force: args.force as boolean | undefined,
    });

    return JSON.stringify({
      success: true,
      summary: {
        filesProcessed: summary.filesProcessed,
        filesSkipped: summary.filesSkipped,
        filesFailed: summary.filesFailed,
        chunksAdded: summary.chunksAdded,
        chunksRemoved: summary.chunksRemoved,
        durationMs: summary.totalDurationMs,
        errors: summary.errors.slice(0, 5), // Limit errors shown
      },
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * Add a documentation source
 */
export async function addDocSource(args: Record<string, unknown>): Promise<string> {
  const name = args.name as string;
  const url = args.url as string;

  if (!name || !url) {
    return JSON.stringify({ error: 'Name and URL are required' });
  }

  const ctx = await getKnowledgeContext();

  try {
    const source = await ctx.manager.addDocSource({
      name,
      url,
      type: (args.type as 'url' | 'sitemap' | 'github' | 'local') || 'url',
      tags: args.tags as string[] | undefined,
      enabled: true,
    });

    return JSON.stringify({
      success: true,
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        type: source.type,
        tags: source.tags,
      },
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * Remove a documentation source
 */
export async function removeDocSource(args: Record<string, unknown>): Promise<string> {
  const sourceId = args.sourceId as string;

  if (!sourceId) {
    return JSON.stringify({ error: 'Source ID is required' });
  }

  const ctx = await getKnowledgeContext();

  try {
    await ctx.manager.removeDocSource(sourceId);

    return JSON.stringify({
      success: true,
      removedSourceId: sourceId,
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * Update a documentation source (rename, change tags, enable/disable)
 */
export async function updateDocSource(args: Record<string, unknown>): Promise<string> {
  const sourceId = args.sourceId as string;

  if (!sourceId) {
    return JSON.stringify({ error: 'Source ID is required' });
  }

  const ctx = await getKnowledgeContext();

  try {
    const update: { name?: string; tags?: string[]; enabled?: boolean } = {};
    if (args.name !== undefined) update.name = args.name as string;
    if (args.tags !== undefined) update.tags = args.tags as string[];
    if (args.enabled !== undefined) update.enabled = args.enabled as boolean;

    const source = await ctx.manager.updateDocSource(sourceId, update);

    if (!source) {
      return JSON.stringify({
        success: false,
        error: 'Source not found',
      });
    }

    return JSON.stringify({
      success: true,
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        type: source.type,
        tags: source.tags,
        enabled: source.enabled,
      },
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * List documentation sources
 */
export async function listDocSources(args: Record<string, unknown>): Promise<string> {
  const ctx = await getKnowledgeContext();

  try {
    const docIndexer = ctx.manager.getDocIndexer();
    if (!docIndexer) {
      return JSON.stringify({
        sources: [],
        count: 0,
      });
    }

    const sources = await docIndexer.listSources();

    return JSON.stringify({
      count: sources.length,
      sources: sources.map((s) => ({
        id: s.id,
        name: s.name,
        url: s.url,
        type: s.type,
        tags: s.tags,
        enabled: s.enabled,
        lastCrawledAt: s.lastCrawledAt,
      })),
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: (error as Error).message,
    });
  }
}

/**
 * Crawl documentation
 */
export async function crawlDocs(args: Record<string, unknown>): Promise<string> {
  const ctx = await getKnowledgeContext();

  try {
    const docIndexer = ctx.manager.getDocIndexer();
    if (!docIndexer) {
      return JSON.stringify({
        success: false,
        error: 'Document indexer not enabled',
      });
    }

    let summary: CrawlSummary;

    if (args.sourceId) {
      // Crawl specific source
      const result = await docIndexer.crawlSource(args.sourceId as string, {
        force: args.force as boolean | undefined,
      });

      summary = {
        sourcesProcessed: 1,
        totalPagesProcessed: result.pagesProcessed,
        totalPagesAdded: result.pagesAdded,
        totalPagesUpdated: result.pagesUpdated,
        totalPagesFailed: result.pagesFailed,
        totalChunksAdded: result.chunksAdded,
        totalDurationMs: result.durationMs,
        results: [result],
      };
    } else {
      // Crawl all sources
      summary = await ctx.manager.crawlDocs({
        force: args.force as boolean | undefined,
      });
    }

    return JSON.stringify({
      success: true,
      summary: {
        sourcesProcessed: summary.sourcesProcessed,
        totalPagesProcessed: summary.totalPagesProcessed,
        totalPagesAdded: summary.totalPagesAdded,
        totalPagesUpdated: summary.totalPagesUpdated,
        totalPagesFailed: summary.totalPagesFailed,
        totalChunksAdded: summary.totalChunksAdded,
        durationMs: summary.totalDurationMs,
      },
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: (error as Error).message,
    });
  }
}

/**
 * Get knowledge statistics
 */
export async function getStats(args: Record<string, unknown>): Promise<string> {
  const ctx = await getKnowledgeContext();

  try {
    const stats = await ctx.manager.getStats();

    return JSON.stringify({
      code: {
        enabled: stats.code.enabled,
        totalFiles: stats.code.totalFiles,
        totalChunks: stats.code.totalChunks,
        lastIndexedAt: stats.code.lastIndexedAt,
      },
      doc: {
        enabled: stats.doc.enabled,
        totalSources: stats.doc.totalSources,
        totalPages: stats.doc.totalPages,
        totalChunks: stats.doc.totalChunks,
        lastCrawledAt: stats.doc.lastCrawledAt,
      },
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: (error as Error).message,
    });
  }
}
