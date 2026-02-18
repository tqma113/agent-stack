/**
 * @agent-stack/memory - Budgeter
 *
 * Token budget management for memory injection.
 */

import type { TokenCount } from '@agent-stack/memory-store';
import type { TokenBudget, MemoryBundle } from './types.js';
import { TokenBudgetExceededError } from './errors.js';

/**
 * Budget allocation result
 */
export interface BudgetAllocation {
  profile: TokenCount;
  taskState: TokenCount;
  recentEvents: TokenCount;
  semanticChunks: TokenCount;
  summary: TokenCount;
  remaining: TokenCount;
}

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
 * Memory Budgeter instance interface
 */
export interface IMemoryBudgeter {
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

  /** Validate and throw if over budget */
  validateBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): void;

  /** Calculate dynamic allocation based on content availability */
  allocate(availableContent: {
    profileTokens: TokenCount;
    taskStateTokens: TokenCount;
    eventsTokens: TokenCount;
    chunksTokens: TokenCount;
    summaryTokens: TokenCount;
  }): BudgetAllocation;

  /** Trim content to fit budget */
  trimToFit<T>(
    items: T[],
    budget: TokenCount,
    estimator: (item: T) => TokenCount
  ): { items: T[]; usedTokens: TokenCount; trimmed: number };

  /** Calculate total tokens in a memory bundle */
  calculateBundleTokens(bundle: MemoryBundle): {
    profile: TokenCount;
    taskState: TokenCount;
    recentEvents: TokenCount;
    semanticChunks: TokenCount;
    summary: TokenCount;
    warnings: TokenCount;
    total: TokenCount;
  };

  /** Get budget utilization report */
  getUtilization(bundle: MemoryBundle): {
    layer: string;
    budget: TokenCount;
    used: TokenCount;
    percent: number;
  }[];
}

/**
 * Create a Memory Budgeter instance
 */
export function createMemoryBudgeter(
  initialBudget: TokenBudget,
  options: TokenEstimationOptions = {}
): IMemoryBudgeter {
  // Private state via closure
  let budget = { ...initialBudget };
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
   * Estimate tokens for an object (JSON serialized)
   */
  function estimateObjectTokens(obj: unknown): TokenCount {
    return estimateTokens(JSON.stringify(obj));
  }

  // Return the instance object
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

    validateBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): void {
      if (tokens > budget[layer]) {
        throw new TokenBudgetExceededError(layer, budget[layer], tokens);
      }
    },

    allocate(availableContent: {
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

    calculateBundleTokens(bundle: MemoryBundle): {
      profile: TokenCount;
      taskState: TokenCount;
      recentEvents: TokenCount;
      semanticChunks: TokenCount;
      summary: TokenCount;
      warnings: TokenCount;
      total: TokenCount;
    } {
      const profile = bundle.profile.reduce(
        (acc, item) => acc + estimateObjectTokens(item),
        0
      );

      const taskState = bundle.taskState
        ? estimateObjectTokens(bundle.taskState)
        : 0;

      const recentEvents = bundle.recentEvents.reduce(
        (acc, event) => acc + estimateTokens(event.summary),
        0
      );

      const semanticChunks = bundle.retrievedChunks.reduce(
        (acc, result) => acc + estimateTokens(result.chunk.text),
        0
      );

      const summary = bundle.summary
        ? estimateTokens(bundle.summary.short) +
          bundle.summary.bullets.reduce((acc, b) => acc + estimateTokens(b), 0)
        : 0;

      const warnings = bundle.warnings.reduce(
        (acc, w) => acc + estimateTokens(w.message),
        0
      );

      return {
        profile,
        taskState,
        recentEvents,
        semanticChunks,
        summary,
        warnings,
        total: profile + taskState + recentEvents + semanticChunks + summary + warnings,
      };
    },

    getUtilization(bundle: MemoryBundle): {
      layer: string;
      budget: TokenCount;
      used: TokenCount;
      percent: number;
    }[] {
      const tokens = this.calculateBundleTokens(bundle);

      return [
        {
          layer: 'profile',
          budget: budget.profile,
          used: tokens.profile,
          percent: (tokens.profile / budget.profile) * 100,
        },
        {
          layer: 'taskState',
          budget: budget.taskState,
          used: tokens.taskState,
          percent: (tokens.taskState / budget.taskState) * 100,
        },
        {
          layer: 'recentEvents',
          budget: budget.recentEvents,
          used: tokens.recentEvents,
          percent: (tokens.recentEvents / budget.recentEvents) * 100,
        },
        {
          layer: 'semanticChunks',
          budget: budget.semanticChunks,
          used: tokens.semanticChunks,
          percent: (tokens.semanticChunks / budget.semanticChunks) * 100,
        },
        {
          layer: 'summary',
          budget: budget.summary,
          used: tokens.summary,
          percent: (tokens.summary / budget.summary) * 100,
        },
        {
          layer: 'total',
          budget: budget.total,
          used: tokens.total,
          percent: (tokens.total / budget.total) * 100,
        },
      ];
    },
  };
}

