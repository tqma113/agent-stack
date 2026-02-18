/**
 * @agent-stack/memory-store - Error Classes
 *
 * Custom error types for the memory storage layer.
 */

// V8-specific stack trace capture type
interface ErrorWithCaptureStackTrace {
  captureStackTrace?(targetObject: object, constructorOpt?: NewableFunction): void;
}

/**
 * Base error class for memory store
 */
export class MemoryStoreError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'MemoryStoreError';
    this.code = code;
    // V8-specific stack trace capture
    const ErrorWithCapture = Error as unknown as ErrorWithCaptureStackTrace;
    ErrorWithCapture.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error during store initialization
 */
export class StoreInitializationError extends MemoryStoreError {
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
export class EventRecordError extends MemoryStoreError {
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
export class TaskStateError extends MemoryStoreError {
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
export class TaskStateConflictError extends MemoryStoreError {
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
export class ProfileError extends MemoryStoreError {
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
 * Error during semantic search
 */
export class SemanticSearchError extends MemoryStoreError {
  constructor(message: string, cause?: Error) {
    super(message, 'SEMANTIC_SEARCH_ERROR');
    this.name = 'SemanticSearchError';
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Error when database operation fails
 */
export class DatabaseError extends MemoryStoreError {
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
