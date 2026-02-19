/**
 * Core Provider Module
 *
 * Multi-model abstraction layer for LLM providers.
 */

// Types
export type {
  ProviderType,
  ProviderCapabilities,
  ProviderConfigBase,
  OpenAIProviderConfig,
  AnthropicProviderConfig,
  GoogleProviderConfig,
  OpenAICompatibleProviderConfig,
  ProviderConfig,
  UnifiedRole,
  UnifiedTextContent,
  UnifiedImageContent,
  UnifiedContent,
  UnifiedToolCall,
  UnifiedSystemMessage,
  UnifiedUserMessage,
  UnifiedAssistantMessage,
  UnifiedToolMessage,
  UnifiedMessage,
  UnifiedTool,
  UnifiedToolChoice,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedUsage,
  UnifiedChatResult,
  UnifiedEmbeddingOptions,
  UnifiedEmbeddingResult,
  ProviderInstance,
} from './types.js';

// Type guards
export {
  isSystemMessage,
  isUserMessage,
  isAssistantMessage,
  isToolMessage,
  isStringContent,
  extractTextContent,
} from './types.js';

// Factory
export { createProvider, isProviderAvailable, getAvailableProviders } from './factory.js';

// Message converters
export {
  toAnthropicMessages,
  fromAnthropicToolUse,
  toGoogleMessages,
  fromGoogleFunctionCall,
  createTextContent,
  createImageContent,
  createMultimodalContent,
} from './message.js';

export type {
  AnthropicMessage,
  AnthropicContentBlock,
  AnthropicTextBlock,
  AnthropicImageBlock,
  AnthropicToolUseBlock,
  AnthropicToolResultBlock,
  GoogleContent,
  GooglePart,
  GoogleTextPart,
  GoogleInlineDataPart,
  GoogleFunctionCallPart,
  GoogleFunctionResponsePart,
} from './message.js';

// Tool converters
export {
  toAnthropicTool,
  toAnthropicTools,
  toAnthropicToolChoice,
  toGoogleFunctionDeclaration,
  toGoogleTools,
  toGoogleToolConfig,
  toOpenAITool,
  toOpenAITools,
  toOpenAIToolChoice,
  createTool,
  createParameters,
  isValidTool,
} from './tool.js';

export type {
  AnthropicTool,
  AnthropicToolChoice,
  GoogleFunctionDeclaration,
  GoogleTool,
  GoogleToolConfig,
  OpenAITool,
  OpenAIToolChoice,
} from './tool.js';
