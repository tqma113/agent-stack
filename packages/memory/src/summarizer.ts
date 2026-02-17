/**
 * @agent-stack/memory - Summarizer
 *
 * Conversation and event summarization for context compression.
 */

import type {
  MemoryEvent,
  Summary,
  SummaryInput,
  SummaryDecision,
  SummaryTodo,
  UUID,
} from './types.js';

/**
 * Summarizer options
 */
export interface SummarizerOptions {
  /** Maximum bullets in summary */
  maxBullets?: number;

  /** Maximum decisions to track */
  maxDecisions?: number;

  /** Maximum todos to track */
  maxTodos?: number;

  /** Custom summarization function (for LLM integration) */
  summarizeFunction?: (events: MemoryEvent[]) => Promise<SummaryResult>;
}

/**
 * Summarization result from LLM or rule-based extraction
 */
export interface SummaryResult {
  short: string;
  bullets: string[];
  decisions: SummaryDecision[];
  todos: SummaryTodo[];
}

/**
 * Default summarizer options
 */
const DEFAULT_OPTIONS: Required<Omit<SummarizerOptions, 'summarizeFunction'>> = {
  maxBullets: 10,
  maxDecisions: 5,
  maxTodos: 10,
};

/**
 * Memory Summarizer instance interface
 */
export interface IMemorySummarizer {
  /** Summarize a list of events */
  summarize(
    events: MemoryEvent[],
    sessionId: string,
    previousSummary?: Summary
  ): Promise<SummaryInput>;

  /** Mark todos as completed based on events */
  markTodosCompleted(todos: SummaryTodo[], events: MemoryEvent[]): SummaryTodo[];

  /** Merge two summaries, combining their content */
  mergeSummaries(older: Summary, newer: Summary): SummaryResult;

  /** Set custom summarization function for LLM integration */
  setSummarizeFunction(fn: (events: MemoryEvent[]) => Promise<SummaryResult>): void;

  /** Create LLM summarization prompt */
  createLLMPrompt(events: MemoryEvent[]): string;
}

/**
 * Check if tool call is significant enough to include
 */
function isSignificantToolCall(event: MemoryEvent): boolean {
  const toolName = event.payload.toolName as string;

  // File operations, searches, and external calls are significant
  const significantPatterns = [
    /read|write|create|delete|modify/i,
    /search|find|query/i,
    /api|fetch|request/i,
    /execute|run|shell/i,
  ];

  return significantPatterns.some((p) => p.test(toolName));
}

/**
 * Check if user message is significant
 */
function isSignificantUserMessage(event: MemoryEvent): boolean {
  const content = String(event.payload.content || '');

  // Short messages or simple confirmations are not significant
  if (content.length < 20) return false;
  if (/^(yes|no|ok|okay|sure|thanks|thank you)\.?$/i.test(content.trim())) return false;

  return true;
}

/**
 * Check if assistant message contains a conclusion
 */
function containsConclusion(event: MemoryEvent): boolean {
  const content = String(event.payload.content || '').toLowerCase();

  const conclusionPatterns = [
    /in conclusion/i,
    /to summarize/i,
    /the result is/i,
    /successfully (completed|created|updated|deleted)/i,
    /here('s| is) (the|your)/i,
  ];

  return conclusionPatterns.some((p) => p.test(content));
}

/**
 * Extract todos from user message
 */
function extractTodos(event: MemoryEvent): SummaryTodo[] {
  const content = String(event.payload.content || '');
  const todos: SummaryTodo[] = [];

  // Common todo patterns
  const todoPatterns = [
    /(?:please|can you|could you|i need you to|i want you to)\s+(.+?)(?:\.|$)/gi,
    /(?:todo|task|action item):\s*(.+?)(?:\.|$)/gi,
    /(?:don't forget to|remember to|make sure to)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of todoPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const description = match[1].trim();
      if (description.length > 5 && description.length < 200) {
        todos.push({
          description,
          completed: false,
        });
      }
    }
  }

  return todos;
}

/**
 * Generate a short one-line summary
 */
function generateShortSummary(
  events: MemoryEvent[],
  decisions: SummaryDecision[],
  todos: SummaryTodo[]
): string {
  const parts: string[] = [];

  // Count event types
  const userMsgs = events.filter((e) => e.type === 'USER_MSG').length;
  const toolCalls = events.filter((e) => e.type === 'TOOL_CALL').length;

  if (userMsgs > 0) {
    parts.push(`${userMsgs} message${userMsgs > 1 ? 's' : ''}`);
  }

  if (toolCalls > 0) {
    parts.push(`${toolCalls} tool call${toolCalls > 1 ? 's' : ''}`);
  }

  if (decisions.length > 0) {
    parts.push(`${decisions.length} decision${decisions.length > 1 ? 's' : ''}`);
  }

  const pendingTodos = todos.filter((t) => !t.completed).length;
  if (pendingTodos > 0) {
    parts.push(`${pendingTodos} pending todo${pendingTodos > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return 'Session with no significant events';
  }

  return `Session: ${parts.join(', ')}`;
}

/**
 * Create a Memory Summarizer instance
 */
export function createMemorySummarizer(options: SummarizerOptions = {}): IMemorySummarizer {
  // Private state via closure
  const config: Required<Omit<SummarizerOptions, 'summarizeFunction'>> & {
    summarizeFunction?: SummarizerOptions['summarizeFunction'];
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  /**
   * Rule-based summary extraction
   */
  function extractSummary(events: MemoryEvent[], previousSummary?: Summary): SummaryResult {
    const bullets: string[] = [];
    const decisions: SummaryDecision[] = [];
    const todos: SummaryTodo[] = [];

    // Carry over incomplete todos from previous summary
    if (previousSummary) {
      for (const todo of previousSummary.todos) {
        if (!todo.completed) {
          todos.push(todo);
        }
      }
    }

    // Process events
    for (const event of events) {
      switch (event.type) {
        case 'DECISION':
          decisions.push({
            description: event.summary,
            reasoning: event.payload.reasoning as string | undefined,
            timestamp: event.timestamp,
            sourceEventId: event.id,
          });
          bullets.push(`Decision: ${event.summary}`);
          break;

        case 'STATE_CHANGE':
          bullets.push(`State change: ${event.summary}`);
          break;

        case 'TOOL_CALL':
          // Only include significant tool calls
          if (isSignificantToolCall(event)) {
            bullets.push(`Tool: ${event.payload.toolName}`);
          }
          break;

        case 'USER_MSG':
          // Extract todos from user messages
          const extractedTodos = extractTodos(event);
          todos.push(...extractedTodos);

          // Add significant user requests to bullets
          if (isSignificantUserMessage(event)) {
            bullets.push(`User: ${event.summary}`);
          }
          break;

        case 'ASSISTANT_MSG':
          // Only add very significant assistant messages
          if (event.payload.hasToolCalls || containsConclusion(event)) {
            bullets.push(`Assistant: ${event.summary}`);
          }
          break;
      }
    }

    // Generate short summary
    const short = generateShortSummary(events, decisions, todos);

    // Trim to limits
    return {
      short,
      bullets: bullets.slice(-config.maxBullets),
      decisions: decisions.slice(-config.maxDecisions),
      todos: todos.slice(0, config.maxTodos),
    };
  }

  /**
   * Build SummaryInput from result
   */
  function buildSummaryInput(
    result: SummaryResult,
    events: MemoryEvent[],
    sessionId: string,
    previousSummary?: Summary
  ): SummaryInput {
    // Collect covered event IDs
    const coveredEventIds: UUID[] = events.map((e) => e.id);

    // Include previous summary's covered events if merging
    if (previousSummary) {
      coveredEventIds.push(...previousSummary.coveredEventIds);
    }

    return {
      sessionId,
      short: result.short,
      bullets: result.bullets,
      decisions: result.decisions,
      todos: result.todos,
      coveredEventIds,
    };
  }

  // Return the instance object
  return {
    async summarize(
      events: MemoryEvent[],
      sessionId: string,
      previousSummary?: Summary
    ): Promise<SummaryInput> {
      // If custom summarization function provided, use it
      if (config.summarizeFunction) {
        const result = await config.summarizeFunction(events);
        return buildSummaryInput(result, events, sessionId, previousSummary);
      }

      // Otherwise, use rule-based extraction
      const result = extractSummary(events, previousSummary);
      return buildSummaryInput(result, events, sessionId, previousSummary);
    },

    markTodosCompleted(todos: SummaryTodo[], events: MemoryEvent[]): SummaryTodo[] {
      // Get all assistant messages and tool results
      const completionIndicators = events
        .filter((e) => e.type === 'ASSISTANT_MSG' || e.type === 'TOOL_RESULT')
        .map((e) => String(e.payload.content || e.payload.result || '').toLowerCase());

      return todos.map((todo) => {
        if (todo.completed) return todo;

        // Check if any completion indicator matches the todo
        const todoKeywords = todo.description.toLowerCase().split(/\s+/);
        const isCompleted = completionIndicators.some((indicator) =>
          todoKeywords.some(
            (keyword) => keyword.length > 3 && indicator.includes(keyword)
          )
        );

        return isCompleted ? { ...todo, completed: true } : todo;
      });
    },

    mergeSummaries(older: Summary, newer: Summary): SummaryResult {
      // Combine bullets, prioritizing newer
      const combinedBullets = [
        ...older.bullets.slice(-Math.floor(config.maxBullets / 2)),
        ...newer.bullets,
      ].slice(-config.maxBullets);

      // Combine decisions, prioritizing newer
      const combinedDecisions = [
        ...older.decisions.slice(-Math.floor(config.maxDecisions / 2)),
        ...newer.decisions,
      ].slice(-config.maxDecisions);

      // Combine todos - carry over incomplete from older, add all from newer
      const incompleteTodos = older.todos.filter((t) => !t.completed);
      const combinedTodos = [...incompleteTodos, ...newer.todos].slice(0, config.maxTodos);

      // Merge short summaries
      const short = `${older.short} -> ${newer.short}`;

      return {
        short,
        bullets: combinedBullets,
        decisions: combinedDecisions,
        todos: combinedTodos,
      };
    },

    setSummarizeFunction(fn: (events: MemoryEvent[]) => Promise<SummaryResult>): void {
      config.summarizeFunction = fn;
    },

    createLLMPrompt(events: MemoryEvent[]): string {
      const eventTexts = events.map((e) => {
        switch (e.type) {
          case 'USER_MSG':
            return `User: ${e.summary}`;
          case 'ASSISTANT_MSG':
            return `Assistant: ${e.summary}`;
          case 'TOOL_CALL':
            return `Tool Call: ${e.payload.toolName}`;
          case 'TOOL_RESULT':
            return `Tool Result: ${e.summary}`;
          case 'DECISION':
            return `Decision: ${e.summary}`;
          case 'STATE_CHANGE':
            return `State Change: ${e.summary}`;
          default:
            return e.summary;
        }
      });

      return `Please summarize the following conversation events into a structured summary:

${eventTexts.join('\n')}

Provide:
1. A short one-line summary
2. Key bullet points (max ${config.maxBullets})
3. Important decisions made (max ${config.maxDecisions})
4. Pending action items/todos (max ${config.maxTodos})

Format your response as JSON:
{
  "short": "one line summary",
  "bullets": ["bullet 1", "bullet 2"],
  "decisions": [{"description": "decision", "reasoning": "why"}],
  "todos": [{"description": "todo item", "completed": false}]
}`;
    },
  };
}

