/**
 * @ai-stack/agent - Model Router Implementation
 *
 * Intelligent model routing based on task type,
 * complexity, cost optimization, and context requirements.
 */

import type {
  ModelRouterConfig,
  ModelTier,
  ModelTierName,
  TaskType,
  TaskComplexity,
  RoutingContext,
  RoutingDecision,
  TokenUsage,
  CostStats,
  TierCostStats,
} from './types.js';
import { DEFAULT_TASK_TIER_MAP, DEFAULT_MODEL_TIERS } from './types.js';

// =============================================================================
// Model Router Instance Interface
// =============================================================================

/**
 * Model router instance interface
 */
export interface ModelRouterInstance {
  /** Route based on task type */
  route(task: TaskType, context?: RoutingContext): RoutingDecision;

  /** Route based on complexity */
  routeByComplexity(complexity: TaskComplexity, context?: RoutingContext): RoutingDecision;

  /** Get model for specific tier */
  getModel(tier: ModelTierName): string;

  /** Get tier configuration */
  getTier(tier: ModelTierName): ModelTier;

  /** Get current cost statistics */
  getCostStats(): CostStats;

  /** Reset cost statistics */
  resetCostStats(): void;

  /** Record token usage for a request */
  recordUsage(tier: ModelTierName, usage: TokenUsage): number;

  /** Check if cost limit is reached */
  isCostLimitReached(): boolean;

  /** Check if approaching cost limit (80%) */
  isApproachingCostLimit(): boolean;

  /** Get remaining budget */
  getRemainingBudget(): number | null;

  /** Update configuration */
  updateConfig(config: Partial<ModelRouterConfig>): void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create empty tier stats
 */
function createEmptyTierStats(): TierCostStats {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    requestCount: 0,
  };
}

/**
 * Calculate cost for token usage
 */
function calculateCost(tier: ModelTier, usage: TokenUsage): number {
  const inputCost = (usage.input / 1000) * tier.inputCostPer1K;
  const outputCost = (usage.output / 1000) * tier.outputCostPer1K;
  return inputCost + outputCost;
}

// =============================================================================
// Model Router Factory
// =============================================================================

/**
 * Create model router instance
 */
export function createModelRouter(
  config: Partial<ModelRouterConfig> = {}
): ModelRouterInstance {
  // Merge with defaults
  const tiers: Record<ModelTierName, ModelTier> = {
    fast: config.fast ?? DEFAULT_MODEL_TIERS.fast,
    standard: config.standard ?? DEFAULT_MODEL_TIERS.standard,
    strong: config.strong ?? DEFAULT_MODEL_TIERS.strong,
  };

  const taskTierMap = { ...DEFAULT_TASK_TIER_MAP, ...config.taskTierMap };
  const defaultTier = config.defaultTier ?? 'standard';
  const costOptimization = config.costOptimization ?? true;
  const dailyCostLimit = config.dailyCostLimit;
  const requestCostLimit = config.requestCostLimit;
  const fallbackTier = config.fallbackTier ?? 'fast';

  // Cost tracking
  let costStats: CostStats = {
    byTier: {
      fast: createEmptyTierStats(),
      standard: createEmptyTierStats(),
      strong: createEmptyTierStats(),
    },
    totalCost: 0,
    totalRequests: 0,
    startTime: Date.now(),
    periodMs: 24 * 60 * 60 * 1000, // 24 hours
  };

  /**
   * Check if tier supports task
   */
  function tierSupportsTask(tier: ModelTier, task: TaskType): boolean {
    return tier.supportedTasks.includes(task);
  }

  /**
   * Check if tier meets context requirements
   */
  function tierMeetsRequirements(tier: ModelTier, context: RoutingContext): boolean {
    if (context.requiresTools && !tier.supportsTools) return false;
    if (context.requiresVision && !tier.supportsVision) return false;
    if (context.estimatedTokens && context.estimatedTokens > tier.maxContext) return false;
    return true;
  }

  /**
   * Get estimated cost for a request
   */
  function estimateCost(tier: ModelTier, estimatedTokens: number): number {
    // Assume output is roughly 1/4 of input for estimation
    const estimatedOutput = Math.ceil(estimatedTokens / 4);
    return calculateCost(tier, { input: estimatedTokens, output: estimatedOutput });
  }

  /**
   * Select best tier based on requirements
   */
  function selectTier(
    preferredTier: ModelTierName,
    task: TaskType,
    context: RoutingContext
  ): { tier: ModelTierName; reason: string } {
    const preferred = tiers[preferredTier];

    // Check if preferred tier meets requirements
    if (tierMeetsRequirements(preferred, context) && tierSupportsTask(preferred, task)) {
      // Check cost limit
      if (dailyCostLimit && costStats.totalCost >= dailyCostLimit) {
        return { tier: fallbackTier, reason: 'Cost limit reached, using cheapest model' };
      }

      // Check per-request cost limit
      if (requestCostLimit && context.estimatedTokens) {
        const estimated = estimateCost(preferred, context.estimatedTokens);
        if (estimated > requestCostLimit) {
          // Try to downgrade
          if (costOptimization && context.canDowngrade !== false) {
            const tierOrder: ModelTierName[] = ['fast', 'standard', 'strong'];
            const currentIndex = tierOrder.indexOf(preferredTier);

            for (let i = 0; i < currentIndex; i++) {
              const lowerTier = tiers[tierOrder[i]];
              if (tierMeetsRequirements(lowerTier, context) && tierSupportsTask(lowerTier, task)) {
                const lowerCost = estimateCost(lowerTier, context.estimatedTokens);
                if (lowerCost <= requestCostLimit) {
                  return {
                    tier: tierOrder[i],
                    reason: `Downgraded to ${tierOrder[i]} to stay within request cost limit`,
                  };
                }
              }
            }
          }
          return { tier: preferredTier, reason: `Request may exceed cost limit (${requestCostLimit})` };
        }
      }

      // Cost optimization: try cheaper tier if possible
      if (costOptimization && context.canDowngrade !== false && !context.requiresHighQuality) {
        const tierOrder: ModelTierName[] = ['fast', 'standard', 'strong'];
        const currentIndex = tierOrder.indexOf(preferredTier);

        for (let i = 0; i < currentIndex; i++) {
          const lowerTier = tiers[tierOrder[i]];
          if (tierMeetsRequirements(lowerTier, context) && tierSupportsTask(lowerTier, task)) {
            return {
              tier: tierOrder[i],
              reason: `Cost-optimized from ${preferredTier} to ${tierOrder[i]}`,
            };
          }
        }
      }

      return { tier: preferredTier, reason: `Task type '${task}' routed to ${preferredTier} tier` };
    }

    // Preferred tier doesn't meet requirements, try others
    const tierOrder: ModelTierName[] = ['strong', 'standard', 'fast'];
    for (const tierName of tierOrder) {
      if (tierName === preferredTier) continue;
      const tier = tiers[tierName];
      if (tierMeetsRequirements(tier, context) && tierSupportsTask(tier, task)) {
        return {
          tier: tierName,
          reason: `Upgraded/downgraded to ${tierName} due to requirements`,
        };
      }
    }

    // Fallback to default
    return { tier: defaultTier, reason: 'Using default tier as fallback' };
  }

  return {
    route(task: TaskType, context: RoutingContext = {}): RoutingDecision {
      const preferredTier = taskTierMap[task] ?? defaultTier;
      const { tier, reason } = selectTier(preferredTier, task, context);
      const selectedTier = tiers[tier];

      const decision: RoutingDecision = {
        tier,
        model: selectedTier.model,
        reason,
      };

      if (context.estimatedTokens) {
        decision.estimatedCost = estimateCost(selectedTier, context.estimatedTokens);
      }

      // Add alternatives
      const alternatives: RoutingDecision['alternatives'] = [];
      for (const [tierName, tierConfig] of Object.entries(tiers) as [ModelTierName, ModelTier][]) {
        if (tierName !== tier && tierSupportsTask(tierConfig, task)) {
          alternatives.push({
            tier: tierName,
            model: tierConfig.model,
            reason: `Alternative: ${tierName} tier`,
          });
        }
      }
      if (alternatives.length > 0) {
        decision.alternatives = alternatives;
      }

      return decision;
    },

    routeByComplexity(complexity: TaskComplexity, context: RoutingContext = {}): RoutingDecision {
      const complexityToTier: Record<TaskComplexity, ModelTierName> = {
        simple: 'fast',
        medium: 'standard',
        complex: 'strong',
      };

      const preferredTier = complexityToTier[complexity];
      const { tier, reason } = selectTier(preferredTier, 'reasoning', context);
      const selectedTier = tiers[tier];

      return {
        tier,
        model: selectedTier.model,
        reason: reason || `Complexity '${complexity}' routed to ${tier} tier`,
        estimatedCost: context.estimatedTokens
          ? estimateCost(selectedTier, context.estimatedTokens)
          : undefined,
      };
    },

    getModel(tier: ModelTierName): string {
      return tiers[tier].model;
    },

    getTier(tier: ModelTierName): ModelTier {
      return { ...tiers[tier] };
    },

    getCostStats(): CostStats {
      return {
        byTier: {
          fast: { ...costStats.byTier.fast },
          standard: { ...costStats.byTier.standard },
          strong: { ...costStats.byTier.strong },
        },
        totalCost: costStats.totalCost,
        totalRequests: costStats.totalRequests,
        startTime: costStats.startTime,
        periodMs: costStats.periodMs,
      };
    },

    resetCostStats(): void {
      costStats = {
        byTier: {
          fast: createEmptyTierStats(),
          standard: createEmptyTierStats(),
          strong: createEmptyTierStats(),
        },
        totalCost: 0,
        totalRequests: 0,
        startTime: Date.now(),
        periodMs: 24 * 60 * 60 * 1000,
      };
    },

    recordUsage(tier: ModelTierName, usage: TokenUsage): number {
      const tierConfig = tiers[tier];
      const cost = calculateCost(tierConfig, usage);

      costStats.byTier[tier].inputTokens += usage.input;
      costStats.byTier[tier].outputTokens += usage.output;
      costStats.byTier[tier].cost += cost;
      costStats.byTier[tier].requestCount++;

      costStats.totalCost += cost;
      costStats.totalRequests++;

      // Check warnings
      if (dailyCostLimit) {
        const threshold = 0.8;
        if (costStats.totalCost >= dailyCostLimit * threshold) {
          config.onCostWarning?.(this.getCostStats(), threshold);
        }
        if (costStats.totalCost >= dailyCostLimit) {
          config.onCostLimitReached?.(this.getCostStats());
        }
      }

      return cost;
    },

    isCostLimitReached(): boolean {
      if (!dailyCostLimit) return false;
      return costStats.totalCost >= dailyCostLimit;
    },

    isApproachingCostLimit(): boolean {
      if (!dailyCostLimit) return false;
      return costStats.totalCost >= dailyCostLimit * 0.8;
    },

    getRemainingBudget(): number | null {
      if (!dailyCostLimit) return null;
      return Math.max(0, dailyCostLimit - costStats.totalCost);
    },

    updateConfig(newConfig: Partial<ModelRouterConfig>): void {
      if (newConfig.fast) Object.assign(tiers.fast, newConfig.fast);
      if (newConfig.standard) Object.assign(tiers.standard, newConfig.standard);
      if (newConfig.strong) Object.assign(tiers.strong, newConfig.strong);
      if (newConfig.taskTierMap) Object.assign(taskTierMap, newConfig.taskTierMap);
    },
  };
}

// =============================================================================
// Preset Configurations
// =============================================================================

/**
 * Create router with OpenAI models
 */
export function createOpenAIRouter(
  options: {
    dailyCostLimit?: number;
    costOptimization?: boolean;
  } = {}
): ModelRouterInstance {
  return createModelRouter({
    fast: {
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputCostPer1K: 0.00015,
      outputCostPer1K: 0.0006,
      maxContext: 128000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation'],
      latencyTier: 2,
      qualityTier: 6,
      supportsStreaming: true,
      supportsTools: true,
    },
    standard: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1K: 0.0025,
      outputCostPer1K: 0.01,
      maxContext: 128000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation'],
      latencyTier: 4,
      qualityTier: 8,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    strong: {
      model: 'gpt-4o',
      provider: 'openai',
      inputCostPer1K: 0.0025,
      outputCostPer1K: 0.01,
      maxContext: 128000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation', 'code_review', 'reasoning', 'planning'],
      latencyTier: 4,
      qualityTier: 9,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    ...options,
  });
}

/**
 * Create router with Anthropic models
 */
export function createAnthropicRouter(
  options: {
    dailyCostLimit?: number;
    costOptimization?: boolean;
  } = {}
): ModelRouterInstance {
  return createModelRouter({
    fast: {
      model: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      inputCostPer1K: 0.001,
      outputCostPer1K: 0.005,
      maxContext: 200000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation'],
      latencyTier: 2,
      qualityTier: 7,
      supportsStreaming: true,
      supportsTools: true,
    },
    standard: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      maxContext: 200000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation', 'code_review'],
      latencyTier: 4,
      qualityTier: 9,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    strong: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      inputCostPer1K: 0.003,
      outputCostPer1K: 0.015,
      maxContext: 200000,
      supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation', 'code_review', 'reasoning', 'planning'],
      latencyTier: 4,
      qualityTier: 10,
      supportsStreaming: true,
      supportsTools: true,
      supportsVision: true,
    },
    ...options,
  });
}
