/**
 * Task Completion Detector
 *
 * Detects when a task is complete using patterns and/or LLM evaluation.
 * Used by Super Loop to determine intelligent termination.
 */

import type { ExecutionContext, ToolCallResult } from './types.js';

/**
 * Task completion detection result
 */
export interface TaskCompletionResult {
  /** Whether the task appears complete */
  isComplete: boolean;

  /** Confidence level (0-1) */
  confidence: number;

  /** Reason for completion (or lack thereof) */
  reason: string;

  /** Suggestions for next steps if not complete */
  suggestions?: string[];

  /** Detected completion signal (pattern match or LLM assessment) */
  signal?: 'pattern' | 'llm' | 'tool' | 'explicit';
}

/**
 * Task completion detector configuration
 */
export interface TaskCompletionDetectorConfig {
  /**
   * Patterns that indicate task completion
   * @default Common completion phrases
   */
  completionPatterns?: (string | RegExp)[];

  /**
   * Patterns that indicate task is NOT complete
   * @default Common "in progress" phrases
   */
  incompletePatterns?: (string | RegExp)[];

  /**
   * Tools that indicate completion when called
   * @example ['submit', 'deploy', 'publish']
   */
  completionTools?: string[];

  /**
   * Use LLM for completion detection (default: false)
   */
  useLLM?: boolean;

  /**
   * Minimum confidence to consider complete (default: 0.8)
   */
  minConfidence?: number;

  /**
   * Require explicit completion signal (default: false)
   * If true, only considers task complete if explicitly stated
   */
  requireExplicit?: boolean;
}

/**
 * Default completion patterns
 */
export const DEFAULT_COMPLETION_PATTERNS: (string | RegExp)[] = [
  /task\s+(is\s+)?complete[d]?/i,
  /successfully\s+completed/i,
  /done[.!]?\s*$/i,
  /finished\s+(successfully|the\s+task)/i,
  /all\s+(steps|tasks)\s+(are\s+)?complete/i,
  /implementation\s+complete/i,
  /changes\s+(have\s+been\s+)?(applied|made|saved)/i,
  /created\s+successfully/i,
  /deployed\s+successfully/i,
];

/**
 * Default incomplete patterns (indicate task is still in progress)
 */
export const DEFAULT_INCOMPLETE_PATTERNS: (string | RegExp)[] = [
  /let\s+me\s+(continue|proceed|try)/i,
  /next[,]?\s+(i['']?ll|we)/i,
  /working\s+on/i,
  /in\s+progress/i,
  /need\s+to\s+(first|also|additionally)/i,
  /after\s+(that|this)[,]?\s+(i['']?ll|we)/i,
  /attempting\s+to/i,
  /trying\s+to/i,
];

/**
 * Default configuration
 */
export const DEFAULT_TASK_COMPLETION_CONFIG: TaskCompletionDetectorConfig = {
  completionPatterns: DEFAULT_COMPLETION_PATTERNS,
  incompletePatterns: DEFAULT_INCOMPLETE_PATTERNS,
  completionTools: [],
  useLLM: false,
  minConfidence: 0.8,
  requireExplicit: false,
};

/**
 * LLM function type for completion detection
 */
export type CompletionLLMFn = (prompt: string) => Promise<string>;

/**
 * Task completion detector instance
 */
export interface TaskCompletionDetectorInstance {
  /**
   * Detect if task is complete based on response and context
   */
  detect(
    response: string,
    context: TaskCompletionContext
  ): Promise<TaskCompletionResult>;

  /**
   * Check if a specific tool indicates completion
   */
  isCompletionTool(toolName: string): boolean;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TaskCompletionDetectorConfig>): void;
}

/**
 * Context for completion detection
 */
export interface TaskCompletionContext {
  /** Original user request */
  originalRequest: string;

  /** Tool calls made during execution */
  toolCalls: ToolCallResult[];

  /** Current iteration count */
  iterations: number;

  /** Execution context from stop checker */
  executionContext?: ExecutionContext;

  /** Whether this is a follow-up check */
  isFollowUp?: boolean;
}

/**
 * Default LLM prompt for completion detection
 */
export const COMPLETION_DETECTION_PROMPT = `You are analyzing an AI assistant's response to determine if the requested task has been completed.

Original Request:
"""
{{request}}
"""

Assistant's Response:
"""
{{response}}
"""

{{#if toolCalls}}
Tools Used:
{{toolCalls}}
{{/if}}

Analyze whether the task appears to be complete. Consider:
1. Did the assistant accomplish what was requested?
2. Are there remaining steps mentioned but not completed?
3. Does the response indicate success or completion?
4. Are there errors or blockers mentioned?

Respond in JSON format:
{
  "isComplete": true|false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation",
  "suggestions": ["Next step if not complete"]
}

Respond ONLY with the JSON object.`;

/**
 * Create task completion detector
 */
export function createTaskCompletionDetector(
  config: Partial<TaskCompletionDetectorConfig> = {},
  llmChat?: CompletionLLMFn
): TaskCompletionDetectorInstance {
  let currentConfig: TaskCompletionDetectorConfig = {
    ...DEFAULT_TASK_COMPLETION_CONFIG,
    ...config,
    completionPatterns: [
      ...DEFAULT_COMPLETION_PATTERNS,
      ...(config.completionPatterns ?? []),
    ],
    incompletePatterns: [
      ...DEFAULT_INCOMPLETE_PATTERNS,
      ...(config.incompletePatterns ?? []),
    ],
  };

  /**
   * Check patterns in text
   */
  function matchPatterns(
    text: string,
    patterns: (string | RegExp)[]
  ): { matched: boolean; pattern?: string | RegExp } {
    for (const pattern of patterns) {
      const regex =
        typeof pattern === 'string'
          ? new RegExp(pattern, 'i')
          : pattern;

      if (regex.test(text)) {
        return { matched: true, pattern };
      }
    }
    return { matched: false };
  }

  /**
   * Render template with variables
   */
  function renderTemplate(
    template: string,
    vars: Record<string, unknown>
  ): string {
    let result = template;

    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value ?? ''));
    }

    // Handle conditional blocks
    result = result.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_, varName, content) => {
        const value = vars[varName];
        return value ? content : '';
      }
    );

    return result;
  }

  /**
   * Extract JSON from LLM response
   */
  function extractJSON(response: string): string {
    // Try to find JSON in code block
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Try to find raw JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return response.trim();
  }

  return {
    async detect(
      response: string,
      context: TaskCompletionContext
    ): Promise<TaskCompletionResult> {
      // 1. Check completion tools first
      if (currentConfig.completionTools?.length) {
        const completionToolUsed = context.toolCalls.find((tc) =>
          currentConfig.completionTools!.includes(tc.name)
        );

        if (completionToolUsed) {
          return {
            isComplete: true,
            confidence: 0.95,
            reason: `Completion tool "${completionToolUsed.name}" was called`,
            signal: 'tool',
          };
        }
      }

      // 2. Check explicit completion patterns
      const completionMatch = matchPatterns(
        response,
        currentConfig.completionPatterns ?? []
      );

      // 3. Check incomplete patterns
      const incompleteMatch = matchPatterns(
        response,
        currentConfig.incompletePatterns ?? []
      );

      // 4. Rule-based evaluation
      if (completionMatch.matched && !incompleteMatch.matched) {
        const confidence = currentConfig.requireExplicit ? 0.9 : 0.85;
        return {
          isComplete: true,
          confidence,
          reason: `Completion pattern matched: ${completionMatch.pattern}`,
          signal: 'pattern',
        };
      }

      if (incompleteMatch.matched) {
        return {
          isComplete: false,
          confidence: 0.8,
          reason: `Task appears in progress: ${incompleteMatch.pattern}`,
          suggestions: ['Continue with the remaining steps'],
          signal: 'pattern',
        };
      }

      // 5. Use LLM if configured and available
      if (currentConfig.useLLM && llmChat) {
        try {
          const prompt = renderTemplate(COMPLETION_DETECTION_PROMPT, {
            request: context.originalRequest,
            response,
            toolCalls:
              context.toolCalls.length > 0
                ? JSON.stringify(
                    context.toolCalls.map((tc) => ({
                      tool: tc.name,
                      result: tc.result.substring(0, 500),
                    })),
                    null,
                    2
                  )
                : undefined,
          });

          const llmResponse = await llmChat(prompt);
          const jsonStr = extractJSON(llmResponse);

          interface LLMResult {
            isComplete: boolean;
            confidence: number;
            reason: string;
            suggestions?: string[];
          }

          let result: LLMResult;
          try {
            result = JSON.parse(jsonStr);
          } catch {
            // Fallback if parsing fails
            result = {
              isComplete: false,
              confidence: 0.5,
              reason: 'Failed to parse LLM response',
            };
          }

          // Apply minimum confidence threshold
          if (
            result.isComplete &&
            result.confidence < (currentConfig.minConfidence ?? 0.8)
          ) {
            return {
              isComplete: false,
              confidence: result.confidence,
              reason: `Confidence ${result.confidence} below threshold ${currentConfig.minConfidence}`,
              suggestions: result.suggestions,
              signal: 'llm',
            };
          }

          return {
            isComplete: result.isComplete,
            confidence: result.confidence,
            reason: result.reason,
            suggestions: result.suggestions,
            signal: 'llm',
          };
        } catch (error) {
          // Fall back to heuristic if LLM fails
          const err = error instanceof Error ? error.message : String(error);
          return {
            isComplete: false,
            confidence: 0.5,
            reason: `LLM evaluation failed: ${err}`,
            suggestions: ['Manual review recommended'],
          };
        }
      }

      // 6. Heuristic fallback
      const hasToolCalls = context.toolCalls.length > 0;
      const hasSuccessfulTools = context.toolCalls.some(
        (tc) => !tc.result.toLowerCase().includes('error')
      );
      const responseLength = response.length;
      const hasSubstantiveResponse = responseLength > 100;

      // Calculate heuristic confidence
      let confidence = 0.5;
      if (hasSuccessfulTools) confidence += 0.15;
      if (hasSubstantiveResponse) confidence += 0.1;
      if (!incompleteMatch.matched) confidence += 0.1;

      // Conservative: default to not complete unless confident
      const isComplete = confidence >= (currentConfig.minConfidence ?? 0.8);

      return {
        isComplete,
        confidence,
        reason: isComplete
          ? 'Heuristic analysis suggests task completion'
          : 'Unable to confirm task completion',
        suggestions: isComplete
          ? undefined
          : ['Consider reviewing the results manually'],
      };
    },

    isCompletionTool(toolName: string): boolean {
      return (currentConfig.completionTools ?? []).includes(toolName);
    },

    updateConfig(newConfig: Partial<TaskCompletionDetectorConfig>): void {
      currentConfig = {
        ...currentConfig,
        ...newConfig,
        completionPatterns: [
          ...(currentConfig.completionPatterns ?? []),
          ...(newConfig.completionPatterns ?? []),
        ],
        incompletePatterns: [
          ...(currentConfig.incompletePatterns ?? []),
          ...(newConfig.incompletePatterns ?? []),
        ],
      };
    },
  };
}
