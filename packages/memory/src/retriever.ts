/**
 * @agent-stack/memory - Retriever
 *
 * Multi-layer memory retrieval and bundle assembly.
 */

import type {
  MemoryBundle,
  MemoryWarning,
  MemoryEvent,
  ProfileItem,
  TaskState,
  Summary,
  SemanticSearchResult,
  RetrievalConfig,
  TokenBudget,
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
  UUID,
} from './types.js';
import { RetrievalError } from './errors.js';

/**
 * Retrieval options
 */
export interface RetrievalOptions {
  /** Session ID for filtering */
  sessionId?: string;

  /** Search query for semantic retrieval */
  query?: string;

  /** Specific task ID */
  taskId?: UUID;

  /** Override retrieval config */
  config?: Partial<RetrievalConfig>;

  /** Override token budget */
  budget?: Partial<TokenBudget>;
}

/**
 * Stores required for retrieval
 */
export interface RetrieverStores {
  eventStore: IEventStore;
  taskStateStore: ITaskStateStore;
  summaryStore: ISummaryStore;
  profileStore: IProfileStore;
  semanticStore: ISemanticStore;
}

/**
 * Memory Retriever - assembles MemoryBundle from multiple stores
 */
export class MemoryRetriever {
  constructor(
    private stores: RetrieverStores,
    private defaultConfig: RetrievalConfig,
    private defaultBudget: TokenBudget
  ) {}

  /**
   * Retrieve memory bundle
   */
  async retrieve(options: RetrievalOptions = {}): Promise<MemoryBundle> {
    const config = { ...this.defaultConfig, ...options.config };
    const budget = { ...this.defaultBudget, ...options.budget };
    const warnings: MemoryWarning[] = [];

    try {
      // Retrieve from all layers in parallel
      const [profile, taskState, recentEvents, summary, semanticResults] = await Promise.all([
        this.retrieveProfile(budget.profile),
        this.retrieveTaskState(options.taskId, options.sessionId),
        this.retrieveRecentEvents(options.sessionId, config, budget.recentEvents),
        this.retrieveSummary(options.sessionId),
        options.query && config.enableSemanticSearch
          ? this.retrieveSemantic(options.query, options.sessionId, config, budget.semanticChunks)
          : Promise.resolve([]),
      ]);

      // Check for stale data
      if (taskState && this.isStale(taskState.updatedAt)) {
        warnings.push({
          type: 'stale',
          message: `Task state may be outdated (last updated: ${new Date(taskState.updatedAt).toISOString()})`,
        });
      }

      // Calculate total tokens
      const totalTokens = this.estimateBundleTokens({
        profile,
        taskState,
        recentEvents,
        summary,
        semanticResults,
      });

      if (totalTokens > budget.total) {
        warnings.push({
          type: 'overflow',
          message: `Token budget exceeded: ${totalTokens} > ${budget.total}`,
          details: { actual: totalTokens, budget: budget.total },
        });
      }

      return {
        profile,
        taskState: taskState || undefined,
        recentEvents,
        retrievedChunks: semanticResults,
        summary: summary || undefined,
        warnings,
        totalTokens,
        timestamp: Date.now(),
      };
    } catch (error) {
      throw new RetrievalError(
        `Failed to retrieve memory: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve profile items
   */
  private async retrieveProfile(tokenBudget: number): Promise<ProfileItem[]> {
    const items = await this.stores.profileStore.getAll();

    // Sort by explicit first, then by confidence
    items.sort((a, b) => {
      if (a.explicit !== b.explicit) return a.explicit ? -1 : 1;
      return b.confidence - a.confidence;
    });

    // Trim to budget
    return this.trimToTokenBudget(items, tokenBudget, (item) =>
      this.estimateTokens(JSON.stringify(item))
    );
  }

  /**
   * Retrieve current task state
   */
  private async retrieveTaskState(
    taskId?: UUID,
    sessionId?: string
  ): Promise<TaskState | null> {
    if (taskId) {
      return this.stores.taskStateStore.get(taskId);
    }
    return this.stores.taskStateStore.getCurrent(sessionId);
  }

  /**
   * Retrieve recent events
   */
  private async retrieveRecentEvents(
    sessionId: string | undefined,
    config: RetrievalConfig,
    tokenBudget: number
  ): Promise<MemoryEvent[]> {
    const since = Date.now() - config.recentEventsWindowMs;

    const events = await this.stores.eventStore.query({
      sessionId,
      since,
      limit: config.maxRecentEvents * 2, // Fetch extra for trimming
    });

    // Trim to budget
    return this.trimToTokenBudget(events, tokenBudget, (event) =>
      this.estimateTokens(event.summary + JSON.stringify(event.payload))
    );
  }

  /**
   * Retrieve latest summary
   */
  private async retrieveSummary(sessionId?: string): Promise<Summary | null> {
    if (!sessionId) return null;
    return this.stores.summaryStore.getLatest(sessionId);
  }

  /**
   * Retrieve semantic chunks
   */
  private async retrieveSemantic(
    query: string,
    sessionId: string | undefined,
    config: RetrievalConfig,
    tokenBudget: number
  ): Promise<SemanticSearchResult[]> {
    const results = await this.stores.semanticStore.search(query, {
      sessionId,
      limit: config.maxSemanticChunks * 2,
    });

    // Trim to budget
    return this.trimToTokenBudget(results, tokenBudget, (result) =>
      this.estimateTokens(result.chunk.text)
    );
  }

  /**
   * Trim array to fit within token budget
   */
  private trimToTokenBudget<T>(
    items: T[],
    budget: number,
    estimator: (item: T) => number
  ): T[] {
    const result: T[] = [];
    let totalTokens = 0;

    for (const item of items) {
      const tokens = estimator(item);
      if (totalTokens + tokens > budget) break;
      result.push(item);
      totalTokens += tokens;
    }

    return result;
  }

  /**
   * Estimate tokens for a string (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Estimate total tokens for a bundle
   */
  private estimateBundleTokens(data: {
    profile: ProfileItem[];
    taskState: TaskState | null;
    recentEvents: MemoryEvent[];
    summary: Summary | null;
    semanticResults: SemanticSearchResult[];
  }): number {
    let total = 0;

    // Profile
    for (const item of data.profile) {
      total += this.estimateTokens(JSON.stringify(item));
    }

    // Task state
    if (data.taskState) {
      total += this.estimateTokens(JSON.stringify(data.taskState));
    }

    // Recent events
    for (const event of data.recentEvents) {
      total += this.estimateTokens(event.summary);
    }

    // Summary
    if (data.summary) {
      total += this.estimateTokens(data.summary.short);
      total += data.summary.bullets.reduce((acc, b) => acc + this.estimateTokens(b), 0);
    }

    // Semantic results
    for (const result of data.semanticResults) {
      total += this.estimateTokens(result.chunk.text);
    }

    return total;
  }

  /**
   * Check if timestamp is stale
   */
  private isStale(timestamp: number, thresholdMs = 24 * 60 * 60 * 1000): boolean {
    return Date.now() - timestamp > thresholdMs;
  }
}
