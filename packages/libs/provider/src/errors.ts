/**
 * @ai-stack/provider - Error Classes
 *
 * Provider-specific error classes for LLM API interactions.
 */

/**
 * Supported provider names
 */
export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openai-compatible' | 'unknown';

/**
 * Base error class for provider errors
 */
export class ProviderError extends Error {
  /** Provider that generated the error */
  readonly provider: ProviderName;

  /** HTTP status code (if applicable) */
  readonly statusCode?: number;

  /** Whether the error is retryable */
  readonly retryable: boolean;

  /** Original error */
  readonly cause?: Error;

  constructor(
    message: string,
    options: {
      provider: ProviderName;
      statusCode?: number;
      retryable?: boolean;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }
}

/**
 * Authentication error (invalid API key, etc.)
 */
export class AuthenticationError extends ProviderError {
  constructor(provider: ProviderName, message?: string) {
    super(message || `Authentication failed for ${provider}`, {
      provider,
      statusCode: 401,
      retryable: false,
    });
    this.name = 'AuthenticationError';
  }
}

/**
 * Rate limit exceeded
 */
export class RateLimitError extends ProviderError {
  /** Time to wait before retrying (in milliseconds) */
  readonly retryAfterMs?: number;

  constructor(provider: ProviderName, retryAfterMs?: number) {
    super(`Rate limit exceeded for ${provider}`, {
      provider,
      statusCode: 429,
      retryable: true,
    });
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Invalid request error (bad parameters, etc.)
 */
export class InvalidRequestError extends ProviderError {
  /** Parameter that caused the error */
  readonly parameter?: string;

  constructor(provider: ProviderName, message: string, parameter?: string) {
    super(message, {
      provider,
      statusCode: 400,
      retryable: false,
    });
    this.name = 'InvalidRequestError';
    this.parameter = parameter;
  }
}

/**
 * Model not found or not accessible
 */
export class ModelNotFoundError extends ProviderError {
  /** The model that was requested */
  readonly model: string;

  constructor(provider: ProviderName, model: string) {
    super(`Model "${model}" not found or not accessible`, {
      provider,
      statusCode: 404,
      retryable: false,
    });
    this.name = 'ModelNotFoundError';
    this.model = model;
  }
}

/**
 * Content filter triggered
 */
export class ContentFilterError extends ProviderError {
  /** Type of content that was filtered */
  readonly contentType?: string;

  constructor(provider: ProviderName, message?: string, contentType?: string) {
    super(message || `Content filtered by ${provider}`, {
      provider,
      statusCode: 400,
      retryable: false,
    });
    this.name = 'ContentFilterError';
    this.contentType = contentType;
  }
}

/**
 * Context length exceeded
 */
export class ContextLengthError extends ProviderError {
  /** Maximum allowed tokens */
  readonly maxTokens?: number;

  /** Tokens in the request */
  readonly requestedTokens?: number;

  constructor(
    provider: ProviderName,
    maxTokens?: number,
    requestedTokens?: number
  ) {
    const message = maxTokens && requestedTokens
      ? `Context length exceeded: requested ${requestedTokens} tokens, max is ${maxTokens}`
      : 'Context length exceeded';
    super(message, {
      provider,
      statusCode: 400,
      retryable: false,
    });
    this.name = 'ContextLengthError';
    this.maxTokens = maxTokens;
    this.requestedTokens = requestedTokens;
  }
}

/**
 * API connection error
 */
export class ConnectionError extends ProviderError {
  constructor(provider: ProviderName, message?: string, cause?: Error) {
    super(message || `Failed to connect to ${provider}`, {
      provider,
      retryable: true,
      cause,
    });
    this.name = 'ConnectionError';
  }
}

/**
 * Request timeout
 */
export class TimeoutError extends ProviderError {
  /** Timeout duration in milliseconds */
  readonly timeoutMs: number;

  constructor(provider: ProviderName, timeoutMs: number) {
    super(`Request to ${provider} timed out after ${timeoutMs}ms`, {
      provider,
      retryable: true,
    });
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Server error (5xx)
 */
export class ServerError extends ProviderError {
  constructor(provider: ProviderName, statusCode: number, message?: string) {
    super(message || `${provider} server error (${statusCode})`, {
      provider,
      statusCode,
      retryable: true,
    });
    this.name = 'ServerError';
  }
}

/**
 * Parse an error from a provider response
 */
export function parseProviderError(
  provider: ProviderName,
  error: unknown
): ProviderError {
  // Already a ProviderError
  if (error instanceof ProviderError) {
    return error;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for common error patterns
    if (message.includes('authentication') || message.includes('api key') || message.includes('unauthorized')) {
      return new AuthenticationError(provider, error.message);
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      return new RateLimitError(provider);
    }

    if (message.includes('context length') || message.includes('token limit') || message.includes('maximum context')) {
      return new ContextLengthError(provider);
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError(provider, 30000);
    }

    if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
      return new ConnectionError(provider, error.message, error);
    }

    // Generic provider error
    return new ProviderError(error.message, {
      provider,
      retryable: false,
      cause: error,
    });
  }

  // Unknown error type
  return new ProviderError(String(error), {
    provider,
    retryable: false,
  });
}
