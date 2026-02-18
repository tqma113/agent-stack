/**
 * Tests for MMR (Maximal Marginal Relevance) module
 */

import { describe, it, expect } from 'vitest';
import {
  applyMMR,
  createMMRProcessor,
  needsDiversityReranking,
  getMMRStats,
  jaccardSimilarity,
  overlapSimilarity,
  cosineSimilarity,
} from '../../src/ranking/mmr.js';
import type { SemanticSearchResult } from '@ai-stack/memory-store-sqlite';

// Helper to create mock results
function createMockResult(id: string, score: number, text: string): SemanticSearchResult {
  return {
    chunk: {
      id,
      timestamp: Date.now(),
      text,
      tags: [],
    },
    score,
    matchType: 'hybrid',
  };
}

describe('jaccardSimilarity', () => {
  it('should return 1 for identical texts', () => {
    expect(jaccardSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('should return 0 for completely different texts', () => {
    expect(jaccardSimilarity('hello world', 'foo bar baz')).toBe(0);
  });

  it('should return ~0.5 for 50% overlap', () => {
    const sim = jaccardSimilarity('hello world foo', 'hello world bar');
    expect(sim).toBeCloseTo(0.5, 1);
  });

  it('should be case insensitive', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1);
  });

  it('should ignore punctuation', () => {
    expect(jaccardSimilarity('hello, world!', 'hello world')).toBe(1);
  });
});

describe('overlapSimilarity', () => {
  it('should return 1 for identical texts', () => {
    expect(overlapSimilarity('hello world', 'hello world')).toBe(1);
  });

  it('should return 1 when smaller set is subset of larger', () => {
    expect(overlapSimilarity('hello', 'hello world foo bar')).toBe(1);
  });

  it('should return 0 for completely different texts', () => {
    expect(overlapSimilarity('hello world', 'foo bar baz')).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
  });

  it('should return 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('should return -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('should handle normalized vectors', () => {
    const v1 = [0.6, 0.8];
    const v2 = [0.8, 0.6];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.96, 2);
  });
});

describe('applyMMR', () => {
  it('should select diverse results', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox jumps over the lazy dog'),
      createMockResult('2', 0.95, 'The quick brown fox jumps over the lazy cat'), // Similar to 1
      createMockResult('3', 0.9, 'Python is a programming language'), // Different topic
    ];

    const mmrResults = applyMMR(results, 2, { lambda: 0.5 });

    // Should select result 1 (highest relevance) and result 3 (most diverse)
    expect(mmrResults).toHaveLength(2);
    expect(mmrResults[0].chunk.id).toBe('1');
    expect(mmrResults[1].chunk.id).toBe('3');
  });

  it('should respect lambda parameter', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox'),
      createMockResult('2', 0.9, 'The quick brown fox jumps'), // Very similar
      createMockResult('3', 0.5, 'Python programming'), // Different
    ];

    // High lambda = favor relevance
    const highLambda = applyMMR(results, 2, { lambda: 0.95 });
    expect(highLambda[1].chunk.id).toBe('2'); // Similar but high relevance

    // Low lambda = favor diversity
    const lowLambda = applyMMR(results, 2, { lambda: 0.3 });
    expect(lowLambda[1].chunk.id).toBe('3'); // Different topic
  });

  it('should preserve metadata', () => {
    const results = [createMockResult('1', 0.8, 'test content')];
    const mmrResults = applyMMR(results, 1);

    expect(mmrResults[0].relevanceScore).toBe(0.8);
    expect(mmrResults[0].maxSimilarity).toBe(0);
    expect(mmrResults[0].mmrScore).toBeDefined();
  });

  it('should handle empty results', () => {
    const mmrResults = applyMMR([], 5);
    expect(mmrResults).toHaveLength(0);
  });

  it('should return unchanged results when disabled', () => {
    const results = [
      createMockResult('1', 1.0, 'test'),
      createMockResult('2', 0.9, 'test'),
    ];

    const mmrResults = applyMMR(results, 2, { enabled: false });

    expect(mmrResults[0].chunk.id).toBe('1');
    expect(mmrResults[1].chunk.id).toBe('2');
    expect(mmrResults[0].maxSimilarity).toBe(0);
  });

  it('should penalize near-duplicates', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox'),
      createMockResult('2', 0.99, 'The quick brown fox'), // Exact duplicate
      createMockResult('3', 0.7, 'Python programming'),
    ];

    const mmrResults = applyMMR(results, 2, { duplicateThreshold: 0.8 });

    expect(mmrResults[0].chunk.id).toBe('1');
    expect(mmrResults[1].chunk.id).toBe('3'); // Should skip duplicate
  });

  it('should use embeddings when available', () => {
    const results: SemanticSearchResult[] = [
      {
        chunk: {
          id: '1',
          timestamp: Date.now(),
          text: 'test 1',
          tags: [],
          embedding: [1, 0, 0],
        },
        score: 1.0,
        matchType: 'vector',
      },
      {
        chunk: {
          id: '2',
          timestamp: Date.now(),
          text: 'different text but similar embedding',
          tags: [],
          embedding: [0.99, 0.1, 0],
        },
        score: 0.95,
        matchType: 'vector',
      },
      {
        chunk: {
          id: '3',
          timestamp: Date.now(),
          text: 'another test',
          tags: [],
          embedding: [0, 1, 0], // Orthogonal
        },
        score: 0.9,
        matchType: 'vector',
      },
    ];

    const mmrResults = applyMMR(results, 2, { useEmbeddings: true, lambda: 0.5 });

    expect(mmrResults[0].chunk.id).toBe('1');
    expect(mmrResults[1].chunk.id).toBe('3'); // Most different embedding
  });
});

describe('createMMRProcessor', () => {
  it('should create a reusable processor function', () => {
    const processor = createMMRProcessor(3, { lambda: 0.7 });

    const results = [
      createMockResult('1', 1.0, 'test one'),
      createMockResult('2', 0.9, 'test two'),
    ];

    const mmrResults = processor(results);
    expect(mmrResults).toHaveLength(2);
  });
});

describe('needsDiversityReranking', () => {
  it('should return true for similar results', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox'),
      createMockResult('2', 0.9, 'The quick brown fox jumps'),
    ];

    expect(needsDiversityReranking(results, 0.5)).toBe(true);
  });

  it('should return false for diverse results', () => {
    const results = [
      createMockResult('1', 1.0, 'The quick brown fox'),
      createMockResult('2', 0.9, 'Python is a programming language'),
    ];

    expect(needsDiversityReranking(results, 0.5)).toBe(false);
  });

  it('should return false for single result', () => {
    const results = [createMockResult('1', 1.0, 'test')];
    expect(needsDiversityReranking(results)).toBe(false);
  });
});

describe('getMMRStats', () => {
  it('should calculate statistics correctly', () => {
    const results = [
      createMockResult('1', 1.0, 'test one'),
      createMockResult('2', 0.8, 'test two'),
      createMockResult('3', 0.6, 'test three'),
    ];

    const mmrResults = applyMMR(results, 3);
    const stats = getMMRStats(mmrResults);

    expect(stats.averageRelevance).toBeCloseTo(0.8, 2);
    expect(stats.diversityScore).toBeDefined();
    expect(stats.nearDuplicates).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty results', () => {
    const stats = getMMRStats([]);
    expect(stats.averageRelevance).toBe(0);
    expect(stats.diversityScore).toBe(1);
  });
});
