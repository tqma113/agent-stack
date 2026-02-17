/**
 * @agent-stack/memory - Budgeter
 *
 * Token budget management for memory injection.
 */

import type { TokenBudget, TokenCount, MemoryBundle } from './types.js';
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
 * Memory Budgeter - manages token allocation across memory layers
 */
export class MemoryBudgeter {
  private budget: TokenBudget;
  private options: Required<TokenEstimationOptions>;

  constructor(budget: TokenBudget, options: TokenEstimationOptions = {}) {
    this.budget = budget;
    this.options = {
      charsPerToken: options.charsPerToken ?? 4,
      overheadPercent: options.overheadPercent ?? 0.1,
    };
  }

  /**
   * Get current budget configuration
   */
  getBudget(): TokenBudget {
    return { ...this.budget };
  }

  /**
   * Update budget configuration
   */
  setBudget(budget: Partial<TokenBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  /**
   * Estimate tokens for a string
   */
  estimateTokens(text: string): TokenCount {
    const baseTokens = Math.ceil(text.length / this.options.charsPerToken);
    const overhead = Math.ceil(baseTokens * this.options.overheadPercent);
    return baseTokens + overhead;
  }

  /**
   * Estimate tokens for an object (JSON serialized)
   */
  estimateObjectTokens(obj: unknown): TokenCount {
    return this.estimateTokens(JSON.stringify(obj));
  }

  /**
   * Check if a layer is within budget
   */
  isWithinBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): boolean {
    return tokens <= this.budget[layer];
  }

  /**
   * Validate and throw if over budget
   */
  validateBudget(layer: keyof Omit<TokenBudget, 'total'>, tokens: TokenCount): void {
    if (!this.isWithinBudget(layer, tokens)) {
      throw new TokenBudgetExceededError(layer, this.budget[layer], tokens);
    }
  }

  /**
   * Calculate dynamic allocation based on content availability
   */
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
      remaining: this.budget.total,
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
        this.budget[layer.budgetKey],
        layer.available,
        allocation.remaining
      );
      allocation[layer.key] = maxForLayer;
      allocation.remaining -= maxForLayer;
    }

    return allocation;
  }

  /**
   * Trim content to fit budget
   */
  trimToFit<T>(
    items: T[],
    budget: TokenCount,
    estimator: (item: T) => TokenCount
  ): { items: T[]; usedTokens: TokenCount; trimmed: number } {
    const result: T[] = [];
    let usedTokens = 0;
    let trimmed = 0;

    for (const item of items) {
      const itemTokens = estimator(item);
      if (usedTokens + itemTokens <= budget) {
        result.push(item);
        usedTokens += itemTokens;
      } else {
        trimmed++;
      }
    }

    return { items: result, usedTokens, trimmed };
  }

  /**
   * Calculate total tokens in a memory bundle
   */
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
      (acc, item) => acc + this.estimateObjectTokens(item),
      0
    );

    const taskState = bundle.taskState
      ? this.estimateObjectTokens(bundle.taskState)
      : 0;

    const recentEvents = bundle.recentEvents.reduce(
      (acc, event) => acc + this.estimateTokens(event.summary),
      0
    );

    const semanticChunks = bundle.retrievedChunks.reduce(
      (acc, result) => acc + this.estimateTokens(result.chunk.text),
      0
    );

    const summary = bundle.summary
      ? this.estimateTokens(bundle.summary.short) +
        bundle.summary.bullets.reduce((acc, b) => acc + this.estimateTokens(b), 0)
      : 0;

    const warnings = bundle.warnings.reduce(
      (acc, w) => acc + this.estimateTokens(w.message),
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
  }

  /**
   * Get budget utilization report
   */
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
        budget: this.budget.profile,
        used: tokens.profile,
        percent: (tokens.profile / this.budget.profile) * 100,
      },
      {
        layer: 'taskState',
        budget: this.budget.taskState,
        used: tokens.taskState,
        percent: (tokens.taskState / this.budget.taskState) * 100,
      },
      {
        layer: 'recentEvents',
        budget: this.budget.recentEvents,
        used: tokens.recentEvents,
        percent: (tokens.recentEvents / this.budget.recentEvents) * 100,
      },
      {
        layer: 'semanticChunks',
        budget: this.budget.semanticChunks,
        used: tokens.semanticChunks,
        percent: (tokens.semanticChunks / this.budget.semanticChunks) * 100,
      },
      {
        layer: 'summary',
        budget: this.budget.summary,
        used: tokens.summary,
        percent: (tokens.summary / this.budget.summary) * 100,
      },
      {
        layer: 'total',
        budget: this.budget.total,
        used: tokens.total,
        percent: (tokens.total / this.budget.total) * 100,
      },
    ];
  }
}
