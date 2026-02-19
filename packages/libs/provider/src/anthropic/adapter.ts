/**
 * Anthropic Provider Adapter
 *
 * Implements ProviderInstance interface for Anthropic Claude API.
 */

import type {
  ProviderInstance,
  ProviderCapabilities,
  AnthropicProviderConfig,
  UnifiedMessage,
  UnifiedChatOptions,
  UnifiedStreamOptions,
  UnifiedChatResult,
  UnifiedToolCall,
} from '../core/types.js';
import {
  toAnthropicMessages,
} from '../core/message.js';
import { toAnthropicTools, toAnthropicToolChoice } from '../core/tool.js';

// Lazy-loaded Anthropic SDK (typed as any to avoid requiring @anthropic-ai/sdk at compile time)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let AnthropicSDK: any;

/**
 * Anthropic capabilities
 */
const ANTHROPIC_CAPABILITIES: ProviderCapabilities = {
  chat: true,
  streaming: true,
  tools: true,
  vision: true,
  embeddings: false,
  systemMessages: true,
  jsonMode: false, // Anthropic doesn't have native JSON mode
};

/**
 * Load Anthropic SDK lazily
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAnthropicSDK(): any {
  if (!AnthropicSDK) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AnthropicSDK = require('@anthropic-ai/sdk').default;
    } catch {
      throw new Error(
        'Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk'
      );
    }
  }
  return AnthropicSDK;
}

/**
 * Create an Anthropic provider adapter
 */
export function createAnthropicAdapter(config: AnthropicProviderConfig): ProviderInstance {
  const Anthropic = loadAnthropicSDK();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = new Anthropic({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: config.baseURL,
    timeout: config.timeout ?? 60000,
    maxRetries: config.maxRetries ?? 2,
  });

  let defaultModel = 'claude-3-5-sonnet-20241022';
  const defaultMaxTokens = config.defaultMaxTokens ?? 4096;

  return {
    type: 'anthropic',
    capabilities: ANTHROPIC_CAPABILITIES,

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
      const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestParams: any = {
        model: options.model ?? defaultModel,
        max_tokens: options.maxTokens ?? defaultMaxTokens,
        messages: anthropicMessages,
        system,
        temperature: options.temperature,
        top_p: options.topP,
        stop_sequences: options.stop
          ? Array.isArray(options.stop)
            ? options.stop
            : [options.stop]
          : undefined,
      };

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestParams.tools = toAnthropicTools(options.tools);
        const toolChoice = toAnthropicToolChoice(options.toolChoice);
        if (toolChoice) {
          requestParams.tool_choice = toolChoice;
        }
      }

      const response = await client.messages.create(requestParams);

      // Extract content and tool calls
      let textContent = '';
      const toolCalls: UnifiedToolCall[] = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          textContent += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      return {
        id: response.id,
        content: textContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: response.stop_reason ?? null,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    },

    async *chatStream(
      messages: UnifiedMessage[],
      options: UnifiedStreamOptions = {}
    ): AsyncGenerator<string, UnifiedChatResult, unknown> {
      const { system, messages: anthropicMessages } = toAnthropicMessages(messages);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const requestParams: any = {
        model: options.model ?? defaultModel,
        max_tokens: options.maxTokens ?? defaultMaxTokens,
        messages: anthropicMessages,
        system,
        temperature: options.temperature,
        top_p: options.topP,
        stop_sequences: options.stop
          ? Array.isArray(options.stop)
            ? options.stop
            : [options.stop]
          : undefined,
        stream: true,
      };

      // Add tools if provided
      if (options.tools && options.tools.length > 0) {
        requestParams.tools = toAnthropicTools(options.tools);
        const toolChoice = toAnthropicToolChoice(options.toolChoice);
        if (toolChoice) {
          requestParams.tool_choice = toolChoice;
        }
      }

      const stream = await client.messages.create(requestParams);

      let fullContent = '';
      let id = '';
      let finishReason: string | null = null;
      const toolCalls: UnifiedToolCall[] = [];
      let currentToolCall: Partial<UnifiedToolCall> | null = null;
      let inputTokens = 0;
      let outputTokens = 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const event of stream as AsyncIterable<any>) {
        if (options.signal?.aborted) {
          break;
        }

        switch (event.type) {
          case 'message_start':
            id = event.message?.id ?? '';
            inputTokens = event.message?.usage?.input_tokens ?? 0;
            break;

          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              currentToolCall = {
                id: event.content_block.id,
                type: 'function',
                function: {
                  name: event.content_block.name ?? '',
                  arguments: '',
                },
              };
              options.onToolCall?.(currentToolCall);
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              fullContent += event.delta.text;
              options.onToken?.(event.delta.text);
              yield event.delta.text;
            } else if (event.delta?.type === 'input_json_delta' && currentToolCall) {
              currentToolCall.function!.arguments += event.delta.partial_json ?? '';
            }
            break;

          case 'content_block_stop':
            if (currentToolCall && currentToolCall.id) {
              toolCalls.push(currentToolCall as UnifiedToolCall);
              currentToolCall = null;
            }
            break;

          case 'message_delta':
            finishReason = event.delta?.stop_reason ?? null;
            outputTokens = event.usage?.output_tokens ?? 0;
            break;
        }
      }

      return {
        id,
        content: fullContent || null,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      };
    },

    // Anthropic doesn't support embeddings
    embed: undefined,

    getNativeClient(): unknown {
      return client;
    },
  };
}
