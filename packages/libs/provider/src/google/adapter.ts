/**
 * Google Gemini Provider Adapter
 *
 * Implements ProviderInstance interface for Google Generative AI API.
 */

import type {
  ProviderInstance,
  ProviderCapabilities,
  GoogleProviderConfig,
  UnifiedMessage,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedChatResult,
  UnifiedEmbeddingOptions,
  UnifiedEmbeddingResult,
  UnifiedToolCall,
} from '../core/types.js';
import {
  toGoogleMessages,
} from '../core/message.js';
import { toGoogleTools, toGoogleToolConfig } from '../core/tool.js';

// Lazy-loaded Google SDK (typed as any to avoid requiring @google/generative-ai at compile time)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GoogleGenerativeAIClass: any;

/**
 * Google Gemini capabilities
 */
const GOOGLE_CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  tools: true,
  vision: true,
  embeddings: true,
  systemMessages: true,
  jsonMode: true,
};

/**
 * Load Google SDK lazily
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadGoogleSDK(): any {
  if (!GoogleGenerativeAIClass) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sdk = require('@google/generative-ai');
      GoogleGenerativeAIClass = sdk.GoogleGenerativeAI;
    } catch {
      throw new Error(
        'Google Generative AI SDK not installed. Run: npm install @google/generative-ai'
      );
    }
  }
  return GoogleGenerativeAIClass;
}

/**
 * Create a Google Gemini provider adapter
 */
export function createGoogleAdapter(config: GoogleProviderConfig): ProviderInstance {
  const GoogleAI = loadGoogleSDK();

  const apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key is required. Set GOOGLE_API_KEY or pass apiKey in config.');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genAI: any = new GoogleAI(apiKey);
  let defaultModel = 'gemini-1.5-pro';

  return {
    type: 'google',
    capabilities: GOOGLE_CAPABILITIES,

    setDefaultModel(model: string): void {
      defaultModel = model;
    },

    getDefaultModel(): string {
      return defaultModel;
    },

    async chat(
      messages: UnifiedMessage[],
      options: UnifiedChatOptions = {}
    ): Promise<UnifiedChatResult> {
      const { systemInstruction, contents } = toGoogleMessages(messages);

      const model = genAI.getGenerativeModel({
        model: options.model ?? defaultModel,
        systemInstruction,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          stopSequences: options.stop
            ? Array.isArray(options.stop)
              ? options.stop
              : [options.stop]
            : undefined,
          responseMimeType: options.responseFormat?.type === 'json_object'
            ? 'application/json'
            : undefined,
        },
        tools: options.tools ? toGoogleTools(options.tools) : undefined,
        toolConfig: options.tools ? toGoogleToolConfig(options.toolChoice) : undefined,
      });

      const result = await model.generateContent({ contents });
      const response = result.response;
      const candidate = response.candidates?.[0];

      // Extract content and function calls
      let textContent = '';
      const toolCalls: UnifiedToolCall[] = [];

      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if ('text' in part) {
            textContent += part.text;
          } else if ('functionCall' in part) {
            toolCalls.push({
              id: `call_${Date.now()}_${toolCalls.length}`,
              type: 'function',
              function: {
                name: part.functionCall.name,
                arguments: JSON.stringify(part.functionCall.args),
              },
            });
          }
        }
      }

      // Map finish reason
      let finishReason: string | null = null;
      if (candidate?.finishReason) {
        const reasonMap: Record<string, string> = {
          STOP: 'stop',
          MAX_TOKENS: 'length',
          SAFETY: 'content_filter',
          RECITATION: 'content_filter',
          OTHER: 'stop',
        };
        finishReason = reasonMap[candidate.finishReason] ?? candidate.finishReason.toLowerCase();
      }

      return {
        id: `gemini_${Date.now()}`,
        content: textContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount ?? 0,
              completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: response.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    },

    async *chatStream(
      messages: UnifiedMessage[],
      options: UnifiedStreamOptions = {}
    ): AsyncGenerator<string, UnifiedChatResult, unknown> {
      const { systemInstruction, contents } = toGoogleMessages(messages);

      const model = genAI.getGenerativeModel({
        model: options.model ?? defaultModel,
        systemInstruction,
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
          topP: options.topP,
          stopSequences: options.stop
            ? Array.isArray(options.stop)
              ? options.stop
              : [options.stop]
            : undefined,
          responseMimeType: options.responseFormat?.type === 'json_object'
            ? 'application/json'
            : undefined,
        },
        tools: options.tools ? toGoogleTools(options.tools) : undefined,
        toolConfig: options.tools ? toGoogleToolConfig(options.toolChoice) : undefined,
      });

      const result = await model.generateContentStream({ contents });

      let fullContent = '';
      let finishReason: string | null = null;
      const toolCalls: UnifiedToolCall[] = [];
      let promptTokens = 0;
      let completionTokens = 0;

      for await (const chunk of result.stream) {
        if (options.signal?.aborted) {
          break;
        }

        const candidate = chunk.candidates?.[0];
        if (candidate?.content?.parts) {
          for (const part of candidate.content.parts) {
            if ('text' in part && part.text) {
              fullContent += part.text;
              options.onToken?.(part.text);
              yield part.text;
            } else if ('functionCall' in part) {
              const toolCall: UnifiedToolCall = {
                id: `call_${Date.now()}_${toolCalls.length}`,
                type: 'function',
                function: {
                  name: part.functionCall.name,
                  arguments: JSON.stringify(part.functionCall.args),
                },
              };
              toolCalls.push(toolCall);
              options.onToolCall?.(toolCall);
            }
          }
        }

        if (candidate?.finishReason) {
          const reasonMap: Record<string, string> = {
            STOP: 'stop',
            MAX_TOKENS: 'length',
            SAFETY: 'content_filter',
            RECITATION: 'content_filter',
            OTHER: 'stop',
          };
          finishReason = reasonMap[candidate.finishReason] ?? candidate.finishReason.toLowerCase();
        }

        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          completionTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
      }

      return {
        id: `gemini_${Date.now()}`,
        content: fullContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    },

    async embed(
      input: string | string[],
      options: UnifiedEmbeddingOptions = {}
    ): Promise<UnifiedEmbeddingResult[]> {
      const embeddingModel = genAI.getGenerativeModel({
        model: options.model ?? 'text-embedding-004',
      });

      const inputs = Array.isArray(input) ? input : [input];
      const results: UnifiedEmbeddingResult[] = [];

      for (let i = 0; i < inputs.length; i++) {
        const result = await embeddingModel.embedContent(inputs[i]);
        results.push({
          embedding: result.embedding.values,
          index: i,
        });
      }

      return results;
    },

    getNativeClient(): unknown {
      return genAI;
    },
  };
}
