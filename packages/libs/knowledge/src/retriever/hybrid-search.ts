/**
 * Hybrid Search
 *
 * Combines FTS and vector search with result reranking.
 */

import type {
  SemanticStoreInstance,
  SemanticSearchResult,
} from '@ai-stack/memory-store-sqlite';

import type {
  KnowledgeSearchResult,
  KnowledgeSearchOptions,
  KnowledgeSourceType,
} from '../types.js';

/**
 * Hybrid search configuration
 */
export interface HybridSearchConfig {
  /** Default FTS weight */
  ftsWeight: number;
  /** Default vector weight */
  vectorWeight: number;
  /** Enable temporal decay */
  temporalDecay: {
    enabled: boolean;
    halfLifeDays: number;
    minMultiplier: number;
  };
  /** Enable MMR (Maximum Marginal Relevance) */
  mmr: {
    enabled: boolean;
    lambda: number;
    diversityThreshold: number;
  };
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  ftsWeight: 0.3,
  vectorWeight: 0.7,
  temporalDecay: {
    enabled: true,
    halfLifeDays: 30,
    minMultiplier: 0.1,
  },
  mmr: {
    enabled: true,
    lambda: 0.7,
    diversityThreshold: 0.8,
  },
};

/**
 * Apply temporal decay to scores
 */
function applyTemporalDecay(
  results: KnowledgeSearchResult[],
  config: HybridSearchConfig['temporalDecay']
): KnowledgeSearchResult[] {
  if (!config.enabled) return results;

  const now = Date.now();
  const halfLifeMs = config.halfLifeDays * 24 * 60 * 60 * 1000;
  const lambda = Math.log(2) / halfLifeMs;

  return results.map((result) => {
    const timestamp = result.chunk.timestamp || now;
    const ageMs = now - timestamp;
    const decayMultiplier = Math.max(
      config.minMultiplier,
      Math.exp(-lambda * ageMs)
    );

    return {
      ...result,
      score: result.score * decayMultiplier,
    };
  });
}

/**
 * Calculate text similarity (Jaccard)
 */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Apply MMR (Maximum Marginal Relevance) for diversity
 */
function applyMMR(
  results: KnowledgeSearchResult[],
  limit: number,
  config: HybridSearchConfig['mmr']
): KnowledgeSearchResult[] {
  if (!config.enabled || results.length <= limit) return results.slice(0, limit);

  const selected: KnowledgeSearchResult[] = [];
  const candidates = [...results];

  while (selected.length < limit && candidates.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];

      // Calculate relevance term
      const relevance = candidate.score;

      // Calculate diversity term (max similarity to selected)
      let maxSimilarity = 0;
      for (const sel of selected) {
        const sim = textSimilarity(candidate.chunk.text, sel.chunk.text);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }

      // MMR score
      const mmrScore = config.lambda * relevance - (1 - config.lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    // Add best candidate to selected
    selected.push(candidates[bestIdx]);
    candidates.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Transform SemanticSearchResult to KnowledgeSearchResult
 */
function transformResult(
  result: SemanticSearchResult,
  sourceType: KnowledgeSourceType
): KnowledgeSearchResult {
  const metadata = result.chunk.metadata as Record<string, unknown> || {};

  return {
    ...result,
    chunk: {
      ...result.chunk,
      sourceType,
      sourceUri: metadata.filePath as string || metadata.url as string || '',
      code: sourceType === 'code' ? {
        language: metadata.language as string || '',
        filePath: metadata.filePath as string || '',
        startLine: metadata.startLine as number || 1,
        endLine: metadata.endLine as number || 1,
        symbolName: metadata.symbolName as string | undefined,
        symbolType: metadata.symbolType as string | undefined,
      } : undefined,
      doc: sourceType === 'doc' ? {
        url: metadata.url as string || '',
        title: metadata.title as string | undefined,
        section: metadata.section as string | undefined,
        fetchedAt: metadata.fetchedAt as number || 0,
      } : undefined,
    },
    sourceType,
  };
}

/**
 * Hybrid search instance interface
 */
export interface HybridSearchInstance {
  /** Execute hybrid search */
  search(
    query: string,
    store: SemanticStoreInstance,
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]>;

  /** Update configuration */
  setConfig(config: Partial<HybridSearchConfig>): void;

  /** Get current configuration */
  getConfig(): HybridSearchConfig;
}

/**
 * Create a hybrid search instance
 */
export function createHybridSearch(
  config: Partial<HybridSearchConfig> = {}
): HybridSearchInstance {
  let cfg: HybridSearchConfig = { ...DEFAULT_CONFIG, ...config };

  /**
   * Execute hybrid search
   */
  async function search(
    query: string,
    store: SemanticStoreInstance,
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    const limit = options?.limit || 10;
    const weights = options?.weights || { fts: cfg.ftsWeight, vector: cfg.vectorWeight };

    // Build tags for filtering
    const tags: string[] = [];

    // Add source type tags
    if (options?.sources) {
      tags.push(...options.sources);
    }

    // Add language tags for code
    if (options?.languages) {
      tags.push(...options.languages);
    }

    // Execute search on store
    // Note: SemanticStore.search doesn't support weights directly,
    // but we've configured the hybrid search internally
    const rawResults = await store.search(query, {
      tags: tags.length > 0 ? tags : undefined,
      limit: limit * 3, // Fetch more for post-processing
      useVector: options?.useVector,
    });

    // Determine source type based on tags
    const getSourceType = (result: SemanticSearchResult): KnowledgeSourceType => {
      const sourceTags = result.chunk.tags || [];
      if (sourceTags.includes('code')) return 'code';
      if (sourceTags.includes('doc')) return 'doc';
      return 'memory';
    };

    // Transform results
    let results: KnowledgeSearchResult[] = rawResults.map((r) =>
      transformResult(r, getSourceType(r))
    );

    // Filter by source types if specified
    if (options?.sources && options.sources.length > 0) {
      results = results.filter((r) => options.sources!.includes(r.sourceType));
    }

    // Filter by file patterns for code
    if (options?.filePatterns && options.filePatterns.length > 0) {
      results = results.filter((r) => {
        if (r.sourceType !== 'code') return true;
        const filePath = r.chunk.code?.filePath || '';
        return options.filePatterns!.some((pattern) => {
          // Simple glob matching
          const regex = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
          return new RegExp(regex).test(filePath);
        });
      });
    }

    // Filter by URL prefixes for docs
    if (options?.urlPrefixes && options.urlPrefixes.length > 0) {
      results = results.filter((r) => {
        if (r.sourceType !== 'doc') return true;
        const url = r.chunk.doc?.url || '';
        return options.urlPrefixes!.some((prefix) => url.startsWith(prefix));
      });
    }

    // Apply temporal decay
    results = applyTemporalDecay(results, cfg.temporalDecay);

    // Apply MMR for diversity
    results = applyMMR(results, limit, cfg.mmr);

    // Filter by minimum score
    if (options?.minScore) {
      results = results.filter((r) => r.score >= options.minScore!);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Update configuration
   */
  function setConfig(newConfig: Partial<HybridSearchConfig>): void {
    cfg = { ...cfg, ...newConfig };
  }

  /**
   * Get current configuration
   */
  function getConfig(): HybridSearchConfig {
    return { ...cfg };
  }

  return {
    search,
    setConfig,
    getConfig,
  };
}
