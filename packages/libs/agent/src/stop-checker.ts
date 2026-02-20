/**
 * Stop Condition Checker
 *
 * Provides flexible execution control with multiple stop conditions:
 * - Iteration limits
 * - Token/cost limits
 * - Time limits
 * - Content-based conditions
 * - Custom conditions
 */

import type {
  StopConditions,
  ExecutionContext,
  StopCheckResult,
  ToolCallResult,
} from './types.js';
import { DEFAULT_STOP_CONDITIONS } from './types.js';

/**
 * Instance returned by createStopChecker
 */
export interface StopCheckerInstance {
  /**
   * Check all stop conditions
   * @returns Result indicating whether to stop and why
   */
  check(context: ExecutionContext): Promise<StopCheckResult>;

  /**
   * Handle stop condition result
   * Soft stops can be overridden by callback
   * @returns true if should stop, false if can continue
   */
  handleStop(result: StopCheckResult, context: ExecutionContext): Promise<boolean>;

  /**
   * Get elapsed time since checker was created
   */
  getElapsed(): number;

  /**
   * Update consecutive failure count
   */
  recordFailure(failed: boolean): void;

  /**
   * Get current execution stats
   */
  getStats(): {
    elapsed: number;
    consecutiveFailures: number;
  };
}

/**
 * Create a stop condition checker
 *
 * @example
 * ```typescript
 * const checker = createStopChecker({
 *   maxIterations: 20,
 *   maxCost: 1.00,
 *   pricing: { promptTokenCost: 0.01, completionTokenCost: 0.03 },
 *   onStopCondition: async (result, ctx) => {
 *     console.log(`Stop: ${result.reason}`);
 *     return result.type === 'soft'; // Override soft stops
 *   },
 * });
 *
 * // In agent loop
 * const result = await checker.check(context);
 * if (result.shouldStop && await checker.handleStop(result, context)) {
 *   break;
 * }
 * ```
 */
export function createStopChecker(
  conditions: StopConditions = {}
): StopCheckerInstance {
  const mergedConditions = { ...DEFAULT_STOP_CONDITIONS, ...conditions };
  const startTime = Date.now();
  let consecutiveFailures = 0;

  /**
   * Check all stop conditions
   */
  async function check(context: ExecutionContext): Promise<StopCheckResult> {
    const elapsed = Date.now() - startTime;
    const fullContext: ExecutionContext = { ...context, elapsedMs: elapsed };

    // Calculate cost if pricing configured
    if (mergedConditions.pricing) {
      fullContext.estimatedCost =
        (context.promptTokens / 1000) * mergedConditions.pricing.promptTokenCost +
        (context.completionTokens / 1000) * mergedConditions.pricing.completionTokenCost;
    }

    // Call progress callback
    mergedConditions.onProgress?.(fullContext);

    // Check iteration limit
    if (
      mergedConditions.maxIterations !== undefined &&
      context.iterations >= mergedConditions.maxIterations
    ) {
      return {
        shouldStop: true,
        reason: `Max iterations reached (${mergedConditions.maxIterations})`,
        type: 'soft',
        suggestion: 'pause',
      };
    }

    // Check tool call limit
    if (
      mergedConditions.maxToolCalls !== undefined &&
      context.toolCallCount >= mergedConditions.maxToolCalls
    ) {
      return {
        shouldStop: true,
        reason: `Max tool calls reached (${mergedConditions.maxToolCalls})`,
        type: 'soft',
        suggestion: 'pause',
      };
    }

    // Check token limit
    if (
      mergedConditions.maxTotalTokens !== undefined &&
      context.totalTokens >= mergedConditions.maxTotalTokens
    ) {
      return {
        shouldStop: true,
        reason: `Token limit reached (${context.totalTokens}/${mergedConditions.maxTotalTokens})`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check completion token limit
    if (
      mergedConditions.maxCompletionTokens !== undefined &&
      context.completionTokens >= mergedConditions.maxCompletionTokens
    ) {
      return {
        shouldStop: true,
        reason: `Completion token limit reached (${context.completionTokens}/${mergedConditions.maxCompletionTokens})`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check duration limit
    if (
      mergedConditions.maxDurationMs !== undefined &&
      elapsed >= mergedConditions.maxDurationMs
    ) {
      return {
        shouldStop: true,
        reason: `Time limit reached (${Math.round(elapsed / 1000)}s)`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check cost limit
    if (
      mergedConditions.maxCost !== undefined &&
      fullContext.estimatedCost !== undefined &&
      fullContext.estimatedCost >= mergedConditions.maxCost
    ) {
      return {
        shouldStop: true,
        reason: `Cost limit reached ($${fullContext.estimatedCost.toFixed(4)})`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check stop patterns in last response
    if (mergedConditions.stopPatterns && context.lastResponse) {
      for (const pattern of mergedConditions.stopPatterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        if (regex.test(context.lastResponse)) {
          return {
            shouldStop: true,
            reason: `Stop pattern matched: ${pattern}`,
            type: 'soft',
            suggestion: 'continue',
          };
        }
      }
    }

    // Check stop on specific tools
    if (mergedConditions.stopOnTools && context.toolCalls.length > 0) {
      const lastToolCall = context.toolCalls[context.toolCalls.length - 1];
      if (mergedConditions.stopOnTools.includes(lastToolCall.name)) {
        return {
          shouldStop: true,
          reason: `Stop tool called: ${lastToolCall.name}`,
          type: 'soft',
          suggestion: 'pause',
        };
      }
    }

    // Check consecutive failures
    if (
      mergedConditions.maxConsecutiveFailures !== undefined &&
      consecutiveFailures >= mergedConditions.maxConsecutiveFailures
    ) {
      return {
        shouldStop: true,
        reason: `${consecutiveFailures} consecutive tool failures`,
        type: 'soft',
        suggestion: 'pause',
      };
    }

    // Check custom condition
    if (mergedConditions.customCondition) {
      const result = mergedConditions.customCondition(fullContext);
      if (result === true) {
        return {
          shouldStop: true,
          reason: 'Custom condition triggered',
          type: 'soft',
          suggestion: 'pause',
        };
      }
      if (typeof result === 'object' && result.shouldStop) {
        return result;
      }
    }

    // Check async condition
    if (mergedConditions.asyncCondition) {
      const result = await mergedConditions.asyncCondition(fullContext);
      if (result === true) {
        return {
          shouldStop: true,
          reason: 'Async condition triggered',
          type: 'soft',
          suggestion: 'pause',
        };
      }
      if (typeof result === 'object' && result.shouldStop) {
        return result;
      }
    }

    // No stop condition met
    return { shouldStop: false, type: 'soft' };
  }

  /**
   * Handle stop condition result
   */
  async function handleStop(
    result: StopCheckResult,
    context: ExecutionContext
  ): Promise<boolean> {
    if (!result.shouldStop) return false;

    // Hard stops cannot be overridden
    if (result.type === 'hard') {
      return true;
    }

    // Soft stops can be overridden by callback
    if (mergedConditions.onStopCondition) {
      const override = await mergedConditions.onStopCondition(result, context);
      return !override; // If override returns true, don't stop
    }

    return true;
  }

  /**
   * Record tool execution result for failure tracking
   */
  function recordFailure(failed: boolean): void {
    if (failed) {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0;
    }
  }

  return {
    check,
    handleStop,
    getElapsed: () => Date.now() - startTime,
    recordFailure,
    getStats: () => ({
      elapsed: Date.now() - startTime,
      consecutiveFailures,
    }),
  };
}

/**
 * Create execution context from current state
 */
export function createExecutionContext(params: {
  iterations: number;
  toolCalls: ToolCallResult[];
  promptTokens: number;
  completionTokens: number;
  lastResponse?: string;
  planProgress?: { total: number; completed: number; failed: number };
}): ExecutionContext {
  return {
    iterations: params.iterations,
    toolCalls: params.toolCalls,
    toolCallCount: params.toolCalls.length,
    totalTokens: params.promptTokens + params.completionTokens,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    elapsedMs: 0, // Will be set by checker
    lastResponse: params.lastResponse,
    planProgress: params.planProgress,
  };
}
