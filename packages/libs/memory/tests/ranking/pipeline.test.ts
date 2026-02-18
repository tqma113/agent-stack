/**
 * Tests for Ranking Pipeline
 */

import { describe, it, expect } from 'vitest';
import {
  createRankingPipeline,
  rankResults,
  rankResultsWithMetadata,
} from '../../src/ranking/pipeline.js';
import type { SemanticSearchResult } from '@ai-stack/memory-store-sqlite';

// Helper to create mock results
function createMockResult(
  id: string,
  score: number,
  text: string,
  daysAgo: number,
  referenceTime: number
): SemanticSearchResult {
  const timestamp = referenceTime - daysAgo * 24 * 60 * 60 * 1000;
  return {
    chunk: {
      id,
      timestamp,
      text,
      tags: [],
    },
    score,
    matchType: 'hybrid',
  };
}

describe('createRankingPipeline', () => {
  const referenceTime = Date.now();

  it('should apply both temporal decay and MMR by default', () => {
    const results = [
      createMockResult('old-high', 0.9, 'The quick brown fox', 60, referenceTime),
      createMockResult('new-low', 0.6, 'Python programming', 1, referenceTime),
      createMockResult('old-similar', 0.85, 'The quick brown dog', 55, referenceTime),
    ];

    const pipeline = createRankingPipeline({
      limit: 2,
      temporalDecay: { enabled: true, referenceTime },
      mmr: { enabled: true, lambda: 0.5 },
    });

    const result = pipeline(results);

    expect(result.results).toHaveLength(2);
    expect(result.metadata.temporalDecayApplied).toBe(true);
    expect(result.metadata.mmrApplied).toBe(true);
  });

  it('should filter by minimum score', () => {
    const results = [
      createMockResult('high', 0.8, 'test 1', 0, referenceTime),
      createMockResult('low', 0.2, 'test 2', 0, referenceTime),
    ];

    const pipeline = createRankingPipeline({
      limit: 10,
      minScore: 0.5,
      temporalDecay: { enabled: false },
      mmr: { enabled: false },
    });

    const result = pipeline(results);

    expect(result.results).toHaveLength(1);
    expect(result.results[0].chunk.id).toBe('high');
    expect(result.metadata.filteredCount).toBe(1);
  });

  it('should handle temporal decay only', () => {
    const results = [
      createMockResult('1', 1.0, 'test', 30, referenceTime),
    ];

    const pipeline = createRankingPipeline({
      limit: 10,
      temporalDecay: { enabled: true, referenceTime },
      mmr: { enabled: false },
    });

    const result = pipeline(results);

    expect(result.metadata.temporalDecayApplied).toBe(true);
    expect(result.metadata.mmrApplied).toBe(false);
    expect(result.results[0].score).toBeLessThan(1.0);
  });

  it('should handle MMR only', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox', 0, referenceTime),
      createMockResult('2', 0.9, 'The quick brown fox jumps', 0, referenceTime),
    ];

    const pipeline = createRankingPipeline({
      limit: 10,
      temporalDecay: { enabled: false },
      mmr: { enabled: true },
    });

    const result = pipeline(results);

    expect(result.metadata.temporalDecayApplied).toBe(false);
    expect(result.metadata.mmrApplied).toBe(true);
  });

  it('should respect limit', () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      createMockResult(`${i}`, 0.9 - i * 0.01, `test ${i}`, i, referenceTime)
    );

    const pipeline = createRankingPipeline({
      limit: 5,
      temporalDecay: { enabled: false },
      mmr: { enabled: false },
    });

    const result = pipeline(results);

    expect(result.results).toHaveLength(5);
    expect(result.metadata.inputCount).toBe(20);
    expect(result.metadata.outputCount).toBe(5);
  });

  it('should handle empty input', () => {
    const pipeline = createRankingPipeline({ limit: 10 });
    const result = pipeline([]);

    expect(result.results).toHaveLength(0);
    expect(result.metadata.inputCount).toBe(0);
  });
});

describe('rankResults', () => {
  const referenceTime = Date.now();

  it('should provide convenient ranking with defaults', () => {
    const results = [
      createMockResult('1', 0.9, 'test one', 30, referenceTime),
      createMockResult('2', 0.8, 'test two', 1, referenceTime),
    ];

    const ranked = rankResults(results, {
      limit: 5,
      temporalDecay: { referenceTime },
    });

    expect(ranked.length).toBeLessThanOrEqual(5);
  });

  it('should accept boolean config options', () => {
    const results = [
      createMockResult('1', 0.9, 'test', 0, referenceTime),
    ];

    const withDecay = rankResults(results, { temporalDecay: true });
    const withoutDecay = rankResults(results, { temporalDecay: false });

    expect(withDecay).toBeDefined();
    expect(withoutDecay).toBeDefined();
  });
});

describe('rankResultsWithMetadata', () => {
  const referenceTime = Date.now();

  it('should include full ranking metadata', () => {
    const results = [
      createMockResult('1', 0.9, 'test one', 30, referenceTime),
      createMockResult('2', 0.8, 'test two', 1, referenceTime),
    ];

    const ranked = rankResultsWithMetadata(results, {
      limit: 5,
      temporalDecay: { halfLifeDays: 30 },
      mmr: { lambda: 0.7 },
      referenceTime,
    });

    expect(ranked[0].originalScore).toBeDefined();
    expect(ranked[0].decayedScore).toBeDefined();
    expect(ranked[0].ageInDays).toBeDefined();
    expect(ranked[0].decayMultiplier).toBeDefined();
    expect(ranked[0].relevanceScore).toBeDefined();
    expect(ranked[0].maxSimilarity).toBeDefined();
    expect(ranked[0].mmrScore).toBeDefined();
  });

  it('should work with temporal decay only', () => {
    const results = [
      createMockResult('1', 0.9, 'test', 30, referenceTime),
    ];

    const ranked = rankResultsWithMetadata(results, {
      temporalDecay: { halfLifeDays: 30 },
      referenceTime,
    });

    expect(ranked[0].decayedScore).toBeDefined();
    expect(ranked[0].ageInDays).toBeDefined();
    expect(ranked[0].mmrScore).toBeUndefined();
  });

  it('should work with MMR only', () => {
    const results = [
      createMockResult('1', 0.9, 'test one', 0, referenceTime),
      createMockResult('2', 0.8, 'test two', 0, referenceTime),
    ];

    const ranked = rankResultsWithMetadata(results, {
      mmr: { lambda: 0.7 },
    });

    expect(ranked[0].relevanceScore).toBeDefined();
    expect(ranked[0].mmrScore).toBeDefined();
    expect(ranked[0].decayedScore).toBeUndefined();
  });
});
