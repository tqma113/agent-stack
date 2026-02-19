/**
 * OpenAI Provider Adapter
 *
 * Implements ProviderInstance interface for OpenAI API.
 */

import OpenAI from 'openai';
import type {
  ProviderInstance,
  ProviderCapabilities,
  OpenAIProviderConfig,
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
 * OpenAI capabilities
 */
const OPENAI_CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  tools: true,
  vision: true,
  embeddings: true,
  systemMessages: true,
  jsonMode: true,
};

/**
 * Create an OpenAI provider adapter
 */
export function createOpenAIAdapter(config: OpenAIProviderConfig): ProviderInstance {
  const client = new OpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config.baseURL,
    organization: config.organization,
    project: config.project,
    timeout: config.timeout ?? 60000,
    maxRetries: config.maxRetries ?? 2,
  });

  let defaultModel = 'gpt-4o';

  return {
    type: 'openai',
    capabilities: OPENAI_CAPABILITIES,

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
      const response = await client.embeddings.create({
        model: options.model ?? 'text-embedding-3-small',
        input,
        dimensions: options.dimensions,
        user: options.user,
      });

      return response.data.map((item) => ({
        embedding: item.embedding,
        index: item.index,
      }));
    },

    getNativeClient(): OpenAI {
      return client;
    },
  };
}
