/**
 * Types for @ai-stack-mcp/fetch
 */

import { z } from 'zod';

/**
 * Fetch tool input schema
 */
export const FetchInputSchema = z.object({
  url: z.string().url().describe('The URL to fetch'),
  maxLength: z
    .number()
    .int()
    .positive()
    .optional()
    .default(50000)
    .describe('Maximum content length in characters (default: 50000)'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000)
    .describe('Request timeout in milliseconds (default: 30000)'),
  userAgent: z
    .string()
    .optional()
    .describe('Custom User-Agent header'),
  selector: z
    .string()
    .optional()
    .describe('CSS selector to extract specific content (e.g., "article", "main", ".content")'),
  raw: z
    .boolean()
    .optional()
    .default(false)
    .describe('Return raw HTML instead of Markdown (default: false)'),
});

export type FetchInput = z.infer<typeof FetchInputSchema>;

/**
 * Fetch result
 */
export interface FetchResult {
  url: string;
  finalUrl: string;
  title: string;
  content: string;
  contentLength: number;
  truncated: boolean;
  contentType: string;
  statusCode: number;
}

/**
 * Server configuration
 */
export interface ServerConfig {
  name?: string;
  version?: string;
  defaultUserAgent?: string;
  defaultTimeout?: number;
  defaultMaxLength?: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

/**
 * Error types
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly url?: string
  ) {
    super(message);
    this.name = 'FetchError';
  }
}
