/**
 * @ai-stack/agent - Model Router Module
 *
 * Provides intelligent model routing with:
 * - Task-based routing (simple → fast, complex → strong)
 * - Cost optimization
 * - Context-aware selection
 * - Usage tracking
 */

export {
  createModelRouter,
  createOpenAIRouter,
  createAnthropicRouter,
  type ModelRouterInstance,
} from './model-router.js';

export type {
  TaskComplexity,
  TaskType,
  ModelTierName,
  ModelTier,
  RoutingContext,
  RoutingDecision,
  TokenUsage,
  TierCostStats,
  CostStats,
  ModelRouterConfig,
} from './types.js';

export { DEFAULT_TASK_TIER_MAP, DEFAULT_MODEL_TIERS } from './types.js';
