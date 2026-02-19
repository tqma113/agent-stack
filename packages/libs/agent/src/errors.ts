/**
 * @ai-stack/agent - Unified Error Handling
 *
 * Base error classes for the AI Stack framework.
 */

/**
 * Error source identifier
 */
export type ErrorSource =
  | 'agent'
  | 'provider'
  | 'mcp'
  | 'skill'
  | 'memory'
  | 'knowledge'
  | 'config'
  | 'permission'
  | 'tool'
  | 'unknown';

/**
 * Error codes for categorization and handling
 */
export type ErrorCode =
  // Agent errors
  | 'AGENT_INIT_FAILED'
  | 'AGENT_NOT_INITIALIZED'
  | 'AGENT_ITERATION_LIMIT'
  // Provider errors
  | 'PROVIDER_AUTH_FAILED'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_API_ERROR'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_INVALID_RESPONSE'
  | 'PROVIDER_MODEL_NOT_FOUND'
  // Tool errors
  | 'TOOL_NOT_FOUND'
  | 'TOOL_EXECUTION_FAILED'
  | 'TOOL_PERMISSION_DENIED'
  | 'TOOL_TIMEOUT'
  | 'TOOL_INVALID_ARGS'
  // Config errors
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'CONFIG_PARSE_ERROR'
  // Memory errors
  | 'MEMORY_INIT_FAILED'
  | 'MEMORY_STORE_ERROR'
  | 'MEMORY_RETRIEVAL_ERROR'
  // Knowledge errors
  | 'KNOWLEDGE_INIT_FAILED'
  | 'KNOWLEDGE_INDEX_ERROR'
  | 'KNOWLEDGE_SEARCH_ERROR'
  // MCP errors
  | 'MCP_CONNECTION_FAILED'
  | 'MCP_TOOL_ERROR'
  // Skill errors
  | 'SKILL_LOAD_FAILED'
  | 'SKILL_EXECUTION_ERROR'
  // Generic
  | 'UNKNOWN_ERROR';

/**
 * Base error class for AI Stack
 *
 * Provides structured error information for better handling and recovery.
 *
 * @example
 * ```typescript
 * try {
 *   await agent.chat('hello');
 * } catch (error) {
 *   if (error instanceof AIStackError && error.recoverable) {
 *     // Can retry
 *     await agent.chat('hello');
 *   } else {
 *     // Fatal error
 *     throw error;
 *   }
 * }
 * ```
 */
export class AIStackError extends Error {
  /** Error code for programmatic handling */
  readonly code: ErrorCode;

  /** Source component that generated the error */
  readonly source: ErrorSource;

  /** Whether the error is recoverable (can be retried) */
  readonly recoverable: boolean;

  /** Original error that caused this error */
  readonly cause?: Error;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      code: ErrorCode;
      source: ErrorSource;
      recoverable?: boolean;
      cause?: Error;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'AIStackError';
    this.code = options.code;
    this.source = options.source;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
    this.context = options.context;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIStackError);
    }
  }

  /**
   * Create a human-readable string representation
   */
  toString(): string {
    let result = `[${this.source}] ${this.code}: ${this.message}`;
    if (this.recoverable) {
      result += ' (recoverable)';
    }
    return result;
  }

  /**
   * Convert to JSON for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      source: this.source,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

// =============================================================================
// Agent Errors
// =============================================================================

/**
 * Error during agent initialization
 */
export class AgentInitError extends AIStackError {
  constructor(message: string, cause?: Error, context?: Record<string, unknown>) {
    super(message, {
      code: 'AGENT_INIT_FAILED',
      source: 'agent',
      recoverable: false,
      cause,
      context,
    });
    this.name = 'AgentInitError';
  }
}

/**
 * Error when agent is not initialized
 */
export class AgentNotInitializedError extends AIStackError {
  constructor(component: string) {
    super(`${component} not initialized. Call the appropriate initialization method first.`, {
      code: 'AGENT_NOT_INITIALIZED',
      source: 'agent',
      recoverable: false,
    });
    this.name = 'AgentNotInitializedError';
  }
}

/**
 * Error when max iterations is reached
 */
export class AgentIterationLimitError extends AIStackError {
  readonly iterations: number;
  readonly toolCallCount: number;

  constructor(iterations: number, toolCallCount: number) {
    super(`Max iterations (${iterations}) reached with ${toolCallCount} tool calls`, {
      code: 'AGENT_ITERATION_LIMIT',
      source: 'agent',
      recoverable: true, // Can continue if user allows
      context: { iterations, toolCallCount },
    });
    this.name = 'AgentIterationLimitError';
    this.iterations = iterations;
    this.toolCallCount = toolCallCount;
  }
}

// =============================================================================
// Provider Errors
// =============================================================================

/**
 * Provider authentication failed
 */
export class ProviderAuthError extends AIStackError {
  constructor(provider: string, message?: string) {
    super(message || `Authentication failed for provider: ${provider}`, {
      code: 'PROVIDER_AUTH_FAILED',
      source: 'provider',
      recoverable: false,
      context: { provider },
    });
    this.name = 'ProviderAuthError';
  }
}

/**
 * Provider rate limit exceeded
 */
export class ProviderRateLimitError extends AIStackError {
  readonly retryAfterMs?: number;

  constructor(provider: string, retryAfterMs?: number) {
    super(`Rate limit exceeded for provider: ${provider}`, {
      code: 'PROVIDER_RATE_LIMIT',
      source: 'provider',
      recoverable: true,
      context: { provider, retryAfterMs },
    });
    this.name = 'ProviderRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Provider API error
 */
export class ProviderAPIError extends AIStackError {
  readonly statusCode?: number;

  constructor(provider: string, message: string, statusCode?: number, cause?: Error) {
    super(`${provider} API error: ${message}`, {
      code: 'PROVIDER_API_ERROR',
      source: 'provider',
      recoverable: statusCode === 500 || statusCode === 502 || statusCode === 503,
      cause,
      context: { provider, statusCode },
    });
    this.name = 'ProviderAPIError';
    this.statusCode = statusCode;
  }
}

/**
 * Provider request timeout
 */
export class ProviderTimeoutError extends AIStackError {
  readonly timeoutMs: number;

  constructor(provider: string, timeoutMs: number) {
    super(`Request to ${provider} timed out after ${timeoutMs}ms`, {
      code: 'PROVIDER_TIMEOUT',
      source: 'provider',
      recoverable: true,
      context: { provider, timeoutMs },
    });
    this.name = 'ProviderTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

// =============================================================================
// Tool Errors
// =============================================================================

/**
 * Tool not found
 */
export class ToolNotFoundError extends AIStackError {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, {
      code: 'TOOL_NOT_FOUND',
      source: 'tool',
      recoverable: false,
      context: { toolName },
    });
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
  }
}

/**
 * Tool execution failed
 */
export class ToolExecutionError extends AIStackError {
  readonly toolName: string;
  readonly args: Record<string, unknown>;

  constructor(toolName: string, args: Record<string, unknown>, cause?: Error) {
    super(`Tool execution failed: ${toolName}`, {
      code: 'TOOL_EXECUTION_FAILED',
      source: 'tool',
      recoverable: false,
      cause,
      context: { toolName, args },
    });
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.args = args;
  }
}

/**
 * Tool permission denied
 */
export class ToolPermissionDeniedError extends AIStackError {
  readonly toolName: string;
  readonly reason?: string;

  constructor(toolName: string, reason?: string) {
    super(`Permission denied for tool: ${toolName}${reason ? ` - ${reason}` : ''}`, {
      code: 'TOOL_PERMISSION_DENIED',
      source: 'tool',
      recoverable: false,
      context: { toolName, reason },
    });
    this.name = 'ToolPermissionDeniedError';
    this.toolName = toolName;
    this.reason = reason;
  }
}

// =============================================================================
// Config Errors
// =============================================================================

/**
 * Configuration file not found
 */
export class ConfigNotFoundError extends AIStackError {
  readonly path?: string;

  constructor(path?: string) {
    super(path ? `Configuration file not found: ${path}` : 'No configuration file found', {
      code: 'CONFIG_NOT_FOUND',
      source: 'config',
      recoverable: false,
      context: { path },
    });
    this.name = 'ConfigNotFoundError';
    this.path = path;
  }
}

/**
 * Configuration validation failed
 */
export class ConfigValidationError extends AIStackError {
  readonly errors: Array<{ path: string; message: string }>;

  constructor(errors: Array<{ path: string; message: string }>) {
    const summary =
      errors.length === 1
        ? errors[0].message
        : `${errors.length} validation errors`;
    super(`Invalid configuration: ${summary}`, {
      code: 'CONFIG_INVALID',
      source: 'config',
      recoverable: false,
      context: { errors },
    });
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }

  /**
   * Format errors for display
   */
  formatErrors(): string {
    return this.errors
      .map((e) => `  - ${e.path}: ${e.message}`)
      .join('\n');
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if an error is an AI Stack error
 */
export function isAIStackError(error: unknown): error is AIStackError {
  return error instanceof AIStackError;
}

/**
 * Check if an error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof AIStackError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Wrap any error as an AI Stack error
 */
export function wrapError(
  error: unknown,
  source: ErrorSource = 'unknown'
): AIStackError {
  if (error instanceof AIStackError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new AIStackError(message, {
    code: 'UNKNOWN_ERROR',
    source,
    recoverable: false,
    cause,
  });
}
