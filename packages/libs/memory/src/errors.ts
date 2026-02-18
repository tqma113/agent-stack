/**
 * @ai-stack/memory - Error Classes
 *
 * Custom error types for the memory system.
 */

// V8-specific stack trace capture type
interface ErrorWithCaptureStackTrace {
  captureStackTrace?(targetObject: object, constructorOpt?: NewableFunction): void;
}

/**
 * Base error class for memory system
 */
export class MemoryError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'MemoryError';
    this.code = code;
    // V8-specific stack trace capture
    const ErrorWithCapture = Error as unknown as ErrorWithCaptureStackTrace;
    ErrorWithCapture.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error during store initialization
 */
export class StoreInitializationError extends MemoryError {
  readonly storeName: string;

  constructor(storeName: string, message: string, cause?: Error) {
    super(`Failed to initialize ${storeName}: ${message}`, 'STORE_INIT_ERROR');
    this.name = 'StoreInitializationError';
    this.storeName = storeName;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error during event recording
 */
export class EventRecordError extends MemoryError {
  readonly eventType?: string;

  constructor(message: string, eventType?: string, cause?: Error) {
    super(message, 'EVENT_RECORD_ERROR');
    this.name = 'EventRecordError';
    this.eventType = eventType;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error during task state operations
 */
export class TaskStateError extends MemoryError {
  readonly taskId?: string;

  constructor(message: string, taskId?: string, cause?: Error) {
    super(message, 'TASK_STATE_ERROR');
    this.name = 'TaskStateError';
    this.taskId = taskId;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when task state version conflicts
 */
export class TaskStateConflictError extends MemoryError {
  readonly taskId: string;
  readonly expectedVersion: number;
  readonly actualVersion: number;

  constructor(taskId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Version conflict for task ${taskId}: expected ${expectedVersion}, got ${actualVersion}`,
      'TASK_STATE_CONFLICT'
    );
    this.name = 'TaskStateConflictError';
    this.taskId = taskId;
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * Error during profile operations
 */
export class ProfileError extends MemoryError {
  readonly key?: string;

  constructor(message: string, key?: string, cause?: Error) {
    super(message, 'PROFILE_ERROR');
    this.name = 'ProfileError';
    this.key = key;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when profile key is not allowed
 */
export class ProfileKeyNotAllowedError extends MemoryError {
  readonly key: string;
  readonly allowedKeys: string[];

  constructor(key: string, allowedKeys: string[]) {
    super(
      `Profile key "${key}" is not in whitelist. Allowed keys: ${allowedKeys.join(', ')}`,
      'PROFILE_KEY_NOT_ALLOWED'
    );
    this.name = 'ProfileKeyNotAllowedError';
    this.key = key;
    this.allowedKeys = allowedKeys;
  }
}

/**
 * Error during retrieval operations
 */
export class RetrievalError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'RETRIEVAL_ERROR');
    this.name = 'RetrievalError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error during summarization
 */
export class SummarizationError extends MemoryError {
  readonly sessionId?: string;

  constructor(message: string, sessionId?: string, cause?: Error) {
    super(message, 'SUMMARIZATION_ERROR');
    this.name = 'SummarizationError';
    this.sessionId = sessionId;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error during semantic search
 */
export class SemanticSearchError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'SEMANTIC_SEARCH_ERROR');
    this.name = 'SemanticSearchError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when token budget is exceeded
 */
export class TokenBudgetExceededError extends MemoryError {
  readonly budget: number;
  readonly actual: number;
  readonly layer: string;

  constructor(layer: string, budget: number, actual: number) {
    super(
      `Token budget exceeded for ${layer}: budget ${budget}, actual ${actual}`,
      'TOKEN_BUDGET_EXCEEDED'
    );
    this.name = 'TokenBudgetExceededError';
    this.layer = layer;
    this.budget = budget;
    this.actual = actual;
  }
}

/**
 * Error during write policy validation
 */
export class WritePolicyError extends MemoryError {
  constructor(message: string, cause?: Error) {
    super(message, 'WRITE_POLICY_ERROR');
    this.name = 'WritePolicyError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when database operation fails
 */
export class DatabaseError extends MemoryError {
  readonly operation: string;

  constructor(operation: string, message: string, cause?: Error) {
    super(`Database ${operation} failed: ${message}`, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
    this.operation = operation;
    if (cause) {
      this.cause = cause;
    }
  }
}
