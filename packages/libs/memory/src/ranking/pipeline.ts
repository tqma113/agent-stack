/**
 * @agent-stack/memory - Ranking Pipeline
 *
 * Composable pipeline for post-processing search results.
 * Combines temporal decay, MMR, and custom processors.
 */

import type { SemanticSearchResult } from '@agent-stack/memory-store-sqlite';
import {
  applyTemporalDecay,
  type TemporalDecayConfig,
  type DecayedSearchResult,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
} from './temporal-decay.js';
import {
  applyMMR,
  type MMRConfig,
  type MMRSearchResult,
  DEFAULT_MMR_CONFIG,
} from './mmr.js';

/**
 * Ranking pipeline configuration
 */
export interface RankingPipelineConfig {
  /** Temporal decay settings */
  temporalDecay: Partial<TemporalDecayConfig> & { enabled: boolean };

  /** MMR settings */
  mmr: Partial<MMRConfig> & { enabled: boolean };

  /** Maximum results to return */
  limit: number;

  /** Minimum score threshold (results below this are filtered out) */
  minScore?: number;
}

/**
 * Default pipeline configuration
 */
export const DEFAULT_PIPELINE_CONFIG: RankingPipelineConfig = {
  temporalDecay: {
    ...DEFAULT_TEMPORAL_DECAY_CONFIG,
    enabled: true,
  },
  mmr: {
    ...DEFAULT_MMR_CONFIG,
    enabled: true,
  },
  limit: 10,
  minScore: 0,
};

/**
 * Pipeline result with full metadata
 */
export interface PipelineResult {
  /** Final ranked results */
  results: SemanticSearchResult[];

  /** Metadata about the pipeline execution */
  metadata: {
    /** Input count */
    inputCount: number;
    /** Output count */
    outputCount: number;
    /** Results filtered by minScore */
    filteredCount: number;
    /** Whether temporal decay was applied */
    temporalDecayApplied: boolean;
    /** Whether MMR was applied */
    mmrApplied: boolean;
  };
}

/**
 * Create a ranking pipeline
 *
 * Pipeline stages:
 * 1. Filter by minimum score
 * 2. Apply temporal decay (if enabled)
 * 3. Apply MMR diversity reranking (if enabled)
 * 4. Limit results
 *
 * @param config - Pipeline configuration
 * @returns Pipeline function
 */
export function createRankingPipeline(config: Partial<RankingPipelineConfig> = {}) {
  const cfg: RankingPipelineConfig = {
    ...DEFAULT_PIPELINE_CONFIG,
    ...config,
    temporalDecay: { ...DEFAULT_PIPELINE_CONFIG.temporalDecay, ...config.temporalDecay },
    mmr: { ...DEFAULT_PIPELINE_CONFIG.mmr, ...config.mmr },
  };

  /**
   * Process search results through the ranking pipeline
   */
  return function process(results: SemanticSearchResult[]): PipelineResult {
    const inputCount = results.length;
    let processed: SemanticSearchResult[] = [...results];
    let filteredCount = 0;

    // Stage 1: Filter by minimum score
    if (cfg.minScore && cfg.minScore > 0) {
      const before = processed.length;
      processed = processed.filter((r) => r.score >= cfg.minScore!);
      filteredCount = before - processed.length;
    }

    // Stage 2: Temporal decay
    let temporalDecayApplied = false;
    if (cfg.temporalDecay.enabled && processed.length > 0) {
      const decayed = applyTemporalDecay(processed, cfg.temporalDecay);
      processed = decayed.map((r) => ({
        chunk: r.chunk,
        score: r.score,
        matchType: r.matchType,
      }));
      temporalDecayApplied = true;
    }

    // Stage 3: MMR diversity reranking
    let mmrApplied = false;
    if (cfg.mmr.enabled && processed.length > 0) {
      const mmrResults = applyMMR(processed, cfg.limit, cfg.mmr);
      processed = mmrResults.map((r) => ({
        chunk: r.chunk,
        score: r.score,
        matchType: r.matchType,
      }));
      mmrApplied = true;
    } else {
      // Just apply limit without MMR
      processed = processed.slice(0, cfg.limit);
    }

    return {
      results: processed,
      metadata: {
        inputCount,
        outputCount: processed.length,
        filteredCount,
        temporalDecayApplied,
        mmrApplied,
      },
    };
  };
}

/**
 * Quick helper for common use case:
 * Apply temporal decay + MMR with sensible defaults
 */
export function rankResults(
  results: SemanticSearchResult[],
  options: {
    limit?: number;
    temporalDecay?: boolean | Partial<TemporalDecayConfig>;
    mmr?: boolean | Partial<MMRConfig>;
    minScore?: number;
  } = {}
): SemanticSearchResult[] {
  const limit = options.limit ?? 10;

  const temporalDecayConfig: Partial<TemporalDecayConfig> & { enabled: boolean } =
    typeof options.temporalDecay === 'boolean'
      ? { enabled: options.temporalDecay }
      : typeof options.temporalDecay === 'object'
        ? { enabled: true, ...options.temporalDecay }
        : { enabled: true };

  const mmrConfig: Partial<MMRConfig> & { enabled: boolean } =
    typeof options.mmr === 'boolean'
      ? { enabled: options.mmr }
      : typeof options.mmr === 'object'
        ? { enabled: true, ...options.mmr }
        : { enabled: true };

  const pipeline = createRankingPipeline({
    limit,
    temporalDecay: temporalDecayConfig,
    mmr: mmrConfig,
    minScore: options.minScore,
  });

  return pipeline(results).results;
}

/**
 * Extended result type with all ranking metadata
 */
export interface FullRankedResult extends SemanticSearchResult {
  /** Original score before any processing */
  originalScore: number;
  /** Score after temporal decay */
  decayedScore?: number;
  /** Age in days */
  ageInDays?: number;
  /** Decay multiplier applied */
  decayMultiplier?: number;
  /** MMR relevance score */
  relevanceScore?: number;
  /** Max similarity to selected results */
  maxSimilarity?: number;
  /** Final MMR score */
  mmrScore?: number;
}

/**
 * Apply ranking with full metadata (for debugging/analysis)
 */
export function rankResultsWithMetadata(
  results: SemanticSearchResult[],
  options: {
    limit?: number;
    temporalDecay?: Partial<TemporalDecayConfig>;
    mmr?: Partial<MMRConfig>;
    referenceTime?: number;
  } = {}
): FullRankedResult[] {
  const limit = options.limit ?? 10;
  let processed: FullRankedResult[] = results.map((r) => ({
    ...r,
    originalScore: r.score,
  }));

  // Apply temporal decay
  if (options.temporalDecay !== undefined) {
    const decayed = applyTemporalDecay(processed, {
      enabled: true,
      ...options.temporalDecay,
      referenceTime: options.referenceTime,
    });
    processed = decayed.map((r) => ({
      ...r,
      decayedScore: r.score,
      ageInDays: r.ageInDays,
      decayMultiplier: r.decayMultiplier,
    }));
  }

  // Apply MMR
  if (options.mmr !== undefined) {
    const mmrResults = applyMMR(
      processed.map((r) => ({ chunk: r.chunk, score: r.score, matchType: r.matchType })),
      limit,
      { enabled: true, ...options.mmr }
    );

    // Merge MMR metadata back
    const mmrMap = new Map(mmrResults.map((r) => [r.chunk.id, r]));
    processed = processed
      .filter((r) => mmrMap.has(r.chunk.id))
      .map((r) => {
        const mmr = mmrMap.get(r.chunk.id)!;
        return {
          ...r,
          score: mmr.score,
          relevanceScore: mmr.relevanceScore,
          maxSimilarity: mmr.maxSimilarity,
          mmrScore: mmr.mmrScore,
        };
      })
      .sort((a, b) => (b.mmrScore ?? b.score) - (a.mmrScore ?? a.score));
  } else {
    processed = processed.slice(0, limit);
  }

  return processed;
}
