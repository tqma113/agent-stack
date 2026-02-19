/**
 * Unified Provider Types
 *
 * Core type definitions for multi-model provider abstraction.
 * Uses OpenAI-compatible format as the baseline.
 */

/**
 * Supported provider types
 */
export type ProviderType = 'openai' | 'anthropic' | 'google' | 'openai-compatible';

/**
 * Provider capabilities - what features are supported
 */
export interface ProviderCapabilities {
  /** Supports chat completions */
  chat: boolean;
  /** Supports streaming chat completions */
  streaming: boolean;
  /** Supports function/tool calling */
  tools: boolean;
  /** Supports vision (image inputs) */
  vision: boolean;
  /** Supports text embeddings */
  embeddings: boolean;
  /** Supports system messages */
  systemMessages: boolean;
  /** Supports JSON mode response format */
  jsonMode: boolean;
}

/**
 * Base provider configuration
 */
export interface ProviderConfigBase {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL for API endpoint */
  baseURL?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
}

/**
 * OpenAI provider configuration
 */
export interface OpenAIProviderConfig extends ProviderConfigBase {
  provider: 'openai';
  /** Organization ID */
  organization?: string;
  /** Project ID */
  project?: string;
}

/**
 * Anthropic provider configuration
 */
export interface AnthropicProviderConfig extends ProviderConfigBase {
  provider: 'anthropic';
  /** Default max tokens for completions (required for Anthropic) */
  defaultMaxTokens?: number;
}

/**
 * Google Gemini provider configuration
 */
export interface GoogleProviderConfig extends ProviderConfigBase {
  provider: 'google';
}

/**
 * OpenAI-compatible provider configuration (Ollama, Groq, Together.ai, etc.)
 */
export interface OpenAICompatibleProviderConfig extends ProviderConfigBase {
  provider: 'openai-compatible';
  /** Provider name for identification */
  name?: string;
}

/**
 * Union type for all provider configurations
 */
export type ProviderConfig =
  | OpenAIProviderConfig
  | AnthropicProviderConfig
  | GoogleProviderConfig
  | OpenAICompatibleProviderConfig;

/**
 * Unified message role
 */
export type UnifiedRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Text content part
 */
export interface UnifiedTextContent {
  type: 'text';
  text: string;
}

/**
 * Image content part
 */
export interface UnifiedImageContent {
  type: 'image_url';
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

/**
 * Content can be string or array of content parts
 */
export type UnifiedContent = string | (UnifiedTextContent | UnifiedImageContent)[];

/**
 * Unified tool call structure (OpenAI format)
 */
export interface UnifiedToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Unified message structure (OpenAI-compatible)
 */
export interface UnifiedSystemMessage {
  role: 'system';
  content: string;
}

export interface UnifiedUserMessage {
  role: 'user';
  content: UnifiedContent;
}

export interface UnifiedAssistantMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: UnifiedToolCall[];
}

export interface UnifiedToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type UnifiedMessage =
  | UnifiedSystemMessage
  | UnifiedUserMessage
  | UnifiedAssistantMessage
  | UnifiedToolMessage;

/**
 * Unified tool definition (OpenAI format)
 */
export interface UnifiedTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Tool choice options
 */
export type UnifiedToolChoice =
  | 'none'
  | 'auto'
  | 'required'
  | { type: 'function'; function: { name: string } };

/**
 * Unified chat completion options
 */
export interface UnifiedChatOptions {
  /** Model to use */
  model?: string;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stop?: string | string[];
  /** Tools available for the model */
  tools?: UnifiedTool[];
  /** Tool choice behavior */
  toolChoice?: UnifiedToolChoice;
  /** Response format */
  responseFormat?: { type: 'text' | 'json_object' };
  /** Random seed for reproducibility */
  seed?: number;
  /** User identifier */
  user?: string;
}

/**
 * Streaming options extend chat options
 */
export interface UnifiedStreamOptions extends UnifiedChatOptions {
  /** Callback for each token */
  onToken?: (token: string) => void;
  /** Callback for tool calls */
  onToolCall?: (toolCall: Partial<UnifiedToolCall>) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Usage statistics
 */
export interface UnifiedUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Unified chat completion result
 */
export interface UnifiedChatResult {
  /** Response ID */
  id: string;
  /** Text content */
  content: string | null;
  /** Tool calls requested by the model */
  toolCalls?: UnifiedToolCall[];
  /** Reason for completion */
  finishReason: string | null;
  /** Token usage statistics */
  usage?: UnifiedUsage;
}

/**
 * Unified embedding options
 */
export interface UnifiedEmbeddingOptions {
  /** Model to use */
  model?: string;
  /** Embedding dimensions (if supported) */
  dimensions?: number;
  /** User identifier */
  user?: string;
}

/**
 * Unified embedding result
 */
export interface UnifiedEmbeddingResult {
  embedding: number[];
  index: number;
}

/**
 * Provider instance interface
 */
export interface ProviderInstance {
  /** Provider type */
  readonly type: ProviderType;

  /** Provider capabilities */
  readonly capabilities: ProviderCapabilities;

  /**
   * Set the default model for chat completions
   */
  setDefaultModel(model: string): void;

  /**
   * Get the current default model
   */
  getDefaultModel(): string;

  /**
   * Create a chat completion
   */
  chat(
    messages: UnifiedMessage[],
    options?: UnifiedChatOptions
  ): Promise<UnifiedChatResult>;

  /**
   * Create a streaming chat completion
   * Yields tokens as strings, returns final result
   */
  chatStream(
    messages: UnifiedMessage[],
    options?: UnifiedStreamOptions
  ): AsyncGenerator<string, UnifiedChatResult, unknown>;

  /**
   * Create embeddings for text (if supported)
   */
  embed?(
    input: string | string[],
    options?: UnifiedEmbeddingOptions
  ): Promise<UnifiedEmbeddingResult[]>;

  /**
   * Get the underlying native client instance
   * For advanced use cases that need provider-specific features
   */
  getNativeClient(): unknown;
}

/**
 * Type guard for system message
 */
export function isSystemMessage(msg: UnifiedMessage): msg is UnifiedSystemMessage {
  return msg.role === 'system';
}

/**
 * Type guard for user message
 */
export function isUserMessage(msg: UnifiedMessage): msg is UnifiedUserMessage {
  return msg.role === 'user';
}

/**
 * Type guard for assistant message
 */
export function isAssistantMessage(msg: UnifiedMessage): msg is UnifiedAssistantMessage {
  return msg.role === 'assistant';
}

/**
 * Type guard for tool message
 */
export function isToolMessage(msg: UnifiedMessage): msg is UnifiedToolMessage {
  return msg.role === 'tool';
}

/**
 * Check if content is a string
 */
export function isStringContent(content: UnifiedContent): content is string {
  return typeof content === 'string';
}

/**
 * Extract text from content
 */
export function extractTextContent(content: UnifiedContent): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .filter((part): part is UnifiedTextContent => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
