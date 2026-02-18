/**
 * @agent-stack/memory - Retriever
 *
 * Multi-layer memory retrieval and bundle assembly.
 */

import type {
  MemoryEvent,
  ProfileItem,
  TaskState,
  Summary,
  SemanticSearchResult,
  IEventStore,
  ITaskStateStore,
  ISummaryStore,
  IProfileStore,
  ISemanticStore,
  UUID,
} from '@agent-stack/memory-store-sqlite';
import type {
  MemoryBundle,
  MemoryWarning,
  RetrievalConfig,
  TokenBudget,
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
 * Memory Retriever instance interface
 */
export interface IMemoryRetriever {
  /** Retrieve memory bundle */
  retrieve(options?: RetrievalOptions): Promise<MemoryBundle>;
}

/**
 * Estimate tokens for a string (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Trim array to fit within token budget
 */
function trimToTokenBudget<T>(
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
 * Check if timestamp is stale
 */
function isStale(timestamp: number, thresholdMs = 24 * 60 * 60 * 1000): boolean {
  return Date.now() - timestamp > thresholdMs;
}

/**
 * Estimate total tokens for a bundle
 */
function estimateBundleTokens(data: {
  profile: ProfileItem[];
  taskState: TaskState | null;
  recentEvents: MemoryEvent[];
  summary: Summary | null;
  semanticResults: SemanticSearchResult[];
}): number {
  let total = 0;

  // Profile
  for (const item of data.profile) {
    total += estimateTokens(JSON.stringify(item));
  }

  // Task state
  if (data.taskState) {
    total += estimateTokens(JSON.stringify(data.taskState));
  }

  // Recent events
  for (const event of data.recentEvents) {
    total += estimateTokens(event.summary);
  }

  // Summary
  if (data.summary) {
    total += estimateTokens(data.summary.short);
    total += data.summary.bullets.reduce((acc, b) => acc + estimateTokens(b), 0);
  }

  // Semantic results
  for (const result of data.semanticResults) {
    total += estimateTokens(result.chunk.text);
  }

  return total;
}

/**
 * Create a Memory Retriever instance
 */
export function createMemoryRetriever(
  stores: RetrieverStores,
  defaultConfig: RetrievalConfig,
  defaultBudget: TokenBudget
): IMemoryRetriever {
  /**
   * Retrieve profile items
   */
  async function retrieveProfile(tokenBudget: number): Promise<ProfileItem[]> {
    const items = await stores.profileStore.getAll();

    // Sort by explicit first, then by confidence
    items.sort((a, b) => {
      if (a.explicit !== b.explicit) return a.explicit ? -1 : 1;
      return b.confidence - a.confidence;
    });

    // Trim to budget
    return trimToTokenBudget(items, tokenBudget, (item) =>
      estimateTokens(JSON.stringify(item))
    );
  }

  /**
   * Retrieve current task state
   */
  async function retrieveTaskState(
    taskId?: UUID,
    sessionId?: string
  ): Promise<TaskState | null> {
    if (taskId) {
      return stores.taskStateStore.get(taskId);
    }
    return stores.taskStateStore.getCurrent(sessionId);
  }

  /**
   * Retrieve recent events
   */
  async function retrieveRecentEvents(
    sessionId: string | undefined,
    config: RetrievalConfig,
    tokenBudget: number
  ): Promise<MemoryEvent[]> {
    const since = Date.now() - config.recentEventsWindowMs;

    const events = await stores.eventStore.query({
      sessionId,
      since,
      limit: config.maxRecentEvents * 2, // Fetch extra for trimming
    });

    // Trim to budget
    return trimToTokenBudget(events, tokenBudget, (event) =>
      estimateTokens(event.summary + JSON.stringify(event.payload))
    );
  }

  /**
   * Retrieve latest summary
   */
  async function retrieveSummary(sessionId?: string): Promise<Summary | null> {
    if (!sessionId) return null;
    return stores.summaryStore.getLatest(sessionId);
  }

  /**
   * Retrieve semantic chunks
   */
  async function retrieveSemantic(
    query: string,
    sessionId: string | undefined,
    config: RetrievalConfig,
    tokenBudget: number
  ): Promise<SemanticSearchResult[]> {
    const results = await stores.semanticStore.search(query, {
      sessionId,
      limit: config.maxSemanticChunks * 2,
    });

    // Trim to budget
    return trimToTokenBudget(results, tokenBudget, (result) =>
      estimateTokens(result.chunk.text)
    );
  }

  // Return the instance object
  return {
    async retrieve(options: RetrievalOptions = {}): Promise<MemoryBundle> {
      const config = { ...defaultConfig, ...options.config };
      const budget = { ...defaultBudget, ...options.budget };
      const warnings: MemoryWarning[] = [];

      try {
        // Retrieve from all layers in parallel
        const [profile, taskState, recentEvents, summary, semanticResults] = await Promise.all([
          retrieveProfile(budget.profile),
          retrieveTaskState(options.taskId, options.sessionId),
          retrieveRecentEvents(options.sessionId, config, budget.recentEvents),
          retrieveSummary(options.sessionId),
          options.query && config.enableSemanticSearch
            ? retrieveSemantic(options.query, options.sessionId, config, budget.semanticChunks)
            : Promise.resolve([]),
        ]);

        // Check for stale data
        if (taskState && isStale(taskState.updatedAt)) {
          warnings.push({
            type: 'stale',
            message: `Task state may be outdated (last updated: ${new Date(taskState.updatedAt).toISOString()})`,
          });
        }

        // Calculate total tokens
        const totalTokens = estimateBundleTokens({
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
    },
  };
}

