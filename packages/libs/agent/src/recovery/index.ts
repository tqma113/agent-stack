/**
 * @ai-stack/agent - Recovery Policy Module
 *
 * Provides error recovery strategies for agent operations:
 * - Configurable retry with backoff (exponential, fibonacci, etc.)
 * - Error classification and filtering
 * - Circuit breaker pattern
 * - Custom recovery actions
 */

export {
  createRecoveryPolicy,
  createApiRecoveryPolicy,
  createToolRecoveryPolicy,
  createResilientRecoveryPolicy,
  type RecoveryPolicyInstance,
} from './recovery-policy.js';

export type {
  BackoffStrategy,
  BackoffFunction,
  RecoveryAction,
  RecoveryContext,
  ErrorCategory,
  ErrorClassifier,
  RecoveryPolicyConfig,
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
} from './types.js';

export {
  ERROR_PATTERNS,
  DEFAULT_RECOVERY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './types.js';
