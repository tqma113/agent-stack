/**
 * @agent-stack/memory - Observer
 *
 * Event observation and collection from agent interactions.
 */

import type {
  MemoryEvent,
  EventInput,
  EventType,
  EventEntity,
  EventLink,
  ObserverCallback,
} from './types.js';

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
 * Memory Observer - collects and processes events
 */
export class MemoryObserver {
  private callbacks: Set<ObserverCallback> = new Set();
  private options: Required<ObserverOptions>;

  constructor(options: ObserverOptions = {}) {
    this.options = {
      sessionId: options.sessionId || crypto.randomUUID(),
      autoExtractEntities: options.autoExtractEntities ?? true,
      entityPatterns: options.entityPatterns || DEFAULT_ENTITY_PATTERNS,
    };
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.options.sessionId;
  }

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    this.options.sessionId = sessionId;
  }

  /**
   * Subscribe to events
   */
  subscribe(callback: ObserverCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Notify subscribers of an event
   */
  async notify(event: MemoryEvent): Promise<void> {
    const promises = Array.from(this.callbacks).map(async (callback) => {
      try {
        await callback(event);
      } catch (error) {
        console.error('Observer callback error:', error);
      }
    });
    await Promise.all(promises);
  }

  /**
   * Create a user message event
   */
  createUserMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput {
    return this.createEvent('USER_MSG', {
      content,
      summary: this.truncate(content, 100),
      payload: { content, ...metadata },
    });
  }

  /**
   * Create an assistant message event
   */
  createAssistantMessageEvent(content: string, metadata?: Record<string, unknown>): EventInput {
    return this.createEvent('ASSISTANT_MSG', {
      content,
      summary: this.truncate(content, 100),
      payload: { content, ...metadata },
    });
  }

  /**
   * Create a tool call event
   */
  createToolCallEvent(
    toolName: string,
    args: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): EventInput {
    return this.createEvent('TOOL_CALL', {
      content: `Tool: ${toolName}`,
      summary: `Called ${toolName}`,
      payload: { toolName, args, ...metadata },
      intent: `execute_${toolName}`,
    });
  }

  /**
   * Create a tool result event
   */
  createToolResultEvent(
    toolName: string,
    result: string,
    parentEventId?: string,
    metadata?: Record<string, unknown>
  ): EventInput {
    return this.createEvent('TOOL_RESULT', {
      content: result,
      summary: `Result from ${toolName}: ${this.truncate(result, 80)}`,
      payload: { toolName, result, ...metadata },
      parentId: parentEventId,
    });
  }

  /**
   * Create a decision event
   */
  createDecisionEvent(
    decision: string,
    reasoning?: string,
    metadata?: Record<string, unknown>
  ): EventInput {
    return this.createEvent('DECISION', {
      content: decision,
      summary: decision,
      payload: { decision, reasoning, ...metadata },
      intent: 'decide',
    });
  }

  /**
   * Create a state change event
   */
  createStateChangeEvent(
    fromState: string,
    toState: string,
    reason?: string,
    metadata?: Record<string, unknown>
  ): EventInput {
    return this.createEvent('STATE_CHANGE', {
      content: `${fromState} → ${toState}`,
      summary: `State: ${fromState} → ${toState}`,
      payload: { fromState, toState, reason, ...metadata },
    });
  }

  /**
   * Create a generic event
   */
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
  ): EventInput {
    const entities = this.options.autoExtractEntities
      ? this.extractEntities(options.content)
      : [];

    return {
      type,
      sessionId: this.options.sessionId,
      intent: options.intent,
      entities,
      summary: options.summary,
      payload: options.payload || {},
      links: options.links || [],
      parentId: options.parentId,
      tags: options.tags || [],
    };
  }

  /**
   * Extract entities from content
   */
  extractEntities(content: string): EventEntity[] {
    const entities: EventEntity[] = [];
    const seen = new Set<string>();

    for (const pattern of this.options.entityPatterns) {
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
   * Truncate text to max length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}
