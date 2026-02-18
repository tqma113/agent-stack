'use strict';

var knowledge = require('@ai-stack/knowledge');
var memoryStoreSqlite = require('@ai-stack/memory-store-sqlite');

// src/store-context.ts
var knowledgeManager = null;
var semanticStore = null;
async function getKnowledgeContext() {
  if (!knowledgeManager || !semanticStore) {
    const dbPath = process.env.KNOWLEDGE_DB_PATH || process.env.MEMORY_DB_PATH || ".ai-stack/memory.db";
    const rootDir = process.env.KNOWLEDGE_ROOT_DIR || ".";
    const stores = await memoryStoreSqlite.createSqliteStores({ dbPath });
    await stores.initialize();
    semanticStore = stores.semanticStore;
    knowledgeManager = knowledge.createKnowledgeManager({
      code: {
        enabled: true,
        rootDir,
        include: ["**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,md,json}"],
        exclude: [
          "**/node_modules/**",
          "**/dist/**",
          "**/build/**",
          "**/.git/**",
          "**/coverage/**"
        ]
      },
      doc: {
        enabled: true
      },
      search: {
        defaultWeights: { fts: 0.3, vector: 0.7 },
        defaultLimit: 10
      }
    });
    await knowledgeManager.initialize();
    knowledgeManager.setStore(semanticStore);
  }
  return {
    manager: knowledgeManager,
    store: semanticStore
  };
}

// src/handlers.ts
async function searchCode(args) {
  const query = args.query;
  if (!query) {
    return JSON.stringify({ error: "Query is required" });
  }
  const ctx = await getKnowledgeContext();
  try {
    const results = await ctx.manager.searchCode(query, {
      languages: args.languages,
      filePatterns: args.filePatterns,
      symbolTypes: args.symbolTypes,
      limit: args.limit || 10
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
        content: r.chunk.text
      }))
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error.message,
      query
    });
  }
}
async function searchDocs(args) {
  const query = args.query;
  if (!query) {
    return JSON.stringify({ error: "Query is required" });
  }
  const ctx = await getKnowledgeContext();
  try {
    const results = await ctx.manager.searchDocs(query, {
      sourceIds: args.sourceIds,
      limit: args.limit || 10
    });
    return JSON.stringify({
      query,
      count: results.length,
      results: results.map((r) => ({
        score: r.score,
        url: r.chunk.doc?.url,
        title: r.chunk.doc?.title,
        section: r.chunk.doc?.section,
        content: r.chunk.text
      }))
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error.message,
      query
    });
  }
}
async function indexCode(args) {
  const ctx = await getKnowledgeContext();
  try {
    const summary = await ctx.manager.indexCode({
      force: args.force
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
        errors: summary.errors.slice(0, 5)
        // Limit errors shown
      }
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
async function addDocSource(args) {
  const name = args.name;
  const url = args.url;
  if (!name || !url) {
    return JSON.stringify({ error: "Name and URL are required" });
  }
  const ctx = await getKnowledgeContext();
  try {
    const source = await ctx.manager.addDocSource({
      name,
      url,
      type: args.type || "url",
      tags: args.tags,
      enabled: true
    });
    return JSON.stringify({
      success: true,
      source: {
        id: source.id,
        name: source.name,
        url: source.url,
        type: source.type,
        tags: source.tags
      }
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
async function removeDocSource(args) {
  const sourceId = args.sourceId;
  if (!sourceId) {
    return JSON.stringify({ error: "Source ID is required" });
  }
  const ctx = await getKnowledgeContext();
  try {
    await ctx.manager.removeDocSource(sourceId);
    return JSON.stringify({
      success: true,
      removedSourceId: sourceId
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
async function listDocSources(args) {
  const ctx = await getKnowledgeContext();
  try {
    const docIndexer = ctx.manager.getDocIndexer();
    if (!docIndexer) {
      return JSON.stringify({
        sources: [],
        count: 0
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
        lastCrawledAt: s.lastCrawledAt
      }))
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error.message
    });
  }
}
async function crawlDocs(args) {
  const ctx = await getKnowledgeContext();
  try {
    const docIndexer = ctx.manager.getDocIndexer();
    if (!docIndexer) {
      return JSON.stringify({
        success: false,
        error: "Document indexer not enabled"
      });
    }
    let summary;
    if (args.sourceId) {
      const result = await docIndexer.crawlSource(args.sourceId, {
        force: args.force
      });
      summary = {
        sourcesProcessed: 1,
        totalPagesProcessed: result.pagesProcessed,
        totalPagesAdded: result.pagesAdded,
        totalPagesUpdated: result.pagesUpdated,
        totalPagesFailed: result.pagesFailed,
        totalChunksAdded: result.chunksAdded,
        totalDurationMs: result.durationMs,
        results: [result]
      };
    } else {
      summary = await ctx.manager.crawlDocs({
        force: args.force
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
        durationMs: summary.totalDurationMs
      }
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error.message
    });
  }
}
async function getStats(args) {
  const ctx = await getKnowledgeContext();
  try {
    const stats = await ctx.manager.getStats();
    return JSON.stringify({
      code: {
        enabled: stats.code.enabled,
        totalFiles: stats.code.totalFiles,
        totalChunks: stats.code.totalChunks,
        lastIndexedAt: stats.code.lastIndexedAt
      },
      doc: {
        enabled: stats.doc.enabled,
        totalSources: stats.doc.totalSources,
        totalPages: stats.doc.totalPages,
        totalChunks: stats.doc.totalChunks,
        lastCrawledAt: stats.doc.lastCrawledAt
      }
    }, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: error.message
    });
  }
}

exports.addDocSource = addDocSource;
exports.crawlDocs = crawlDocs;
exports.getStats = getStats;
exports.indexCode = indexCode;
exports.listDocSources = listDocSources;
exports.removeDocSource = removeDocSource;
exports.searchCode = searchCode;
exports.searchDocs = searchDocs;
//# sourceMappingURL=handlers.cjs.map
//# sourceMappingURL=handlers.cjs.map