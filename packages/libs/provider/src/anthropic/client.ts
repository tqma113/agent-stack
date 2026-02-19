/**
 * Anthropic Client Wrapper
 *
 * High-level client for Anthropic Claude API, similar to OpenAI client wrapper.
 */

import { createAnthropicAdapter } from './adapter.js';
import type {
  AnthropicProviderConfig,
  UnifiedMessage,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedChatResult,
} from '../core/types.js';

/**
 * Anthropic client configuration
 */
export interface AnthropicClientConfig {
  /** API key (defaults to ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** Base URL for API */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Default max tokens (required for Anthropic) */
  defaultMaxTokens?: number;
}

/**
 * Anthropic client instance type
 */
export interface AnthropicClientInstance {
  /** Get the underlying Anthropic client instance */
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
}

/**
 * Create an Anthropic client instance
 *
 * @example
 * ```typescript
 * const client = createAnthropicClient({
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * });
 *
 * client.setDefaultModel('claude-3-5-sonnet-20241022');
 *
 * const result = await client.chat([
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export function createAnthropicClient(
  config: AnthropicClientConfig = {}
): AnthropicClientInstance {
  const adapter = createAnthropicAdapter({
    provider: 'anthropic',
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: config.timeout,
    maxRetries: config.maxRetries,
    defaultMaxTokens: config.defaultMaxTokens,
  });

  return {
    getClient: () => adapter.getNativeClient(),
    setDefaultModel: (model) => adapter.setDefaultModel(model),
    getDefaultModel: () => adapter.getDefaultModel(),
    chat: (messages, options) => adapter.chat(messages, options),
    chatStream: (messages, options) => adapter.chatStream(messages, options),
  };
}
