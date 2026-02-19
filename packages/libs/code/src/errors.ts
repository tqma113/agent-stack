/**
 * @ai-stack/code - Error Classes
 */

/**
 * Base error class for Code Agent
 */
export class CodeError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'CodeError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends CodeError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/**
 * Path validation error (sandbox violation)
 */
export class PathError extends CodeError {
  constructor(
    message: string,
    public readonly path: string
  ) {
    super(message, 'PATH_ERROR');
    this.name = 'PathError';
  }
}

/**
 * File not found error
 */
export class FileNotFoundError extends CodeError {
  constructor(public readonly path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND');
    this.name = 'FileNotFoundError';
  }
}

/**
 * File too large error
 */
export class FileTooLargeError extends CodeError {
  constructor(
    public readonly path: string,
    public readonly size: number,
    public readonly maxSize: number
  ) {
    super(`File too large: ${path} (${size} bytes, max: ${maxSize} bytes)`, 'FILE_TOO_LARGE');
    this.name = 'FileTooLargeError';
  }
}

/**
 * Content validation error (secret detected)
 */
export class ContentError extends CodeError {
  constructor(message: string) {
    super(message, 'CONTENT_ERROR');
    this.name = 'ContentError';
  }
}

/**
 * Edit operation error
 */
export class EditError extends CodeError {
  constructor(
    message: string,
    public readonly path: string
  ) {
    super(message, 'EDIT_ERROR');
    this.name = 'EditError';
  }
}

/**
 * File must be read before editing error
 */
export class FileNotReadError extends CodeError {
  constructor(public readonly path: string) {
    super(`File must be read before editing: ${path}`, 'FILE_NOT_READ');
    this.name = 'FileNotReadError';
  }
}

/**
 * History error
 */
export class HistoryError extends CodeError {
  constructor(message: string) {
    super(message, 'HISTORY_ERROR');
    this.name = 'HistoryError';
  }
}

/**
 * Task error
 */
export class TaskError extends CodeError {
  constructor(message: string) {
    super(message, 'TASK_ERROR');
    this.name = 'TaskError';
  }
}

/**
 * Operation denied error
 */
export class OperationDeniedError extends CodeError {
  constructor(message: string) {
    super(message, 'OPERATION_DENIED');
    this.name = 'OperationDeniedError';
  }
}
