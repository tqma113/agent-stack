/**
 * @ai-stack/agent - Recovery Policy Types
 *
 * Defines types for error recovery strategies including
 * backoff algorithms, retry policies, and recovery actions.
 */

// =============================================================================
// Backoff Strategies
// =============================================================================

/**
 * Backoff strategy type
 */
export type BackoffStrategy =
  | 'none'         // No delay between retries
  | 'fixed'        // Fixed delay
  | 'linear'       // Linear increase: delay * attempt
  | 'exponential'  // Exponential: delay * 2^(attempt-1)
  | 'fibonacci'    // Fibonacci sequence: delay * fib(attempt)
  | 'custom';      // Custom function

/**
 * Custom backoff function type
 */
export type BackoffFunction = (attempt: number, initialDelayMs: number) => number;

// =============================================================================
// Recovery Actions
// =============================================================================

/**
 * Recovery action to take on error
 */
export type RecoveryAction =
  | { action: 'retry' }
  | { action: 'retry_with_backoff'; delayMs: number }
  | { action: 'skip'; reason: string }
  | { action: 'fallback'; fallbackFn: () => Promise<unknown> }
  | { action: 'abort'; reason: string }
  | { action: 'checkpoint_restore'; checkpointId: string }
  | { action: 'escalate'; to: 'user' | 'supervisor' };

// =============================================================================
// Recovery Context
// =============================================================================

/**
 * Context passed to recovery handlers
 */
export interface RecoveryContext {
  /** The error that occurred */
  error: Error;

  /** Current attempt number (1-based) */
  attempt: number;

  /** Maximum retries allowed */
  maxRetries: number;

  /** Operation name/identifier */
  operation: string;

  /** Operation arguments (for logging/retry) */
  args?: Record<string, unknown>;

  /** Last successful checkpoint (if any) */
  lastCheckpoint?: string;

  /** Total elapsed time across all attempts (ms) */
  totalElapsedMs: number;

  /** Time of first attempt */
  firstAttemptAt: number;

  /** Previous errors (for pattern detection) */
  previousErrors?: Error[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Error category for recovery decisions
 */
export type ErrorCategory =
  | 'transient'      // Temporary errors (network, rate limit)
  | 'permanent'      // Permanent errors (auth, not found)
  | 'resource'       // Resource exhaustion (memory, quota)
  | 'timeout'        // Timeout errors
  | 'validation'     // Input validation errors
  | 'unknown';       // Unknown errors

/**
 * Error classifier function
 */
export type ErrorClassifier = (error: Error) => ErrorCategory;

/**
 * Default error patterns for classification
 */
export const ERROR_PATTERNS: Record<ErrorCategory, RegExp[]> = {
  transient: [
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /rate.?limit/i,
    /too.?many.?requests/i,
    /503/,
    /502/,
    /429/,
    /temporarily.?unavailable/i,
  ],
  permanent: [
    /401/,
    /403/,
    /404/,
    /not.?found/i,
    /unauthorized/i,
    /forbidden/i,
    /invalid.?api.?key/i,
  ],
  resource: [
    /quota/i,
    /limit.?exceeded/i,
    /ENOMEM/i,
    /out.?of.?memory/i,
    /too.?large/i,
  ],
  timeout: [
    /timeout/i,
    /timed.?out/i,
    /ETIMEDOUT/i,
  ],
  validation: [
    /invalid/i,
    /validation/i,
    /required/i,
    /must.?be/i,
    /expected/i,
  ],
  unknown: [],
};

// =============================================================================
// Recovery Policy Configuration
// =============================================================================

/**
 * Recovery policy configuration
 */
export interface RecoveryPolicyConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;

  /** Backoff strategy (default: 'exponential') */
  backoffStrategy?: BackoffStrategy;

  /** Initial delay in milliseconds (default: 1000) */
  initialDelayMs?: number;

  /** Maximum delay in milliseconds (default: 30000) */
  maxDelayMs?: number;

  /** Jitter factor 0-1 (default: 0.1 = ±10%) */
  jitterFactor?: number;

  /** Custom backoff function (when strategy is 'custom') */
  backoffFn?: BackoffFunction;

  /** Error classes that are retryable */
  retryableErrors?: Array<new (...args: unknown[]) => Error>;

  /** Error patterns that are retryable (regex) */
  retryablePatterns?: RegExp[];

  /** Error categories that are retryable */
  retryableCategories?: ErrorCategory[];

  /** Custom error classifier */
  errorClassifier?: ErrorClassifier;

  /** Custom error handler (overrides default behavior) */
  onError?: (context: RecoveryContext) => RecoveryAction | Promise<RecoveryAction>;

  /** Called before each retry attempt */
  beforeRetry?: (context: RecoveryContext) => Promise<void>;

  /** Called after each retry attempt */
  afterRetry?: (context: RecoveryContext, success: boolean) => void;

  /** Called when all retries exhausted */
  onExhausted?: (context: RecoveryContext) => void;

  /** Called on successful recovery */
  onRecovered?: (context: RecoveryContext) => void;

  /** Global timeout for all retries (ms) */
  totalTimeoutMs?: number;

  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
}

// =============================================================================
// Circuit Breaker
// =============================================================================

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold?: number;

  /** Time to wait before trying again (ms) */
  resetTimeoutMs?: number;

  /** Number of successes to close circuit */
  successThreshold?: number;

  /** Time window for failure counting (ms) */
  failureWindowMs?: number;
}

/**
 * Circuit breaker state info
 */
export interface CircuitBreakerState {
  /** Current state */
  state: CircuitState;

  /** Failure count in current window */
  failures: number;

  /** Success count (in half-open state) */
  successes: number;

  /** Last failure timestamp */
  lastFailureAt?: number;

  /** When circuit was opened */
  openedAt?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default recovery policy configuration
 */
export const DEFAULT_RECOVERY_CONFIG: Required<
  Pick<
    RecoveryPolicyConfig,
    | 'maxRetries'
    | 'backoffStrategy'
    | 'initialDelayMs'
    | 'maxDelayMs'
    | 'jitterFactor'
    | 'retryableCategories'
  >
> = {
  maxRetries: 3,
  backoffStrategy: 'exponential',
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
  retryableCategories: ['transient', 'timeout'],
};

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 3,
  failureWindowMs: 60000,
};
