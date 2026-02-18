/**
 * @ai-stack/knowledge - Error Classes
 */

/**
 * Base error class for knowledge module
 */
export class KnowledgeError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'KnowledgeError';
    if (cause?.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Code indexing error
 */
export class CodeIndexError extends KnowledgeError {
  constructor(
    message: string,
    public readonly filePath?: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'CodeIndexError';
  }
}

/**
 * Document crawl error
 */
export class CrawlError extends KnowledgeError {
  constructor(
    message: string,
    public readonly url?: string,
    public readonly statusCode?: number,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'CrawlError';
  }
}

/**
 * Document parse error
 */
export class ParseError extends KnowledgeError {
  constructor(
    message: string,
    public readonly url?: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'ParseError';
  }
}

/**
 * Search error
 */
export class SearchError extends KnowledgeError {
  constructor(
    message: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'SearchError';
  }
}

/**
 * Configuration error
 */
export class ConfigError extends KnowledgeError {
  constructor(
    message: string,
    public readonly configKey?: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'ConfigError';
  }
}
