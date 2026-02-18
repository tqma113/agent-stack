/**
 * @agent-stack/memory - Budget Policy
 *
 * Token budget management for memory injection.
 */

import type { TokenCount } from '@agent-stack/memory-store-sqlite';
import type { TokenBudget, BudgetAllocation } from './types.js';

/**
 * Token estimation options
 */
export interface TokenEstimationOptions {
  /** Average characters per token (default: 4) */
  charsPerToken?: number;
  /** Add overhead percentage for formatting (default: 0.1 = 10%) */
  overheadPercent?: number;
}

/**
 * Default token budget
 */
export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  profile: 200,
  taskState: 300,
  recentEvents: 500,
  semanticChunks: 800,
  summary: 400,
  total: 2200,
};

/**
 * Budget Policy instance interface
 */
export interface IBudgetPolicy {
  /** Get current budget configuration */
  getBudget(): TokenBudget;
  /** Update budget configuration */
  setBudget(budget: Partial<TokenBudget>): void;
  /** Estimate tokens for a string */
  estimateTokens(text: string): TokenCount;
  /** Estimate tokens for an object (JSON serialized) */
  estimateObjectTokens(obj: unknown): TokenCount;
  /** Check if a layer is within budget */
  isWithinBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): boolean;
  /** Calculate dynamic allocation based on content availability */
  allocateBudget(availableContent: {
    profileTokens: TokenCount;
    taskStateTokens: TokenCount;
    eventsTokens: TokenCount;
    chunksTokens: TokenCount;
    summaryTokens: TokenCount;
  }): BudgetAllocation;
  /** Trim items to fit budget */
  trimToFit<T>(
    items: T[],
    budget: TokenCount,
    estimator: (item: T) => TokenCount
  ): { items: T[]; usedTokens: TokenCount; trimmed: number };
}

/**
 * Create a Budget Policy instance
 */
export function createBudgetPolicy(
  initialBudget: Partial<TokenBudget> = {},
  options: TokenEstimationOptions = {}
): IBudgetPolicy {
  // Private state
  let budget: TokenBudget = { ...DEFAULT_TOKEN_BUDGET, ...initialBudget };
  const config: Required<TokenEstimationOptions> = {
    charsPerToken: options.charsPerToken ?? 4,
    overheadPercent: options.overheadPercent ?? 0.1,
  };

  /**
   * Estimate tokens for a string
   */
  function estimateTokens(text: string): TokenCount {
    const baseTokens = Math.ceil(text.length / config.charsPerToken);
    const overhead = Math.ceil(baseTokens * config.overheadPercent);
    return baseTokens + overhead;
  }

  /**
   * Estimate tokens for an object
   */
  function estimateObjectTokens(obj: unknown): TokenCount {
    return estimateTokens(JSON.stringify(obj));
  }

  return {
    getBudget(): TokenBudget {
      return { ...budget };
    },

    setBudget(newBudget: Partial<TokenBudget>): void {
      budget = { ...budget, ...newBudget };
    },

    estimateTokens,

    estimateObjectTokens,

    isWithinBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): boolean {
      return tokens <= budget[layer];
    },

    allocateBudget(availableContent: {
      profileTokens: TokenCount;
      taskStateTokens: TokenCount;
      eventsTokens: TokenCount;
      chunksTokens: TokenCount;
      summaryTokens: TokenCount;
    }): BudgetAllocation {
      const allocation: BudgetAllocation = {
        profile: 0,
        taskState: 0,
        recentEvents: 0,
        semanticChunks: 0,
        summary: 0,
        remaining: budget.total,
      };

      // Priority order: profile > taskState > summary > events > chunks
      const layers: Array<{
        key: keyof Omit<BudgetAllocation, 'remaining'>;
        available: TokenCount;
        budgetKey: keyof Omit<TokenBudget, 'total'>;
      }> = [
        { key: 'profile', available: availableContent.profileTokens, budgetKey: 'profile' },
        { key: 'taskState', available: availableContent.taskStateTokens, budgetKey: 'taskState' },
        { key: 'summary', available: availableContent.summaryTokens, budgetKey: 'summary' },
        { key: 'recentEvents', available: availableContent.eventsTokens, budgetKey: 'recentEvents' },
        { key: 'semanticChunks', available: availableContent.chunksTokens, budgetKey: 'semanticChunks' },
      ];

      for (const layer of layers) {
        const maxForLayer = Math.min(
          budget[layer.budgetKey],
          layer.available,
          allocation.remaining
        );
        allocation[layer.key] = maxForLayer;
        allocation.remaining -= maxForLayer;
      }

      return allocation;
    },

    trimToFit<T>(
      items: T[],
      tokenBudget: TokenCount,
      estimator: (item: T) => TokenCount
    ): { items: T[]; usedTokens: TokenCount; trimmed: number } {
      const result: T[] = [];
      let usedTokens = 0;
      let trimmed = 0;

      for (const item of items) {
        const itemTokens = estimator(item);
        if (usedTokens + itemTokens <= tokenBudget) {
          result.push(item);
          usedTokens += itemTokens;
        } else {
          trimmed++;
        }
      }

      return { items: result, usedTokens, trimmed };
    },
  };
}
