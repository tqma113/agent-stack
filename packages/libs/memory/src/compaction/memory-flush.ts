/**
 * @ai-stack/memory - Memory Flush
 *
 * Automatically flushes important memories before context compaction.
 * Triggered when approaching context window limits.
 *
 * Similar to OpenClaw's memoryFlush feature:
 * - Monitors context usage
 * - Triggers flush when soft threshold reached
 * - Extracts and persists durable memories
 */

import type {
  MemoryEvent,
  SemanticChunkInput,
  Summary,
  EventType,
} from '@ai-stack/memory-store-sqlite';

/**
 * Memory flush configuration
 */
export interface MemoryFlushConfig {
  /** Enable memory flush (default: true) */
  enabled: boolean;

  /**
   * Soft threshold in tokens to trigger flush (default: 4000)
   * When context usage exceeds this, flush is triggered
   */
  softThresholdTokens: number;

  /**
   * Hard threshold - force flush at this level (default: 8000)
   * This is the maximum before compaction happens
   */
  hardThresholdTokens: number;

  /**
   * Minimum events since last flush to trigger (default: 5)
   * Avoids flushing too frequently
   */
  minEventsSinceFlush: number;

  /**
   * Event types to include in flush analysis
   */
  eventTypesToAnalyze: EventType[];

  /**
   * Custom flush prompt for LLM-based extraction (optional)
   */
  flushPrompt?: string;

  /**
   * Whether to include a summary in flush (default: true)
   */
  includeSummary: boolean;

  /**
   * Tags to apply to flushed chunks
   */
  flushTags: string[];
}

/**
 * Default memory flush configuration
 */
export const DEFAULT_MEMORY_FLUSH_CONFIG: MemoryFlushConfig = {
  enabled: true,
  softThresholdTokens: 4000,
  hardThresholdTokens: 8000,
  minEventsSinceFlush: 5,
  eventTypesToAnalyze: [
    'USER_MSG',
    'ASSISTANT_MSG',
    'DECISION',
    'TOOL_RESULT',
    'STATE_CHANGE',
  ],
  flushPrompt: undefined,
  includeSummary: true,
  flushTags: ['auto-flush', 'compaction'],
};

/**
 * Flush trigger reasons
 */
export type FlushTriggerReason =
  | 'soft_threshold_exceeded'
  | 'hard_threshold_exceeded'
  | 'manual_trigger'
  | 'session_end';

/**
 * Result of checking if flush is needed
 */
export interface FlushCheckResult {
  /** Whether flush should be triggered */
  shouldFlush: boolean;

  /** Reason for the decision */
  reason: FlushTriggerReason | 'threshold_not_reached' | 'too_few_events' | 'disabled';

  /** Current token usage */
  currentTokens: number;

  /** Threshold that was checked */
  threshold: number;

  /** Events since last flush */
  eventsSinceFlush: number;

  /** Urgency level (0-1, higher = more urgent) */
  urgency: number;
}

/**
 * Content extracted for flushing
 */
export interface FlushContent {
  /** Key decisions made */
  decisions: Array<{
    decision: string;
    reasoning?: string;
    timestamp: number;
  }>;

  /** Important facts learned */
  facts: Array<{
    fact: string;
    source: string;
    confidence: number;
  }>;

  /** Pending todos/tasks */
  todos: Array<{
    description: string;
    priority: 'high' | 'medium' | 'low';
    completed: boolean;
  }>;

  /** User preferences discovered */
  preferences: Array<{
    key: string;
    value: unknown;
    confidence: number;
  }>;

  /** Summary of the session so far */
  summary?: string;

  /** Raw text chunks to persist */
  chunks: SemanticChunkInput[];
}

/**
 * Flush result
 */
export interface FlushResult {
  /** Whether flush was successful */
  success: boolean;

  /** Content that was flushed */
  content: FlushContent;

  /** Number of chunks written */
  chunksWritten: number;

  /** Summary if created */
  summary?: Summary;

  /** Timestamp of flush */
  timestamp: number;

  /** Error if any */
  error?: Error;
}

/**
 * Memory flush state
 */
interface FlushState {
  lastFlushTimestamp: number;
  lastFlushEventCount: number;
  totalEventsSinceFlush: number;
  flushHistory: Array<{
    timestamp: number;
    reason: FlushTriggerReason;
    chunksWritten: number;
  }>;
}

/**
 * Memory Flush instance interface
 */
export interface IMemoryFlush {
  /** Get configuration */
  getConfig(): MemoryFlushConfig;

  /** Update configuration */
  setConfig(config: Partial<MemoryFlushConfig>): void;

  /** Check if flush should be triggered */
  checkFlush(currentTokens: number, eventsSinceFlush: number): FlushCheckResult;

  /** Extract content to flush from events */
  extractFlushContent(
    events: MemoryEvent[],
    options?: {
      sessionId?: string;
      customExtractor?: (events: MemoryEvent[]) => Promise<FlushContent>;
    }
  ): Promise<FlushContent>;

  /** Record that a flush occurred */
  recordFlush(result: FlushResult): void;

  /** Get flush state */
  getState(): FlushState;

  /** Reset flush state (e.g., on new session) */
  resetState(): void;

  /** Get time since last flush in ms */
  getTimeSinceLastFlush(): number;

  /** Calculate urgency score (0-1) */
  calculateUrgency(currentTokens: number): number;
}

/**
 * Extract decisions from events
 */
function extractDecisions(events: MemoryEvent[]): FlushContent['decisions'] {
  return events
    .filter((e) => e.type === 'DECISION')
    .map((e) => ({
      decision: e.summary,
      reasoning: e.payload.reasoning as string | undefined,
      timestamp: e.timestamp,
    }));
}

/**
 * Extract facts from tool results
 */
function extractFacts(events: MemoryEvent[]): FlushContent['facts'] {
  const facts: FlushContent['facts'] = [];

  for (const event of events) {
    if (event.type === 'TOOL_RESULT') {
      const result = event.payload.result;
      if (typeof result === 'string' && result.length > 50) {
        facts.push({
          fact: event.summary,
          source: `tool:${event.payload.toolName || 'unknown'}`,
          confidence: 0.7,
        });
      }
    }
  }

  return facts;
}

/**
 * Extract todos from user messages
 */
function extractTodos(events: MemoryEvent[]): FlushContent['todos'] {
  const todos: FlushContent['todos'] = [];
  const todoPatterns = [
    /(?:please|can you|could you)\s+(.+?)(?:\.|$)/i,
    /(?:don't forget to|remember to)\s+(.+?)(?:\.|$)/i,
    /(?:todo|task):\s*(.+?)(?:\.|$)/i,
  ];

  for (const event of events) {
    if (event.type === 'USER_MSG') {
      const content = String(event.payload.content || '');
      for (const pattern of todoPatterns) {
        const match = content.match(pattern);
        if (match) {
          todos.push({
            description: match[1].trim(),
            priority: 'medium',
            completed: false,
          });
        }
      }
    }
  }

  return todos;
}

/**
 * Extract preferences from user messages
 */
function extractPreferences(events: MemoryEvent[]): FlushContent['preferences'] {
  const preferences: FlushContent['preferences'] = [];
  const preferencePatterns = [
    { pattern: /(?:always|prefer to)\s+use\s+(\w+)/i, key: 'tool_preference' },
    { pattern: /(?:speak|respond|reply)\s+in\s+(\w+)/i, key: 'language' },
    { pattern: /(?:be|more)\s+(concise|brief|detailed|verbose)/i, key: 'verbosity' },
  ];

  for (const event of events) {
    if (event.type === 'USER_MSG') {
      const content = String(event.payload.content || '');
      for (const { pattern, key } of preferencePatterns) {
        const match = content.match(pattern);
        if (match) {
          preferences.push({
            key,
            value: match[1].toLowerCase(),
            confidence: 0.8,
          });
        }
      }
    }
  }

  return preferences;
}

/**
 * Generate summary text from events
 */
function generateSummaryText(events: MemoryEvent[]): string {
  const userMsgs = events.filter((e) => e.type === 'USER_MSG');
  const decisions = events.filter((e) => e.type === 'DECISION');
  const toolCalls = events.filter((e) => e.type === 'TOOL_CALL');

  const parts: string[] = [];

  if (userMsgs.length > 0) {
    parts.push(`User discussed: ${userMsgs.slice(-3).map((e) => e.summary).join('; ')}`);
  }

  if (decisions.length > 0) {
    parts.push(`Decisions made: ${decisions.map((e) => e.summary).join('; ')}`);
  }

  if (toolCalls.length > 0) {
    const toolNames = [...new Set(toolCalls.map((e) => e.payload.toolName))];
    parts.push(`Tools used: ${toolNames.join(', ')}`);
  }

  return parts.join('. ') || 'No significant activity to summarize.';
}

/**
 * Create chunks from flush content
 */
function createChunks(
  content: FlushContent,
  sessionId: string | undefined,
  tags: string[]
): SemanticChunkInput[] {
  const chunks: SemanticChunkInput[] = [];

  // Chunk for decisions
  if (content.decisions.length > 0) {
    chunks.push({
      text: `Decisions: ${content.decisions.map((d) => d.decision).join('; ')}`,
      tags: [...tags, 'decisions'],
      sourceType: 'flush',
      sessionId,
    });
  }

  // Chunk for facts
  if (content.facts.length > 0) {
    chunks.push({
      text: `Facts learned: ${content.facts.map((f) => f.fact).join('; ')}`,
      tags: [...tags, 'facts'],
      sourceType: 'flush',
      sessionId,
    });
  }

  // Chunk for todos
  const pendingTodos = content.todos.filter((t) => !t.completed);
  if (pendingTodos.length > 0) {
    chunks.push({
      text: `Pending tasks: ${pendingTodos.map((t) => t.description).join('; ')}`,
      tags: [...tags, 'todos'],
      sourceType: 'flush',
      sessionId,
    });
  }

  // Chunk for summary
  if (content.summary) {
    chunks.push({
      text: content.summary,
      tags: [...tags, 'summary'],
      sourceType: 'flush',
      sessionId,
    });
  }

  return chunks;
}

/**
 * Create a Memory Flush instance
 */
export function createMemoryFlush(
  initialConfig: Partial<MemoryFlushConfig> = {}
): IMemoryFlush {
  let config: MemoryFlushConfig = { ...DEFAULT_MEMORY_FLUSH_CONFIG, ...initialConfig };

  let state: FlushState = {
    lastFlushTimestamp: 0,
    lastFlushEventCount: 0,
    totalEventsSinceFlush: 0,
    flushHistory: [],
  };

  return {
    getConfig(): MemoryFlushConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<MemoryFlushConfig>): void {
      config = { ...config, ...newConfig };
    },

    checkFlush(currentTokens: number, eventsSinceFlush: number): FlushCheckResult {
      if (!config.enabled) {
        return {
          shouldFlush: false,
          reason: 'disabled',
          currentTokens,
          threshold: config.softThresholdTokens,
          eventsSinceFlush,
          urgency: 0,
        };
      }

      if (eventsSinceFlush < config.minEventsSinceFlush) {
        return {
          shouldFlush: false,
          reason: 'too_few_events',
          currentTokens,
          threshold: config.softThresholdTokens,
          eventsSinceFlush,
          urgency: this.calculateUrgency(currentTokens),
        };
      }

      // Check hard threshold first
      if (currentTokens >= config.hardThresholdTokens) {
        return {
          shouldFlush: true,
          reason: 'hard_threshold_exceeded',
          currentTokens,
          threshold: config.hardThresholdTokens,
          eventsSinceFlush,
          urgency: 1.0,
        };
      }

      // Check soft threshold
      if (currentTokens >= config.softThresholdTokens) {
        return {
          shouldFlush: true,
          reason: 'soft_threshold_exceeded',
          currentTokens,
          threshold: config.softThresholdTokens,
          eventsSinceFlush,
          urgency: this.calculateUrgency(currentTokens),
        };
      }

      return {
        shouldFlush: false,
        reason: 'threshold_not_reached',
        currentTokens,
        threshold: config.softThresholdTokens,
        eventsSinceFlush,
        urgency: this.calculateUrgency(currentTokens),
      };
    },

    async extractFlushContent(
      events: MemoryEvent[],
      options?: {
        sessionId?: string;
        customExtractor?: (events: MemoryEvent[]) => Promise<FlushContent>;
      }
    ): Promise<FlushContent> {
      // Use custom extractor if provided (e.g., LLM-based)
      if (options?.customExtractor) {
        return options.customExtractor(events);
      }

      // Filter events by configured types
      const filteredEvents = events.filter((e) =>
        config.eventTypesToAnalyze.includes(e.type)
      );

      // Extract content using rule-based extraction
      const decisions = extractDecisions(filteredEvents);
      const facts = extractFacts(filteredEvents);
      const todos = extractTodos(filteredEvents);
      const preferences = extractPreferences(filteredEvents);
      const summary = config.includeSummary ? generateSummaryText(filteredEvents) : undefined;

      const content: FlushContent = {
        decisions,
        facts,
        todos,
        preferences,
        summary,
        chunks: [],
      };

      // Create chunks from extracted content
      content.chunks = createChunks(content, options?.sessionId, config.flushTags);

      return content;
    },

    recordFlush(result: FlushResult): void {
      state.lastFlushTimestamp = result.timestamp;
      state.totalEventsSinceFlush = 0;

      state.flushHistory.push({
        timestamp: result.timestamp,
        reason: 'soft_threshold_exceeded', // Default, could be passed in
        chunksWritten: result.chunksWritten,
      });

      // Keep only last 10 flush records
      if (state.flushHistory.length > 10) {
        state.flushHistory = state.flushHistory.slice(-10);
      }
    },

    getState(): FlushState {
      return { ...state };
    },

    resetState(): void {
      state = {
        lastFlushTimestamp: 0,
        lastFlushEventCount: 0,
        totalEventsSinceFlush: 0,
        flushHistory: [],
      };
    },

    getTimeSinceLastFlush(): number {
      if (state.lastFlushTimestamp === 0) {
        return Infinity;
      }
      return Date.now() - state.lastFlushTimestamp;
    },

    calculateUrgency(currentTokens: number): number {
      if (currentTokens >= config.hardThresholdTokens) {
        return 1.0;
      }

      if (currentTokens <= 0) {
        return 0;
      }

      // Linear scale between 0 and soft threshold = 0
      // Between soft and hard threshold = 0.5 to 1.0
      if (currentTokens < config.softThresholdTokens) {
        return (currentTokens / config.softThresholdTokens) * 0.5;
      }

      const range = config.hardThresholdTokens - config.softThresholdTokens;
      const excess = currentTokens - config.softThresholdTokens;
      return 0.5 + (excess / range) * 0.5;
    },
  };
}

/**
 * Default flush prompt for LLM-based extraction
 */
export const DEFAULT_FLUSH_PROMPT = `You are about to reach the context window limit.
Before compaction, please identify and save any important information that should be preserved:

1. Key decisions made in this session
2. Important facts or learnings
3. User preferences or instructions to remember
4. Pending tasks or follow-ups

Format your response as structured JSON with these fields:
- decisions: Array of {decision, reasoning}
- facts: Array of {fact, source}
- todos: Array of {description, priority, completed}
- preferences: Array of {key, value}
- summary: Brief summary of the session

If there's nothing important to save, respond with: NO_FLUSH_NEEDED`;

/**
 * Parse LLM flush response
 */
export function parseLLMFlushResponse(response: string): FlushContent | null {
  if (response.includes('NO_FLUSH_NEEDED')) {
    return null;
  }

  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      decisions: parsed.decisions || [],
      facts: parsed.facts || [],
      todos: parsed.todos || [],
      preferences: parsed.preferences || [],
      summary: parsed.summary,
      chunks: [],
    };
  } catch {
    return null;
  }
}
