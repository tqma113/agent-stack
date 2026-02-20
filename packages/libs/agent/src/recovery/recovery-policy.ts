/**
 * @ai-stack/agent - Recovery Policy Implementation
 *
 * Provides error recovery strategies with configurable
 * backoff algorithms and circuit breaker support.
 */

import type {
  RecoveryPolicyConfig,
  RecoveryContext,
  RecoveryAction,
  BackoffStrategy,
  ErrorCategory,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitState,
} from './types.js';
import {
  DEFAULT_RECOVERY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  ERROR_PATTERNS,
} from './types.js';

// =============================================================================
// Recovery Policy Instance Interface
// =============================================================================

/**
 * Recovery policy instance interface
 */
export interface RecoveryPolicyInstance {
  /**
   * Execute operation with recovery strategy
   *
   * @param operation - Operation name for logging
   * @param fn - Async function to execute
   * @param options - Optional execution options
   * @returns Result of successful execution
   * @throws Last error if all retries exhausted
   */
  execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: { args?: Record<string, unknown>; metadata?: Record<string, unknown> }
  ): Promise<T>;

  /**
   * Calculate delay for given attempt number
   */
  getDelay(attempt: number): number;

  /**
   * Check if error is retryable
   */
  isRetryable(error: Error): boolean;

  /**
   * Classify error category
   */
  classifyError(error: Error): ErrorCategory;

  /**
   * Get circuit breaker state (if enabled)
   */
  getCircuitState(): CircuitBreakerState | null;

  /**
   * Manually reset circuit breaker
   */
  resetCircuit(): void;

  /**
   * Reset all state (retry counts, circuit breaker)
   */
  reset(): void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate Fibonacci number
 */
function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0;
  let b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

/**
 * Sleep for given milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Apply jitter to delay
 */
function applyJitter(delay: number, factor: number): number {
  const jitter = delay * factor * (Math.random() * 2 - 1);
  return Math.max(0, delay + jitter);
}

// =============================================================================
// Recovery Policy Factory
// =============================================================================

/**
 * Create recovery policy instance
 */
export function createRecoveryPolicy(
  config: RecoveryPolicyConfig = {}
): RecoveryPolicyInstance {
  const {
    maxRetries = DEFAULT_RECOVERY_CONFIG.maxRetries,
    backoffStrategy = DEFAULT_RECOVERY_CONFIG.backoffStrategy,
    initialDelayMs = DEFAULT_RECOVERY_CONFIG.initialDelayMs,
    maxDelayMs = DEFAULT_RECOVERY_CONFIG.maxDelayMs,
    jitterFactor = DEFAULT_RECOVERY_CONFIG.jitterFactor,
    retryableErrors = [],
    retryablePatterns = [],
    retryableCategories = DEFAULT_RECOVERY_CONFIG.retryableCategories,
    errorClassifier,
    onError,
    beforeRetry,
    afterRetry,
    onExhausted,
    onRecovered,
    totalTimeoutMs,
    backoffFn,
  } = config;

  // Circuit breaker state
  let circuitState: CircuitBreakerState | null = null;
  if (config.circuitBreaker) {
    const cbConfig: Required<CircuitBreakerConfig> = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config.circuitBreaker,
    };
    circuitState = {
      state: 'closed',
      failures: 0,
      successes: 0,
    };

    // Store config on state for later use
    (circuitState as CircuitBreakerState & { config: Required<CircuitBreakerConfig> }).config = cbConfig;
  }

  /**
   * Calculate delay for given attempt
   */
  function getDelay(attempt: number): number {
    let delay: number;

    switch (backoffStrategy) {
      case 'none':
        delay = 0;
        break;
      case 'fixed':
        delay = initialDelayMs;
        break;
      case 'linear':
        delay = initialDelayMs * attempt;
        break;
      case 'exponential':
        delay = initialDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'fibonacci':
        delay = initialDelayMs * fibonacci(attempt);
        break;
      case 'custom':
        if (backoffFn) {
          delay = backoffFn(attempt, initialDelayMs);
        } else {
          delay = initialDelayMs;
        }
        break;
      default:
        delay = initialDelayMs;
    }

    // Apply jitter and cap at max
    delay = applyJitter(delay, jitterFactor);
    return Math.min(delay, maxDelayMs);
  }

  /**
   * Classify error into category
   */
  function classifyError(error: Error): ErrorCategory {
    // Use custom classifier if provided
    if (errorClassifier) {
      return errorClassifier(error);
    }

    const message = error.message || '';
    const name = error.name || '';
    const combined = `${name}: ${message}`;

    // Check patterns for each category
    for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (category === 'unknown') continue;
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return category as ErrorCategory;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Check if error is retryable
   */
  function isRetryable(error: Error): boolean {
    // Check error class
    for (const ErrorClass of retryableErrors) {
      if (error instanceof ErrorClass) {
        return true;
      }
    }

    // Check patterns
    const message = error.message || '';
    for (const pattern of retryablePatterns) {
      if (pattern.test(message)) {
        return true;
      }
    }

    // Check category
    const category = classifyError(error);
    if (retryableCategories.includes(category)) {
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker on failure
   */
  function recordFailure(): void {
    if (!circuitState) return;

    const cbConfig = (circuitState as CircuitBreakerState & { config: Required<CircuitBreakerConfig> }).config;
    const now = Date.now();

    // Clean up old failures outside window
    if (circuitState.lastFailureAt &&
        now - circuitState.lastFailureAt > cbConfig.failureWindowMs) {
      circuitState.failures = 0;
    }

    circuitState.failures++;
    circuitState.lastFailureAt = now;
    circuitState.successes = 0;

    // Check if should open circuit
    if (circuitState.state === 'closed' &&
        circuitState.failures >= cbConfig.failureThreshold) {
      circuitState.state = 'open';
      circuitState.openedAt = now;
    } else if (circuitState.state === 'half-open') {
      // Failure in half-open state reopens circuit
      circuitState.state = 'open';
      circuitState.openedAt = now;
    }
  }

  /**
   * Update circuit breaker on success
   */
  function recordSuccess(): void {
    if (!circuitState) return;

    const cbConfig = (circuitState as CircuitBreakerState & { config: Required<CircuitBreakerConfig> }).config;

    if (circuitState.state === 'half-open') {
      circuitState.successes++;
      if (circuitState.successes >= cbConfig.successThreshold) {
        // Close circuit after enough successes
        circuitState.state = 'closed';
        circuitState.failures = 0;
        circuitState.successes = 0;
      }
    } else if (circuitState.state === 'closed') {
      // Reset failure count on success
      circuitState.failures = 0;
    }
  }

  /**
   * Check circuit breaker state
   */
  function checkCircuit(): boolean {
    if (!circuitState) return true;

    const cbConfig = (circuitState as CircuitBreakerState & { config: Required<CircuitBreakerConfig> }).config;
    const now = Date.now();

    if (circuitState.state === 'open') {
      // Check if timeout has passed
      if (circuitState.openedAt &&
          now - circuitState.openedAt >= cbConfig.resetTimeoutMs) {
        circuitState.state = 'half-open';
        circuitState.successes = 0;
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Execute with recovery
   */
  async function execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { args?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}
  ): Promise<T> {
    const firstAttemptAt = Date.now();
    const previousErrors: Error[] = [];
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      // Check total timeout
      const elapsed = Date.now() - firstAttemptAt;
      if (totalTimeoutMs && elapsed >= totalTimeoutMs) {
        throw lastError ?? new Error(`Total timeout exceeded: ${totalTimeoutMs}ms`);
      }

      // Check circuit breaker
      if (!checkCircuit()) {
        throw new Error('Circuit breaker is open');
      }

      try {
        const result = await fn();
        recordSuccess();

        // Notify recovery if this wasn't the first attempt
        if (attempt > 1) {
          onRecovered?.({
            error: lastError!,
            attempt,
            maxRetries,
            operation,
            args: options.args,
            totalElapsedMs: Date.now() - firstAttemptAt,
            firstAttemptAt,
            previousErrors,
            metadata: options.metadata,
          });
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        previousErrors.push(lastError);
        recordFailure();

        const context: RecoveryContext = {
          error: lastError,
          attempt,
          maxRetries,
          operation,
          args: options.args,
          totalElapsedMs: Date.now() - firstAttemptAt,
          firstAttemptAt,
          previousErrors: previousErrors.slice(0, -1),
          metadata: options.metadata,
        };

        // Check if retries exhausted
        if (attempt > maxRetries) {
          onExhausted?.(context);
          throw lastError;
        }

        // Check if error is retryable
        if (!isRetryable(lastError)) {
          throw lastError;
        }

        // Custom error handler
        if (onError) {
          const action = await Promise.resolve(onError(context));
          switch (action.action) {
            case 'abort':
              throw new Error(`Aborted: ${action.reason}`);
            case 'skip':
              return undefined as T;
            case 'fallback':
              return (await action.fallbackFn()) as T;
            case 'checkpoint_restore':
              throw new Error(`Checkpoint restore requires state machine: ${action.checkpointId}`);
            case 'escalate':
              throw new Error(`Escalated to ${action.to}: ${lastError.message}`);
            case 'retry':
            case 'retry_with_backoff':
              // Continue with retry
              break;
          }
        }

        // Before retry callback
        await beforeRetry?.(context);

        // Wait for backoff delay
        const delay = getDelay(attempt);
        if (delay > 0) {
          await sleep(delay);
        }

        // After retry callback
        afterRetry?.(context, false);
      }
    }

    throw lastError!;
  }

  return {
    execute,
    getDelay,
    isRetryable,
    classifyError,

    getCircuitState(): CircuitBreakerState | null {
      if (!circuitState) return null;
      return {
        state: circuitState.state,
        failures: circuitState.failures,
        successes: circuitState.successes,
        lastFailureAt: circuitState.lastFailureAt,
        openedAt: circuitState.openedAt,
      };
    },

    resetCircuit(): void {
      if (circuitState) {
        circuitState.state = 'closed';
        circuitState.failures = 0;
        circuitState.successes = 0;
        circuitState.lastFailureAt = undefined;
        circuitState.openedAt = undefined;
      }
    },

    reset(): void {
      this.resetCircuit();
    },
  };
}

// =============================================================================
// Convenience Factories
// =============================================================================

/**
 * Create recovery policy optimized for API calls
 */
export function createApiRecoveryPolicy(
  options: Partial<RecoveryPolicyConfig> = {}
): RecoveryPolicyInstance {
  return createRecoveryPolicy({
    maxRetries: 3,
    backoffStrategy: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    retryablePatterns: [
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /rate.?limit/i,
      /429/,
      /503/,
      /502/,
    ],
    ...options,
  });
}

/**
 * Create recovery policy optimized for tool execution
 */
export function createToolRecoveryPolicy(
  options: Partial<RecoveryPolicyConfig> = {}
): RecoveryPolicyInstance {
  return createRecoveryPolicy({
    maxRetries: 2,
    backoffStrategy: 'linear',
    initialDelayMs: 500,
    maxDelayMs: 5000,
    retryableCategories: ['transient', 'timeout'],
    ...options,
  });
}

/**
 * Create recovery policy with circuit breaker
 */
export function createResilientRecoveryPolicy(
  options: Partial<RecoveryPolicyConfig> = {}
): RecoveryPolicyInstance {
  return createRecoveryPolicy({
    maxRetries: 5,
    backoffStrategy: 'fibonacci',
    initialDelayMs: 1000,
    maxDelayMs: 60000,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      successThreshold: 3,
    },
    ...options,
  });
}
