/**
 * @ai-stack/memory - Temporal Decay
 *
 * Applies time-based decay to search results, favoring recent content.
 * Uses exponential decay with configurable half-life.
 */

import type { SemanticSearchResult, SemanticChunk } from '@ai-stack/memory-store-sqlite';

/**
 * Temporal decay configuration
 */
export interface TemporalDecayConfig {
  /** Enable temporal decay (default: true) */
  enabled: boolean;

  /**
   * Half-life in days (default: 30)
   * After this many days, the decay multiplier is 0.5
   */
  halfLifeDays: number;

  /**
   * Minimum decay multiplier (default: 0.1)
   * Prevents very old content from being completely ignored
   */
  minMultiplier: number;

  /**
   * Reference timestamp (default: Date.now())
   * All ages are calculated relative to this
   */
  referenceTime?: number;

  /**
   * Decay function type (default: 'exponential')
   * - 'exponential': score × e^(-λ × days)
   * - 'linear': score × max(min, 1 - days/maxDays)
   * - 'step': score × 1 if recent, score × factor if old
   */
  decayType: 'exponential' | 'linear' | 'step';

  /**
   * For 'linear' decay: maximum age in days before hitting minMultiplier
   */
  linearMaxDays?: number;

  /**
   * For 'step' decay: threshold in days
   */
  stepThresholdDays?: number;

  /**
   * For 'step' decay: multiplier for old content
   */
  stepOldMultiplier?: number;
}

/**
 * Default temporal decay configuration
 */
export const DEFAULT_TEMPORAL_DECAY_CONFIG: TemporalDecayConfig = {
  enabled: true,
  halfLifeDays: 30,
  minMultiplier: 0.1,
  decayType: 'exponential',
  linearMaxDays: 90,
  stepThresholdDays: 7,
  stepOldMultiplier: 0.5,
};

/**
 * Result with temporal decay applied
 */
export interface DecayedSearchResult extends SemanticSearchResult {
  /** Original score before decay */
  originalScore: number;
  /** Age in days */
  ageInDays: number;
  /** Decay multiplier applied */
  decayMultiplier: number;
}

/**
 * Calculate exponential decay multiplier
 *
 * Formula: e^(-λ × t) where λ = ln(2) / halfLife
 *
 * @param ageInDays - Age of the content in days
 * @param halfLifeDays - Half-life in days
 * @param minMultiplier - Minimum decay multiplier
 */
export function calculateExponentialDecay(
  ageInDays: number,
  halfLifeDays: number,
  minMultiplier: number
): number {
  if (ageInDays <= 0) return 1;

  const lambda = Math.LN2 / halfLifeDays;
  const decay = Math.exp(-lambda * ageInDays);

  return Math.max(minMultiplier, decay);
}

/**
 * Calculate linear decay multiplier
 *
 * @param ageInDays - Age of the content in days
 * @param maxDays - Maximum age before hitting minimum
 * @param minMultiplier - Minimum decay multiplier
 */
export function calculateLinearDecay(
  ageInDays: number,
  maxDays: number,
  minMultiplier: number
): number {
  if (ageInDays <= 0) return 1;
  if (ageInDays >= maxDays) return minMultiplier;

  const decay = 1 - (ageInDays / maxDays) * (1 - minMultiplier);
  return Math.max(minMultiplier, decay);
}

/**
 * Calculate step decay multiplier
 *
 * @param ageInDays - Age of the content in days
 * @param thresholdDays - Threshold before applying penalty
 * @param oldMultiplier - Multiplier for old content
 */
export function calculateStepDecay(
  ageInDays: number,
  thresholdDays: number,
  oldMultiplier: number
): number {
  return ageInDays <= thresholdDays ? 1 : oldMultiplier;
}

/**
 * Get timestamp from a semantic chunk
 */
function getChunkTimestamp(chunk: SemanticChunk): number {
  return chunk.timestamp;
}

/**
 * Convert milliseconds to days
 */
function msToDays(ms: number): number {
  return ms / (24 * 60 * 60 * 1000);
}

/**
 * Apply temporal decay to search results
 *
 * @param results - Search results to process
 * @param config - Decay configuration
 * @returns Results with decay applied, sorted by decayed score
 */
export function applyTemporalDecay(
  results: SemanticSearchResult[],
  config: Partial<TemporalDecayConfig> = {}
): DecayedSearchResult[] {
  const cfg: TemporalDecayConfig = { ...DEFAULT_TEMPORAL_DECAY_CONFIG, ...config };

  if (!cfg.enabled || results.length === 0) {
    return results.map((r) => ({
      ...r,
      originalScore: r.score,
      ageInDays: 0,
      decayMultiplier: 1,
    }));
  }

  const referenceTime = cfg.referenceTime ?? Date.now();

  const decayedResults: DecayedSearchResult[] = results.map((result) => {
    const timestamp = getChunkTimestamp(result.chunk);
    const ageMs = Math.max(0, referenceTime - timestamp);
    const ageInDays = msToDays(ageMs);

    let decayMultiplier: number;

    switch (cfg.decayType) {
      case 'exponential':
        decayMultiplier = calculateExponentialDecay(
          ageInDays,
          cfg.halfLifeDays,
          cfg.minMultiplier
        );
        break;

      case 'linear':
        decayMultiplier = calculateLinearDecay(
          ageInDays,
          cfg.linearMaxDays ?? 90,
          cfg.minMultiplier
        );
        break;

      case 'step':
        decayMultiplier = calculateStepDecay(
          ageInDays,
          cfg.stepThresholdDays ?? 7,
          cfg.stepOldMultiplier ?? 0.5
        );
        break;
    }

    return {
      ...result,
      originalScore: result.score,
      score: result.score * decayMultiplier,
      ageInDays,
      decayMultiplier,
    };
  });

  // Sort by decayed score
  decayedResults.sort((a, b) => b.score - a.score);

  return decayedResults;
}

/**
 * Create a temporal decay processor function
 *
 * @param config - Decay configuration
 * @returns A function that applies decay to results
 */
export function createTemporalDecayProcessor(config: Partial<TemporalDecayConfig> = {}) {
  const cfg: TemporalDecayConfig = { ...DEFAULT_TEMPORAL_DECAY_CONFIG, ...config };

  return function process(results: SemanticSearchResult[]): DecayedSearchResult[] {
    return applyTemporalDecay(results, cfg);
  };
}

/**
 * Temporal decay statistics for a result set
 */
export interface TemporalDecayStats {
  /** Average age in days */
  averageAge: number;
  /** Median age in days */
  medianAge: number;
  /** Min age in days */
  minAge: number;
  /** Max age in days */
  maxAge: number;
  /** Average decay multiplier */
  averageDecay: number;
  /** Number of results significantly affected (decay < 0.8) */
  significantlyDecayed: number;
}

/**
 * Calculate statistics about temporal decay applied to results
 */
export function getTemporalDecayStats(results: DecayedSearchResult[]): TemporalDecayStats {
  if (results.length === 0) {
    return {
      averageAge: 0,
      medianAge: 0,
      minAge: 0,
      maxAge: 0,
      averageDecay: 1,
      significantlyDecayed: 0,
    };
  }

  const ages = results.map((r) => r.ageInDays).sort((a, b) => a - b);
  const decays = results.map((r) => r.decayMultiplier);

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const median = ages[Math.floor(ages.length / 2)];

  return {
    averageAge: sum(ages) / ages.length,
    medianAge: median,
    minAge: ages[0],
    maxAge: ages[ages.length - 1],
    averageDecay: sum(decays) / decays.length,
    significantlyDecayed: decays.filter((d) => d < 0.8).length,
  };
}
