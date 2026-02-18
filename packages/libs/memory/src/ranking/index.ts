/**
 * @ai-stack/memory - Ranking Module
 *
 * Post-processing pipeline for search result ranking:
 * - Temporal Decay: Favor recent content
 * - MMR: Balance relevance and diversity
 */

// Temporal Decay
export {
  applyTemporalDecay,
  createTemporalDecayProcessor,
  calculateExponentialDecay,
  calculateLinearDecay,
  calculateStepDecay,
  getTemporalDecayStats,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
  type TemporalDecayConfig,
  type DecayedSearchResult,
  type TemporalDecayStats,
} from './temporal-decay.js';

// MMR (Maximal Marginal Relevance)
export {
  applyMMR,
  createMMRProcessor,
  needsDiversityReranking,
  getMMRStats,
  jaccardSimilarity,
  overlapSimilarity,
  cosineSimilarity,
  DEFAULT_MMR_CONFIG,
  type MMRConfig,
  type MMRSearchResult,
  type MMRStats,
} from './mmr.js';

// Re-export pipeline helper
export { createRankingPipeline, type RankingPipelineConfig } from './pipeline.js';
