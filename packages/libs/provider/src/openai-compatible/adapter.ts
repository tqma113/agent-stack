/**
 * OpenAI-Compatible Provider Adapter
 *
 * Implements ProviderInstance interface for OpenAI-compatible APIs.
 * Supports Ollama, Groq, Together.ai, and other OpenAI-compatible endpoints.
 */

import OpenAI from 'openai';
import type {
  ProviderInstance,
  ProviderCapabilities,
  OpenAICompatibleProviderConfig,
  UnifiedMessage,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedChatResult,
  UnifiedEmbeddingOptions,
  UnifiedEmbeddingResult,
  UnifiedToolCall,
} from '../core/types.js';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * OpenAI-compatible capabilities
 * Note: Actual capabilities vary by provider
 */
const OPENAI_COMPATIBLE_CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  tools: true, // May vary by provider
  vision: true, // May vary by provider
  embeddings: true, // May vary by provider
  systemMessages: true,
  jsonMode: true, // May vary by provider
};

/**
 * Create an OpenAI-compatible provider adapter
 *
 * @example
 * ```typescript
 * // Ollama
 * const ollama = createOpenAICompatibleAdapter({
 *   provider: 'openai-compatible',
 *   baseURL: 'http://localhost:11434/v1',
 *   name: 'ollama',
 * });
 *
 * // Groq
 * const groq = createOpenAICompatibleAdapter({
 *   provider: 'openai-compatible',
 *   baseURL: 'https://api.groq.com/openai/v1',
 *   apiKey: process.env.GROQ_API_KEY,
 *   name: 'groq',
 * });
 *
 * // Together.ai
 * const together = createOpenAICompatibleAdapter({
 *   provider: 'openai-compatible',
 *   baseURL: 'https://api.together.xyz/v1',
 *   apiKey: process.env.TOGETHER_API_KEY,
 *   name: 'together',
 * });
 * ```
 */
export function createOpenAICompatibleAdapter(
  config: OpenAICompatibleProviderConfig
): ProviderInstance {
  const client = new OpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY ?? 'ollama', // Default for Ollama
    baseURL: config.baseURL,
    timeout: config.timeout ?? 60000,
    maxRetries: config.maxRetries ?? 2,
  });

  let defaultModel = 'llama3.2'; // Common default for Ollama

  return {
    type: 'openai-compatible',
    capabilities: OPENAI_COMPATIBLE_CAPABILITIES,

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
      try {
        const response = await client.chat.completions.create({
          model: options.model ?? defaultModel,
          messages: messages as ChatCompletionMessageParam[],
          temperature: options.temperature,
          max_completion_tokens: options.maxTokens,
          top_p: options.topP,
          stop: options.stop,
          tools: options.tools,
          tool_choice: options.toolChoice as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption,
          response_format: options.responseFormat,
          seed: options.seed,
          user: options.user,
        });

        const choice = response.choices[0];
        return {
          id: response.id,
          content: choice?.message?.content ?? null,
          toolCalls: choice?.message?.tool_calls as UnifiedToolCall[] | undefined,
          finishReason: choice?.finish_reason ?? null,
          usage: response.usage
            ? {
                promptTokens: response.usage.prompt_tokens,
                completionTokens: response.usage.completion_tokens,
                totalTokens: response.usage.total_tokens,
              }
            : undefined,
        };
      } catch (error) {
        // Some providers don't support all options, retry with minimal params
        if (
          error instanceof Error &&
          (error.message.includes('not supported') ||
            error.message.includes('invalid_request_error'))
        ) {
          const response = await client.chat.completions.create({
            model: options.model ?? defaultModel,
            messages: messages as ChatCompletionMessageParam[],
            temperature: options.temperature,
            max_tokens: options.maxTokens,
          });

          const choice = response.choices[0];
          return {
            id: response.id,
            content: choice?.message?.content ?? null,
            toolCalls: undefined,
            finishReason: choice?.finish_reason ?? null,
            usage: response.usage
              ? {
                  promptTokens: response.usage.prompt_tokens,
                  completionTokens: response.usage.completion_tokens,
                  totalTokens: response.usage.total_tokens,
                }
              : undefined,
          };
        }
        throw error;
      }
    },

    async *chatStream(
      messages: UnifiedMessage[],
      options: UnifiedStreamOptions = {}
    ): AsyncGenerator<string, UnifiedChatResult, unknown> {
      const stream = await client.chat.completions.create({
        model: options.model ?? defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
        top_p: options.topP,
        stop: options.stop,
        tools: options.tools,
        tool_choice: options.toolChoice as OpenAI.Chat.Completions.ChatCompletionToolChoiceOption,
        response_format: options.responseFormat,
        seed: options.seed,
        user: options.user,
        stream: true,
      });

      let fullContent = '';
      let id = '';
      let finishReason: string | null = null;
      const toolCalls: UnifiedToolCall[] = [];

      for await (const chunk of stream) {
        if (options.signal?.aborted) {
          break;
        }

        id = chunk.id;
        const delta = chunk.choices[0]?.delta;
        finishReason = chunk.choices[0]?.finish_reason ?? null;

        if (delta?.content) {
          fullContent += delta.content;
          options.onToken?.(delta.content);
          yield delta.content;
        }

        if (delta?.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            options.onToolCall?.(toolCall as Partial<UnifiedToolCall>);

            if (toolCall.index !== undefined) {
              if (!toolCalls[toolCall.index]) {
                toolCalls[toolCall.index] = {
                  id: toolCall.id ?? '',
                  type: 'function',
                  function: {
                    name: toolCall.function?.name ?? '',
                    arguments: toolCall.function?.arguments ?? '',
                  },
                };
              } else {
                if (toolCall.function?.arguments) {
                  toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                }
              }
            }
          }
        }
      }

      return {
        id,
        content: fullContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
      };
    },

    async embed(
      input: string | string[],
      options: UnifiedEmbeddingOptions = {}
    ): Promise<UnifiedEmbeddingResult[]> {
      try {
        const response = await client.embeddings.create({
          model: options.model ?? 'nomic-embed-text', // Common default for Ollama
          input,
          dimensions: options.dimensions,
          user: options.user,
        });

        return response.data.map((item) => ({
          embedding: item.embedding,
          index: item.index,
        }));
      } catch (error) {
        // Some providers don't support embeddings
        if (error instanceof Error && error.message.includes('not supported')) {
          throw new Error(
            `Embeddings not supported by this provider. Error: ${error.message}`
          );
        }
        throw error;
      }
    },

    getNativeClient(): OpenAI {
      return client;
    },
  };
}
