/**
 * Google Gemini Client Wrapper
 *
 * High-level client for Google Generative AI API.
 */

import { createGoogleAdapter } from './adapter.js';
import type {
  GoogleProviderConfig,
  UnifiedMessage,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedChatResult,
  UnifiedEmbeddingOptions,
  UnifiedEmbeddingResult,
} from '../core/types.js';

/**
 * Google client configuration
 */
export interface GoogleClientConfig {
  /** API key (defaults to GOOGLE_API_KEY env var) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Google client instance type
 */
export interface GoogleClientInstance {
  /** Get the underlying Google GenerativeAI instance */
  getClient(): unknown;
  /** Set the default model for chat completions */
  setDefaultModel(model: string): void;
  /** Get the current default model */
  getDefaultModel(): string;
  /** Create a chat completion */
  chat(
    messages: UnifiedMessage[],
    options?: UnifiedChatOptions
  ): Promise<UnifiedChatResult>;
  /** Create a streaming chat completion */
  chatStream(
    messages: UnifiedMessage[],
    options?: UnifiedStreamOptions
  ): AsyncGenerator<string, UnifiedChatResult, unknown>;
  /** Create embeddings for text */
  embed(
    input: string | string[],
    options?: UnifiedEmbeddingOptions
  ): Promise<UnifiedEmbeddingResult[]>;
}

/**
 * Create a Google Gemini client instance
 *
 * @example
 * ```typescript
 * const client = createGoogleClient({
 *   apiKey: process.env.GOOGLE_API_KEY,
 * });
 *
 * client.setDefaultModel('gemini-1.5-pro');
 *
 * const result = await client.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createGoogleClient(config: GoogleClientConfig = {}): GoogleClientInstance {
  const adapter = createGoogleAdapter({
    provider: 'google',
    apiKey: config.apiKey,
    timeout: config.timeout,
  });

  return {
    getClient: () => adapter.getNativeClient(),
    setDefaultModel: (model) => adapter.setDefaultModel(model),
    getDefaultModel: () => adapter.getDefaultModel(),
    chat: (messages, options) => adapter.chat(messages, options),
    chatStream: (messages, options) => adapter.chatStream(messages, options),
    embed: (input, options) => adapter.embed!(input, options),
  };
}
