/**
 * @ai-stack/tree-index - Error Classes
 *
 * Custom error types for tree operations.
 */

/**
 * Base error class for tree operations
 */
export class TreeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TreeError';
  }
}

/**
 * Error for database operations
 */
export class TreeDatabaseError extends TreeError {
  constructor(
    operation: string,
    message: string,
    cause?: Error
  ) {
    super(`Database error in ${operation}: ${message}`, 'DATABASE_ERROR', cause);
    this.name = 'TreeDatabaseError';
  }
}

/**
 * Error for node not found
 */
export class TreeNodeNotFoundError extends TreeError {
  constructor(
    public readonly nodeId: string,
    public readonly path?: string
  ) {
    super(
      path
        ? `Tree node not found: ${nodeId} (path: ${path})`
        : `Tree node not found: ${nodeId}`,
      'NODE_NOT_FOUND'
    );
    this.name = 'TreeNodeNotFoundError';
  }
}

/**
 * Error for root not found
 */
export class TreeRootNotFoundError extends TreeError {
  constructor(public readonly rootId: string) {
    super(`Tree root not found: ${rootId}`, 'ROOT_NOT_FOUND');
    this.name = 'TreeRootNotFoundError';
  }
}

/**
 * Error for duplicate path
 */
export class TreeDuplicatePathError extends TreeError {
  constructor(
    public readonly path: string,
    public readonly rootId: string
  ) {
    super(`Duplicate path in tree ${rootId}: ${path}`, 'DUPLICATE_PATH');
    this.name = 'TreeDuplicatePathError';
  }
}

/**
 * Error for invalid tree structure
 */
export class TreeStructureError extends TreeError {
  constructor(message: string) {
    super(message, 'STRUCTURE_ERROR');
    this.name = 'TreeStructureError';
  }
}

/**
 * Error for search operations
 */
export class TreeSearchError extends TreeError {
  constructor(message: string, cause?: Error) {
    super(message, 'SEARCH_ERROR', cause);
    this.name = 'TreeSearchError';
  }
}

/**
 * Error for builder operations
 */
export class TreeBuilderError extends TreeError {
  constructor(
    public readonly builderType: string,
    message: string,
    cause?: Error
  ) {
    super(`${builderType} builder error: ${message}`, 'BUILDER_ERROR', cause);
    this.name = 'TreeBuilderError';
  }
}
