/**
 * Tests for Temporal Decay module
 */

import { describe, it, expect } from 'vitest';
import {
  applyTemporalDecay,
  calculateExponentialDecay,
  calculateLinearDecay,
  calculateStepDecay,
  getTemporalDecayStats,
  createTemporalDecayProcessor,
} from '../../src/ranking/temporal-decay.js';
import type { SemanticSearchResult } from '@ai-stack/memory-store-sqlite';

// Helper to create mock results
function createMockResult(
  id: string,
  score: number,
  daysAgo: number,
  referenceTime: number
): SemanticSearchResult {
  const timestamp = referenceTime - daysAgo * 24 * 60 * 60 * 1000;
  return {
    chunk: {
      id,
      timestamp,
      text: `Test chunk ${id}`,
      tags: [],
    },
    score,
    matchType: 'hybrid',
  };
}

describe('calculateExponentialDecay', () => {
  it('should return 1 for age 0', () => {
    expect(calculateExponentialDecay(0, 30, 0.1)).toBe(1);
  });

  it('should return ~0.5 at half-life', () => {
    const decay = calculateExponentialDecay(30, 30, 0.1);
    expect(decay).toBeCloseTo(0.5, 2);
  });

  it('should return ~0.25 at 2x half-life', () => {
    const decay = calculateExponentialDecay(60, 30, 0.1);
    expect(decay).toBeCloseTo(0.25, 2);
  });

  it('should respect minimum multiplier', () => {
    const decay = calculateExponentialDecay(365, 30, 0.1);
    expect(decay).toBeGreaterThanOrEqual(0.1);
  });
});

describe('calculateLinearDecay', () => {
  it('should return 1 for age 0', () => {
    expect(calculateLinearDecay(0, 90, 0.1)).toBe(1);
  });

  it('should return minimum at max days', () => {
    expect(calculateLinearDecay(90, 90, 0.1)).toBe(0.1);
  });

  it('should return ~0.55 at half of max days', () => {
    const decay = calculateLinearDecay(45, 90, 0.1);
    expect(decay).toBeCloseTo(0.55, 2);
  });
});

describe('calculateStepDecay', () => {
  it('should return 1 within threshold', () => {
    expect(calculateStepDecay(5, 7, 0.5)).toBe(1);
  });

  it('should return old multiplier beyond threshold', () => {
    expect(calculateStepDecay(10, 7, 0.5)).toBe(0.5);
  });

  it('should return 1 exactly at threshold', () => {
    expect(calculateStepDecay(7, 7, 0.5)).toBe(1);
  });
});

describe('applyTemporalDecay', () => {
  const referenceTime = Date.now();

  it('should apply exponential decay by default', () => {
    const results = [
      createMockResult('1', 1.0, 0, referenceTime),
      createMockResult('2', 1.0, 30, referenceTime),
      createMockResult('3', 1.0, 60, referenceTime),
    ];

    const decayed = applyTemporalDecay(results, { referenceTime });

    expect(decayed[0].chunk.id).toBe('1');
    expect(decayed[0].score).toBeCloseTo(1.0, 2);
    expect(decayed[1].chunk.id).toBe('2');
    expect(decayed[1].score).toBeCloseTo(0.5, 2);
    expect(decayed[2].chunk.id).toBe('3');
    expect(decayed[2].score).toBeCloseTo(0.25, 2);
  });

  it('should reorder results based on decayed score', () => {
    const results = [
      createMockResult('old-high', 0.9, 60, referenceTime),
      createMockResult('new-low', 0.5, 1, referenceTime),
    ];

    const decayed = applyTemporalDecay(results, { referenceTime });

    // New result should rank higher despite lower original score
    expect(decayed[0].chunk.id).toBe('new-low');
  });

  it('should preserve original score in metadata', () => {
    const results = [createMockResult('1', 0.8, 30, referenceTime)];
    const decayed = applyTemporalDecay(results, { referenceTime });

    expect(decayed[0].originalScore).toBe(0.8);
    expect(decayed[0].score).toBeLessThan(0.8);
  });

  it('should return unchanged results when disabled', () => {
    const results = [createMockResult('1', 1.0, 30, referenceTime)];
    const decayed = applyTemporalDecay(results, { enabled: false });

    expect(decayed[0].score).toBe(1.0);
    expect(decayed[0].decayMultiplier).toBe(1);
  });

  it('should handle linear decay type', () => {
    const results = [createMockResult('1', 1.0, 45, referenceTime)];
    const decayed = applyTemporalDecay(results, {
      referenceTime,
      decayType: 'linear',
      linearMaxDays: 90,
      minMultiplier: 0.1,
    });

    expect(decayed[0].score).toBeCloseTo(0.55, 2);
  });

  it('should handle step decay type', () => {
    const recentResult = createMockResult('recent', 1.0, 3, referenceTime);
    const oldResult = createMockResult('old', 1.0, 10, referenceTime);

    const decayed = applyTemporalDecay([recentResult, oldResult], {
      referenceTime,
      decayType: 'step',
      stepThresholdDays: 7,
      stepOldMultiplier: 0.5,
    });

    expect(decayed.find((r) => r.chunk.id === 'recent')!.score).toBe(1.0);
    expect(decayed.find((r) => r.chunk.id === 'old')!.score).toBe(0.5);
  });
});

describe('createTemporalDecayProcessor', () => {
  it('should create a reusable processor function', () => {
    const referenceTime = Date.now();
    const processor = createTemporalDecayProcessor({
      halfLifeDays: 7,
      referenceTime,
    });

    const results = [createMockResult('1', 1.0, 7, referenceTime)];
    const decayed = processor(results);

    expect(decayed[0].score).toBeCloseTo(0.5, 2);
  });
});

describe('getTemporalDecayStats', () => {
  it('should calculate statistics correctly', () => {
    const referenceTime = Date.now();
    const results = [
      createMockResult('1', 1.0, 10, referenceTime),
      createMockResult('2', 1.0, 20, referenceTime),
      createMockResult('3', 1.0, 30, referenceTime),
    ];

    const decayed = applyTemporalDecay(results, { referenceTime });
    const stats = getTemporalDecayStats(decayed);

    expect(stats.averageAge).toBeCloseTo(20, 1);
    expect(stats.medianAge).toBeCloseTo(20, 1);
    expect(stats.minAge).toBeCloseTo(10, 1);
    expect(stats.maxAge).toBeCloseTo(30, 1);
    expect(stats.averageDecay).toBeLessThan(1);
  });

  it('should handle empty results', () => {
    const stats = getTemporalDecayStats([]);
    expect(stats.averageAge).toBe(0);
    expect(stats.averageDecay).toBe(1);
  });
});
