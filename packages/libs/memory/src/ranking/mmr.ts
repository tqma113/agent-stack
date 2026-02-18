/**
 * @ai-stack/memory - Maximal Marginal Relevance (MMR)
 *
 * Implements MMR reranking to balance relevance and diversity in search results.
 * Prevents returning multiple similar chunks that provide redundant information.
 *
 * Formula: MMR = λ × relevance(d) - (1-λ) × max_similarity(d, selected)
 *
 * Reference: Carbonell & Goldstein, 1998
 * "The Use of MMR, Diversity-Based Reranking for Reordering Documents and Producing Summaries"
 */

import type { SemanticSearchResult, SemanticChunk } from '@ai-stack/memory-store-sqlite';

/**
 * MMR configuration
 */
export interface MMRConfig {
  /** Enable MMR reranking (default: true) */
  enabled: boolean;

  /**
   * Lambda parameter (default: 0.7)
   * - λ = 1.0: Pure relevance ranking (no diversity)
   * - λ = 0.5: Equal balance between relevance and diversity
   * - λ = 0.0: Pure diversity (ignores relevance)
   * Typical values: 0.5-0.8
   */
  lambda: number;

  /**
   * Similarity function for diversity calculation
   * (default: 'jaccard')
   */
  similarityFunction: 'jaccard' | 'cosine' | 'overlap';

  /**
   * Minimum similarity threshold to consider as duplicate (default: 0.8)
   * Results with similarity above this are heavily penalized
   */
  duplicateThreshold: number;

  /**
   * Use embeddings for similarity if available (default: true)
   * Falls back to text-based similarity if embeddings not present
   */
  useEmbeddings: boolean;
}

/**
 * Default MMR configuration
 */
export const DEFAULT_MMR_CONFIG: MMRConfig = {
  enabled: true,
  lambda: 0.7,
  similarityFunction: 'jaccard',
  duplicateThreshold: 0.8,
  useEmbeddings: true,
};

/**
 * Result with MMR score
 */
export interface MMRSearchResult extends SemanticSearchResult {
  /** Original relevance score */
  relevanceScore: number;
  /** Maximum similarity to already selected results */
  maxSimilarity: number;
  /** Final MMR score */
  mmrScore: number;
}

// =============================================================================
// Similarity Functions
// =============================================================================

/**
 * Tokenize text into words
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1)
  );
}

/**
 * Calculate Jaccard similarity between two texts
 * J(A,B) = |A ∩ B| / |A ∪ B|
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }

  const union = tokens1.size + tokens2.size - intersection;
  return intersection / union;
}

/**
 * Calculate overlap coefficient
 * O(A,B) = |A ∩ B| / min(|A|, |B|)
 */
export function overlapSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) intersection++;
  }

  return intersection / Math.min(tokens1.size, tokens2.size);
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length || vec1.length === 0) return 0;

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Calculate similarity between two chunks
 */
function calculateChunkSimilarity(
  chunk1: SemanticChunk,
  chunk2: SemanticChunk,
  config: MMRConfig
): number {
  // Try embedding similarity first
  if (config.useEmbeddings && chunk1.embedding && chunk2.embedding) {
    return cosineSimilarity(chunk1.embedding, chunk2.embedding);
  }

  // Fall back to text similarity
  switch (config.similarityFunction) {
    case 'jaccard':
      return jaccardSimilarity(chunk1.text, chunk2.text);
    case 'overlap':
      return overlapSimilarity(chunk1.text, chunk2.text);
    case 'cosine':
      // Text-based cosine using TF vectors (simplified)
      return jaccardSimilarity(chunk1.text, chunk2.text); // Fallback
    default:
      return jaccardSimilarity(chunk1.text, chunk2.text);
  }
}

/**
 * Calculate maximum similarity between a candidate and already selected results
 */
function maxSimilarityToSelected(
  candidate: SemanticChunk,
  selected: SemanticChunk[],
  config: MMRConfig
): number {
  if (selected.length === 0) return 0;

  let maxSim = 0;
  for (const sel of selected) {
    const sim = calculateChunkSimilarity(candidate, sel, config);
    if (sim > maxSim) maxSim = sim;
  }

  return maxSim;
}

/**
 * Calculate MMR score for a candidate
 *
 * MMR = λ × relevance - (1-λ) × maxSimilarity
 */
function calculateMMRScore(
  relevance: number,
  maxSimilarity: number,
  lambda: number,
  duplicateThreshold: number
): number {
  // Apply extra penalty for near-duplicates
  const effectiveSimilarity =
    maxSimilarity >= duplicateThreshold
      ? maxSimilarity * 1.5 // Heavy penalty for duplicates
      : maxSimilarity;

  return lambda * relevance - (1 - lambda) * effectiveSimilarity;
}

/**
 * Apply MMR reranking to search results
 *
 * Greedy algorithm:
 * 1. Select the highest relevance result first
 * 2. For each remaining slot, select the result with highest MMR score
 *
 * @param results - Search results to rerank
 * @param limit - Maximum number of results to return
 * @param config - MMR configuration
 * @returns Reranked results with MMR scores
 */
export function applyMMR(
  results: SemanticSearchResult[],
  limit: number,
  config: Partial<MMRConfig> = {}
): MMRSearchResult[] {
  const cfg: MMRConfig = { ...DEFAULT_MMR_CONFIG, ...config };

  if (!cfg.enabled || results.length === 0) {
    return results.slice(0, limit).map((r) => ({
      ...r,
      relevanceScore: r.score,
      maxSimilarity: 0,
      mmrScore: r.score,
    }));
  }

  // Normalize relevance scores to [0, 1]
  const maxRelevance = Math.max(...results.map((r) => r.score), 1);
  const normalizedResults = results.map((r) => ({
    ...r,
    normalizedRelevance: r.score / maxRelevance,
  }));

  const selected: MMRSearchResult[] = [];
  const remaining = [...normalizedResults];

  // Greedy selection
  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;
    let bestMaxSim = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const selectedChunks = selected.map((s) => s.chunk);

      const maxSim = maxSimilarityToSelected(candidate.chunk, selectedChunks, cfg);

      const mmrScore = calculateMMRScore(
        candidate.normalizedRelevance,
        maxSim,
        cfg.lambda,
        cfg.duplicateThreshold
      );

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
        bestMaxSim = maxSim;
      }
    }

    if (bestIdx === -1) break;

    const selectedResult = remaining[bestIdx];
    selected.push({
      chunk: selectedResult.chunk,
      score: selectedResult.score,
      matchType: selectedResult.matchType,
      relevanceScore: selectedResult.score,
      maxSimilarity: bestMaxSim,
      mmrScore: bestScore,
    });

    remaining.splice(bestIdx, 1);
  }

  return selected;
}

/**
 * Create an MMR processor function
 *
 * @param limit - Maximum results to return
 * @param config - MMR configuration
 * @returns A function that applies MMR to results
 */
export function createMMRProcessor(limit: number, config: Partial<MMRConfig> = {}) {
  const cfg: MMRConfig = { ...DEFAULT_MMR_CONFIG, ...config };

  return function process(results: SemanticSearchResult[]): MMRSearchResult[] {
    return applyMMR(results, limit, cfg);
  };
}

/**
 * Quick diversity check - returns true if results have significant redundancy
 *
 * @param results - Results to check
 * @param threshold - Similarity threshold (default: 0.6)
 * @returns True if results need diversity reranking
 */
export function needsDiversityReranking(
  results: SemanticSearchResult[],
  threshold = 0.6
): boolean {
  if (results.length < 2) return false;

  // Check first few pairs for high similarity
  const checkCount = Math.min(5, results.length);

  for (let i = 0; i < checkCount - 1; i++) {
    for (let j = i + 1; j < checkCount; j++) {
      const sim = jaccardSimilarity(results[i].chunk.text, results[j].chunk.text);
      if (sim > threshold) return true;
    }
  }

  return false;
}

/**
 * MMR statistics for debugging
 */
export interface MMRStats {
  /** Average relevance score */
  averageRelevance: number;
  /** Average max similarity (how similar results are to each other) */
  averageMaxSimilarity: number;
  /** Number of near-duplicates detected */
  nearDuplicates: number;
  /** Diversity score (1 - avgMaxSimilarity) */
  diversityScore: number;
}

/**
 * Calculate MMR statistics for a result set
 */
export function getMMRStats(results: MMRSearchResult[]): MMRStats {
  if (results.length === 0) {
    return {
      averageRelevance: 0,
      averageMaxSimilarity: 0,
      nearDuplicates: 0,
      diversityScore: 1,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

  const relevances = results.map((r) => r.relevanceScore);
  const maxSims = results.map((r) => r.maxSimilarity);

  const avgMaxSim = sum(maxSims) / maxSims.length;

  return {
    averageRelevance: sum(relevances) / relevances.length,
    averageMaxSimilarity: avgMaxSim,
    nearDuplicates: maxSims.filter((s) => s > 0.8).length,
    diversityScore: 1 - avgMaxSim,
  };
}
