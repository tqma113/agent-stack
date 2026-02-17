/**
 * @agent-stack/mcp - Helper Functions
 */

import type { MCPToolResult } from './types';
import { MCPTimeoutError } from './types';

/**
 * Sanitize tool name for use as identifier
 * Replaces invalid characters with underscores
 */
export function sanitizeToolName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate a unique tool name with server prefix
 */
export function generateToolName(
  serverName: string,
  toolName: string,
  options?: {
    prefix?: string;
    includeServerName?: boolean;
    transformer?: (server: string, tool: string) => string;
  }
): string {
  if (options?.transformer) {
    return options.transformer(serverName, toolName);
  }

  const prefix = options?.prefix ?? '';
  const sanitizedServer = sanitizeToolName(serverName);
  const sanitizedTool = sanitizeToolName(toolName);

  if (options?.includeServerName) {
    return `${prefix}${sanitizedServer}__${sanitizedTool}`;
  }

  return `${prefix}${sanitizedTool}`;
}

/**
 * Parse tool result content to string
 */
export function parseToolResultContent(result: MCPToolResult): string {
  if (!result.content || result.content.length === 0) {
    return '';
  }

  const textParts: string[] = [];

  for (const item of result.content) {
    if (item.type === 'text' && item.text) {
      textParts.push(item.text);
    } else if (item.type === 'image' && item.data) {
      textParts.push(`[Image: ${item.mimeType ?? 'unknown type'}]`);
    } else if (item.type === 'resource') {
      textParts.push(`[Resource]`);
    }
  }

  return textParts.join('\n');
}

/**
 * Check if result indicates an error
 */
export function isErrorResult(result: MCPToolResult): boolean {
  return result.isError === true;
}

/**
 * Extract text content from result
 */
export function extractTextContent(result: MCPToolResult): string {
  const textItems = result.content.filter(
    (item) => item.type === 'text' && item.text
  );
  return textItems.map((item) => item.text).join('\n');
}

/**
 * Format error for tool result
 */
export function formatErrorResult(error: unknown): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Create a promise that rejects after timeout
 */
export function createTimeoutPromise(
  ms: number,
  operation: string
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new MCPTimeoutError(operation));
    }, ms);
  });
}

/**
 * Wrap a promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([promise, createTimeoutPromise(ms, operation)]);
}

/**
 * Create abort controller with timeout
 */
export function createTimeoutController(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const factor = options?.factor ?? 2;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      ) as T[keyof T];
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}

/**
 * Check if a value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safe JSON stringify with circular reference handling
 */
export function safeStringify(value: unknown, indent?: number): string {
  const seen = new WeakSet();

  return JSON.stringify(
    value,
    (_, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      return val;
    },
    indent
  );
}
