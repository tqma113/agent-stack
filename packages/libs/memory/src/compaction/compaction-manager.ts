/**
 * @ai-stack/memory - Compaction Manager
 *
 * Orchestrates memory compaction and flush operations.
 * Integrates with MemoryManager to handle context window limits.
 */

import type {
  MemoryEvent,
  Summary,
  SemanticChunk,
} from '@ai-stack/memory-store-sqlite';
import {
  createMemoryFlush,
  type IMemoryFlush,
  type MemoryFlushConfig,
  type FlushResult,
  type FlushContent,
  DEFAULT_MEMORY_FLUSH_CONFIG,
} from './memory-flush.js';

/**
 * Compaction configuration
 */
export interface CompactionConfig {
  /** Memory flush configuration */
  flush: MemoryFlushConfig;

  /**
   * Maximum context window tokens (default: 128000)
   * Used to calculate when compaction is needed
   */
  maxContextTokens: number;

  /**
   * Reserve tokens for response (default: 4000)
   * Context is considered "full" when: used + reserve >= max
   */
  reserveTokens: number;

  /**
   * Enable automatic compaction (default: true)
   * When enabled, automatically triggers flush at threshold
   */
  autoCompact: boolean;

  /**
   * Callback for LLM-based extraction (optional)
   * If provided, uses LLM to extract important content before compaction
   */
  llmExtractor?: (events: MemoryEvent[], prompt: string) => Promise<string>;

  /**
   * Callback when compaction is triggered
   */
  onCompaction?: (result: CompactionResult) => void | Promise<void>;
}

/**
 * Default compaction configuration
 */
export const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  flush: DEFAULT_MEMORY_FLUSH_CONFIG,
  maxContextTokens: 128000,
  reserveTokens: 4000,
  autoCompact: true,
};

/**
 * Compaction state
 */
export interface CompactionState {
  /** Current token usage estimate */
  currentTokens: number;

  /** Events in current session */
  eventCount: number;

  /** Events since last flush */
  eventsSinceFlush: number;

  /** Whether compaction is currently in progress */
  isCompacting: boolean;

  /** Last compaction result */
  lastCompaction?: CompactionResult;

  /** Compaction history */
  history: Array<{
    timestamp: number;
    tokensBefore: number;
    tokensAfter: number;
    chunksSaved: number;
  }>;
}

/**
 * Compaction result
 */
export interface CompactionResult {
  /** Whether compaction was successful */
  success: boolean;

  /** Tokens before compaction */
  tokensBefore: number;

  /** Tokens after compaction */
  tokensAfter: number;

  /** Content that was flushed */
  flushContent?: FlushContent;

  /** Chunks written to semantic store */
  chunksWritten: SemanticChunk[];

  /** Summary created */
  summary?: Summary;

  /** Events processed */
  eventsProcessed: number;

  /** Timestamp */
  timestamp: number;

  /** Error if any */
  error?: Error;
}

/**
 * Compaction Manager instance interface
 */
export interface ICompactionManager {
  /** Get configuration */
  getConfig(): CompactionConfig;

  /** Update configuration */
  setConfig(config: Partial<CompactionConfig>): void;

  /** Get current state */
  getState(): CompactionState;

  /** Update token count (call after each turn) */
  updateTokenCount(tokens: number): void;

  /** Record an event */
  recordEvent(event: MemoryEvent): void;

  /**
   * Check if compaction should be triggered
   * @returns True if compaction is recommended
   */
  shouldCompact(): boolean;

  /**
   * Check context health
   * @returns Object with health metrics
   */
  checkHealth(): {
    healthy: boolean;
    usage: number;
    remaining: number;
    urgency: number;
    recommendation: 'none' | 'flush_soon' | 'flush_now' | 'critical';
  };

  /**
   * Perform flush operation
   * @param events - Events to flush
   * @param options - Flush options
   */
  performFlush(
    events: MemoryEvent[],
    options?: {
      sessionId?: string;
      force?: boolean;
      reason?: string;
    }
  ): Promise<FlushResult>;

  /**
   * Perform full compaction
   * @param events - Events to process
   * @param options - Compaction options
   */
  compact(
    events: MemoryEvent[],
    options?: {
      sessionId?: string;
      writeChunks?: (chunks: SemanticChunk[]) => Promise<void>;
      createSummary?: (content: FlushContent) => Promise<Summary>;
    }
  ): Promise<CompactionResult>;

  /** Reset state (e.g., on new session) */
  resetState(): void;

  /** Get the underlying flush instance */
  getFlush(): IMemoryFlush;
}

/**
 * Create a Compaction Manager instance
 */
export function createCompactionManager(
  initialConfig: Partial<CompactionConfig> = {}
): ICompactionManager {
  const config: CompactionConfig = {
    ...DEFAULT_COMPACTION_CONFIG,
    ...initialConfig,
    flush: { ...DEFAULT_COMPACTION_CONFIG.flush, ...initialConfig.flush },
  };

  const flush = createMemoryFlush(config.flush);

  let state: CompactionState = {
    currentTokens: 0,
    eventCount: 0,
    eventsSinceFlush: 0,
    isCompacting: false,
    history: [],
  };

  return {
    getConfig(): CompactionConfig {
      return {
        ...config,
        flush: flush.getConfig(),
      };
    },

    setConfig(newConfig: Partial<CompactionConfig>): void {
      Object.assign(config, newConfig);
      if (newConfig.flush) {
        flush.setConfig(newConfig.flush);
      }
    },

    getState(): CompactionState {
      return { ...state };
    },

    updateTokenCount(tokens: number): void {
      state.currentTokens = tokens;
    },

    recordEvent(_event: MemoryEvent): void {
      state.eventCount++;
      state.eventsSinceFlush++;
    },

    shouldCompact(): boolean {
      const available = config.maxContextTokens - config.reserveTokens;
      const flushCheck = flush.checkFlush(state.currentTokens, state.eventsSinceFlush);

      return (
        config.autoCompact &&
        flushCheck.shouldFlush &&
        state.currentTokens >= available * 0.8
      );
    },

    checkHealth(): {
      healthy: boolean;
      usage: number;
      remaining: number;
      urgency: number;
      recommendation: 'none' | 'flush_soon' | 'flush_now' | 'critical';
    } {
      const available = config.maxContextTokens - config.reserveTokens;
      const usage = state.currentTokens / available;
      const remaining = available - state.currentTokens;
      const urgency = flush.calculateUrgency(state.currentTokens);

      let recommendation: 'none' | 'flush_soon' | 'flush_now' | 'critical' = 'none';
      let healthy = true;

      if (usage >= 0.95) {
        recommendation = 'critical';
        healthy = false;
      } else if (usage >= 0.8) {
        recommendation = 'flush_now';
        healthy = false;
      } else if (usage >= 0.6) {
        recommendation = 'flush_soon';
      }

      return {
        healthy,
        usage,
        remaining,
        urgency,
        recommendation,
      };
    },

    async performFlush(
      events: MemoryEvent[],
      options?: {
        sessionId?: string;
        force?: boolean;
        reason?: string;
      }
    ): Promise<FlushResult> {
      // Check if flush is needed (unless forced)
      if (!options?.force) {
        const check = flush.checkFlush(state.currentTokens, state.eventsSinceFlush);
        if (!check.shouldFlush) {
          return {
            success: false,
            content: {
              decisions: [],
              facts: [],
              todos: [],
              preferences: [],
              chunks: [],
            },
            chunksWritten: 0,
            timestamp: Date.now(),
            error: new Error(`Flush not needed: ${check.reason}`),
          };
        }
      }

      try {
        // Extract content
        let content: FlushContent;

        if (config.llmExtractor) {
          // Use LLM-based extraction
          const { DEFAULT_FLUSH_PROMPT, parseLLMFlushResponse } = await import('./memory-flush.js');
          const response = await config.llmExtractor(events, DEFAULT_FLUSH_PROMPT);
          const parsed = parseLLMFlushResponse(response);
          content = parsed || await flush.extractFlushContent(events, {
            sessionId: options?.sessionId,
          });
        } else {
          // Use rule-based extraction
          content = await flush.extractFlushContent(events, {
            sessionId: options?.sessionId,
          });
        }

        const result: FlushResult = {
          success: true,
          content,
          chunksWritten: content.chunks.length,
          timestamp: Date.now(),
        };

        // Record the flush
        flush.recordFlush(result);
        state.eventsSinceFlush = 0;

        return result;
      } catch (error) {
        return {
          success: false,
          content: {
            decisions: [],
            facts: [],
            todos: [],
            preferences: [],
            chunks: [],
          },
          chunksWritten: 0,
          timestamp: Date.now(),
          error: error as Error,
        };
      }
    },

    async compact(
      events: MemoryEvent[],
      options?: {
        sessionId?: string;
        writeChunks?: (chunks: SemanticChunk[]) => Promise<void>;
        createSummary?: (content: FlushContent) => Promise<Summary>;
      }
    ): Promise<CompactionResult> {
      if (state.isCompacting) {
        return {
          success: false,
          tokensBefore: state.currentTokens,
          tokensAfter: state.currentTokens,
          chunksWritten: [],
          eventsProcessed: 0,
          timestamp: Date.now(),
          error: new Error('Compaction already in progress'),
        };
      }

      state.isCompacting = true;
      const tokensBefore = state.currentTokens;

      try {
        // Perform flush
        const flushResult = await this.performFlush(events, {
          sessionId: options?.sessionId,
          force: true,
          reason: 'compaction',
        });

        if (!flushResult.success) {
          throw flushResult.error || new Error('Flush failed');
        }

        const chunksWritten: SemanticChunk[] = [];

        // Write chunks if handler provided
        if (options?.writeChunks && flushResult.content.chunks.length > 0) {
          // Note: writeChunks should return the created chunks
          // For now we assume it handles the writing
          await options.writeChunks(flushResult.content.chunks as SemanticChunk[]);
        }

        // Create summary if handler provided
        let summary: Summary | undefined;
        if (options?.createSummary && flushResult.content) {
          summary = await options.createSummary(flushResult.content);
        }

        // Estimate new token count (assumes ~50% reduction after compaction)
        const tokensAfter = Math.floor(tokensBefore * 0.5);
        state.currentTokens = tokensAfter;

        const result: CompactionResult = {
          success: true,
          tokensBefore,
          tokensAfter,
          flushContent: flushResult.content,
          chunksWritten,
          summary,
          eventsProcessed: events.length,
          timestamp: Date.now(),
        };

        // Record in history
        state.history.push({
          timestamp: result.timestamp,
          tokensBefore,
          tokensAfter,
          chunksSaved: chunksWritten.length,
        });

        // Keep only last 10 compactions
        if (state.history.length > 10) {
          state.history = state.history.slice(-10);
        }

        state.lastCompaction = result;

        // Notify callback
        if (config.onCompaction) {
          await config.onCompaction(result);
        }

        return result;
      } catch (error) {
        return {
          success: false,
          tokensBefore,
          tokensAfter: tokensBefore,
          chunksWritten: [],
          eventsProcessed: 0,
          timestamp: Date.now(),
          error: error as Error,
        };
      } finally {
        state.isCompacting = false;
      }
    },

    resetState(): void {
      state = {
        currentTokens: 0,
        eventCount: 0,
        eventsSinceFlush: 0,
        isCompacting: false,
        history: [],
      };
      flush.resetState();
    },

    getFlush(): IMemoryFlush {
      return flush;
    },
  };
}
