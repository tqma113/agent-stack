/**
 * @ai-stack/memory - Observer
 *
 * Event observation and collection from agent interactions.
 */

import type {
  MemoryEvent,
  EventInput,
  EventType,
  EventEntity,
  EventLink,
} from '@ai-stack/memory-store-sqlite';
import type { ObserverCallback } from './types.js';

/**
 * Observer options
 */
export interface ObserverOptions {
  /** Default session ID */
  sessionId?: string;

  /** Auto-extract entities from content */
  autoExtractEntities?: boolean;

  /** Entity extraction patterns */
  entityPatterns?: EntityPattern[];
}

/**
 * Entity extraction pattern
 */
export interface EntityPattern {
  type: string;
  pattern: RegExp;
  transform?: (match: string) => string;
}

/**
 * Default entity patterns
 */
export const DEFAULT_ENTITY_PATTERNS: EntityPattern[] = [
  // File paths
  {
    type: 'file',
    pattern: /(?:^|[\s"'`])([./]?(?:[\w-]+\/)*[\w.-]+\.[a-zA-Z]{1,10})(?:[\s"'`]|$)/g,
    transform: (m) => m.trim(),
  },
  // URLs
  {
    type: 'url',
    pattern: /https?:\/\/[^\s<>"']+/g,
  },
  // Function/method names (camelCase or snake_case followed by parentheses)
  {
    type: 'function',
    pattern: /\b([a-z][a-zA-Z0-9]*|[a-z][a-z0-9_]*)\s*\(/g,
    transform: (m) => m.replace(/\s*\($/, ''),
  },
  // Class names (PascalCase)
  {
    type: 'class',
    pattern: /\b([A-Z][a-zA-Z0-9]+)(?:\s|\.)/g,
    transform: (m) => m.trim().replace(/[.\s]$/, ''),
  },
];

/**
 * Memory Observer instance interface
 */
export interface IMemoryObserver {
  /** Get current session ID */
  getSessionId(): string;

  /** Set session ID */
  setSessionId(sessionId: string): void;

  /** Subscribe to events */
  subscribe(callback: ObserverCallback): () => void;

  /** Notify subscribers of an event */
  notify(event: MemoryEvent): Promise<void>;

  /** Create a user message event */
  createUserMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput;

  /** Create an assistant message event */
  createAssistantMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput;

  /** Create a tool call event */
  createToolCallEvent(
    toolName: string,
    args: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): EventInput;

  /** Create a tool result event */
  createToolResultEvent(
    toolName: string,
    result: string,
    parentEventId?: string,
    metadata?: Record<string, unknown>
  ): EventInput;

  /** Create a decision event */
  createDecisionEvent(
    decision: string,
    reasoning?: string,
    metadata?: Record<string, unknown>
  ): EventInput;

  /** Create a state change event */
  createStateChangeEvent(
    fromState: string,
    toState: string,
    reason?: string,
    metadata?: Record<string, unknown>
  ): EventInput;

  /** Create a generic event */
  createEvent(
    type: EventType,
    options: {
      content: string;
      summary: string;
      payload?: Record<string, unknown>;
      intent?: string;
      parentId?: string;
      links?: EventLink[];
      tags?: string[];
    }
  ): EventInput;

  /** Extract entities from content */
  extractEntities(content: string): EventEntity[];
}

/**
 * Truncate text to max length
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a Memory Observer instance
 */
export function createMemoryObserver(options: ObserverOptions = {}): IMemoryObserver {
  // Private state via closure
  const callbacks: Set<ObserverCallback> = new Set();
  const config: Required<ObserverOptions> = {
    sessionId: options.sessionId || crypto.randomUUID(),
    autoExtractEntities: options.autoExtractEntities ?? true,
    entityPatterns: options.entityPatterns || DEFAULT_ENTITY_PATTERNS,
  };

  /**
   * Extract entities from content
   */
  function extractEntities(content: string): EventEntity[] {
    const entities: EventEntity[] = [];
    const seen = new Set<string>();

    for (const pattern of config.entityPatterns) {
      const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        let value = match[1] || match[0];
        if (pattern.transform) {
          value = pattern.transform(value);
        }

        const key = `${pattern.type}:${value}`;
        if (!seen.has(key) && value.length > 1) {
          seen.add(key);
          entities.push({
            type: pattern.type,
            value,
          });
        }
      }
    }

    return entities;
  }

  /**
   * Create a generic event
   */
  function createEvent(
    type: EventType,
    eventOptions: {
      content: string;
      summary: string;
      payload?: Record<string, unknown>;
      intent?: string;
      parentId?: string;
      links?: EventLink[];
      tags?: string[];
    }
  ): EventInput {
    const entities = config.autoExtractEntities
      ? extractEntities(eventOptions.content)
      : [];

    return {
      type,
      sessionId: config.sessionId,
      intent: eventOptions.intent,
      entities,
      summary: eventOptions.summary,
      payload: eventOptions.payload || {},
      links: eventOptions.links || [],
      parentId: eventOptions.parentId,
      tags: eventOptions.tags || [],
    };
  }

  // Return the instance object
  return {
    getSessionId(): string {
      return config.sessionId;
    },

    setSessionId(sessionId: string): void {
      config.sessionId = sessionId;
    },

    subscribe(callback: ObserverCallback): () => void {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },

    async notify(event: MemoryEvent): Promise<void> {
      const promises = Array.from(callbacks).map(async (callback) => {
        try {
          await callback(event);
        } catch (error) {
          console.error('Observer callback error:', error);
        }
      });
      await Promise.all(promises);
    },

    createUserMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput {
      return createEvent('USER_MSG', {
        content,
        summary: truncate(content, 100),
        payload: { content, ...metadata },
      });
    },

    createAssistantMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput {
      return createEvent('ASSISTANT_MSG', {
        content,
        summary: truncate(content, 100),
        payload: { content, ...metadata },
      });
    },

    createToolCallEvent(
      toolName: string,
      args: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ): EventInput {
      return createEvent('TOOL_CALL', {
        content: `Tool: ${toolName}`,
        summary: `Called ${toolName}`,
        payload: { toolName, args, ...metadata },
        intent: `execute_${toolName}`,
      });
    },

    createToolResultEvent(
      toolName: string,
      result: string,
      parentEventId?: string,
      metadata?: Record<string, unknown>
    ): EventInput {
      return createEvent('TOOL_RESULT', {
        content: result,
        summary: `Result from ${toolName}: ${truncate(result, 80)}`,
        payload: { toolName, result, ...metadata },
        parentId: parentEventId,
      });
    },

    createDecisionEvent(
      decision: string,
      reasoning?: string,
      metadata?: Record<string, unknown>
    ): EventInput {
      return createEvent('DECISION', {
        content: decision,
        summary: decision,
        payload: { decision, reasoning, ...metadata },
        intent: 'decide',
      });
    },

    createStateChangeEvent(
      fromState: string,
      toState: string,
      reason?: string,
      metadata?: Record<string, unknown>
    ): EventInput {
      return createEvent('STATE_CHANGE', {
        content: `${fromState} → ${toState}`,
        summary: `State: ${fromState} → ${toState}`,
        payload: { fromState, toState, reason, ...metadata },
      });
    },

    createEvent,

    extractEntities,
  };
}

