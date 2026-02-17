/**
 * OpenAI API Types
 */

import type OpenAI from 'openai';

// Re-export useful types from openai package
export type {
  ChatCompletionMessageParam,
  ChatCompletionSystemMessageParam,
  ChatCompletionUserMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionToolMessageParam,
  ChatCompletionFunctionMessageParam,
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  ChatCompletionContentPartImage,
} from 'openai/resources/chat/completions';

export type {
  ChatCompletionTool,
  ChatCompletionToolChoiceOption,
} from 'openai/resources/chat/completions';

// Client configuration
export interface OpenAIClientConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  timeout?: number;
  maxRetries?: number;
}

// Chat models
export type ChatModel =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-4-turbo-preview'
  | 'gpt-4'
  | 'gpt-4-32k'
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-16k'
  | 'o1'
  | 'o1-mini'
  | 'o1-preview'
  | (string & {});

// Embedding models
export type EmbeddingModel =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'
  | (string & {});

// Image models
export type ImageModel = 'dall-e-3' | 'dall-e-2' | (string & {});

// Audio models
export type TTSModel = 'tts-1' | 'tts-1-hd' | (string & {});
export type STTModel = 'whisper-1' | (string & {});
export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Moderation models
export type ModerationModel =
  | 'omni-moderation-latest'
  | 'text-moderation-latest'
  | 'text-moderation-stable'
  | (string & {});

// Chat completion options
export interface ChatCompletionOptions {
  model?: ChatModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  toolChoice?: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption;
  responseFormat?: { type: 'text' | 'json_object' };
  seed?: number;
  user?: string;
}

// Streaming options
export interface StreamingOptions extends ChatCompletionOptions {
  onToken?: (token: string) => void;
  onToolCall?: (toolCall: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta.ToolCall) => void;
  signal?: AbortSignal;
}

// Embedding options
export interface EmbeddingOptions {
  model?: EmbeddingModel;
  dimensions?: number;
  user?: string;
}

// Image generation options
export interface ImageGenerationOptions {
  model?: ImageModel;
  n?: number;
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  responseFormat?: 'url' | 'b64_json';
  user?: string;
}

// Text-to-speech options
export interface TTSOptions {
  model?: TTSModel;
  voice?: TTSVoice;
  speed?: number;
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
}

// Speech-to-text options
export interface STTOptions {
  model?: STTModel;
  language?: string;
  prompt?: string;
  responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  temperature?: number;
}

// Moderation options
export interface ModerationOptions {
  model?: ModerationModel;
}

// Response types
export interface ChatCompletionResult {
  id: string;
  content: string | null;
  toolCalls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[];
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

export interface ImageResult {
  url?: string;
  b64Json?: string;
  revisedPrompt?: string;
}

export interface ModerationResult {
  id: string;
  flagged: boolean;
  categories: Record<string, boolean>;
  categoryScores: Record<string, number>;
}
