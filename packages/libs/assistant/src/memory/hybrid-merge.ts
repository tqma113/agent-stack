/**
 * @ai-stack/assistant - Hybrid Search Result Merger
 *
 * Merges BM25 (FTS) and vector search results with weighted scoring.
 */

import type { MemorySearchResult } from './types.js';

/**
 * Internal result type with separate scores
 */
interface ScoredResult extends MemorySearchResult {
  ftsScore: number;
  vectorScore: number;
}

/**
 * Merge hybrid search results from BM25 and vector search
 *
 * @param bm25Results - Results from BM25 (FTS) search
 * @param vectorResults - Results from vector search
 * @param weights - Weights for combining scores (default: { fts: 0.3, vector: 0.7 })
 * @returns Merged and re-ranked results
 */
export function mergeHybridResults(
  bm25Results: MemorySearchResult[],
  vectorResults: MemorySearchResult[],
  weights: { fts: number; vector: number } = { fts: 0.3, vector: 0.7 }
): MemorySearchResult[] {
  // Use content as the unique key for deduplication
  const merged = new Map<string, ScoredResult>();

  // Normalize BM25 scores to [0, 1]
  const maxBm25 = Math.max(...bm25Results.map((r) => r.score), 1);
  for (const r of bm25Results) {
    const key = generateResultKey(r);
    merged.set(key, {
      ...r,
      ftsScore: r.score / maxBm25,
      vectorScore: 0,
    });
  }

  // Normalize vector scores to [0, 1] and merge
  const maxVector = Math.max(...vectorResults.map((r) => r.score), 1);
  for (const r of vectorResults) {
    const key = generateResultKey(r);
    const existing = merged.get(key);
    if (existing) {
      existing.vectorScore = r.score / maxVector;
    } else {
      merged.set(key, {
        ...r,
        ftsScore: 0,
        vectorScore: r.score / maxVector,
      });
    }
  }

  // Calculate combined scores and sort
  const results: MemorySearchResult[] = Array.from(merged.values()).map((r) => ({
    type: r.type,
    content: r.content,
    score: weights.fts * r.ftsScore + weights.vector * r.vectorScore,
    source: r.source,
    timestamp: r.timestamp,
    metadata: {
      ...r.metadata,
      ftsScore: r.ftsScore,
      vectorScore: r.vectorScore,
    },
  }));

  // Sort by combined score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Generate a unique key for a result based on content and source
 */
function generateResultKey(result: MemorySearchResult): string {
  // Use content hash for deduplication
  // Trim and normalize whitespace to handle minor formatting differences
  const normalizedContent = result.content.trim().replace(/\s+/g, ' ');
  return `${result.type}:${normalizedContent.slice(0, 200)}`;
}

/**
 * Apply Reciprocal Rank Fusion (RRF) for merging ranked lists
 * Alternative to weighted merging, useful when scores are not comparable
 *
 * @param bm25Results - Results from BM25 search
 * @param vectorResults - Results from vector search
 * @param k - RRF constant (default: 60)
 * @returns Merged results using RRF scoring
 */
export function mergeWithRRF(
  bm25Results: MemorySearchResult[],
  vectorResults: MemorySearchResult[],
  k: number = 60
): MemorySearchResult[] {
  const rrfScores = new Map<string, { result: MemorySearchResult; score: number }>();

  // Add BM25 RRF scores (rank starts at 1)
  bm25Results.forEach((r, index) => {
    const key = generateResultKey(r);
    const rrfScore = 1 / (k + index + 1);
    rrfScores.set(key, { result: r, score: rrfScore });
  });

  // Add vector RRF scores
  vectorResults.forEach((r, index) => {
    const key = generateResultKey(r);
    const rrfScore = 1 / (k + index + 1);
    const existing = rrfScores.get(key);
    if (existing) {
      existing.score += rrfScore;
    } else {
      rrfScores.set(key, { result: r, score: rrfScore });
    }
  });

  // Convert to array and sort by RRF score
  const results = Array.from(rrfScores.values())
    .map(({ result, score }) => ({
      ...result,
      score,
      metadata: {
        ...result.metadata,
        rrfScore: score,
      },
    }))
    .sort((a, b) => b.score - a.score);

  return results;
}
