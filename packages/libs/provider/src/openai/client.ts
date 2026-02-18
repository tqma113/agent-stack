/**
 * OpenAI Client Wrapper - Functional Style
 */

import OpenAI from 'openai';
import type {
  OpenAIClientConfig,
  ChatModel,
  ChatCompletionOptions,
  StreamingOptions,
  EmbeddingOptions,
  ImageGenerationOptions,
  TTSOptions,
  STTOptions,
  ModerationOptions,
  ChatCompletionResult,
  EmbeddingResult,
  ImageResult,
  ModerationResult,
} from './types';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Uploadable } from 'openai/uploads';

/**
 * OpenAI Client instance type (returned by factory)
 */
export interface OpenAIClientInstance {
  /** Get the underlying OpenAI client instance */
  getClient(): OpenAI;
  /** Set the default model for chat completions */
  setDefaultModel(model: ChatModel): void;
  /** Create a chat completion */
  chat(
    messages: ChatCompletionMessageParam[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult>;
  /** Create a streaming chat completion */
  chatStream(
    messages: ChatCompletionMessageParam[],
    options?: StreamingOptions
  ): AsyncGenerator<string, ChatCompletionResult, unknown>;
  /** Create embeddings for text */
  embed(input: string | string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;
  /** Generate images from a prompt */
  generateImage(prompt: string, options?: ImageGenerationOptions): Promise<ImageResult[]>;
  /** Convert text to speech */
  textToSpeech(input: string, options?: TTSOptions): Promise<ArrayBuffer>;
  /** Convert speech to text (transcription) */
  speechToText(file: Uploadable, options?: STTOptions): Promise<string>;
  /** Translate audio to English */
  translateAudio(file: Uploadable, options?: Omit<STTOptions, 'language'>): Promise<string>;
  /** Check content for policy violations */
  moderate(input: string | string[], options?: ModerationOptions): Promise<ModerationResult[]>;
  /** List available models */
  listModels(): Promise<OpenAI.Model[]>;
  /** Retrieve a specific model */
  getModel(modelId: string): Promise<OpenAI.Model>;
}

/**
 * Create an OpenAI client instance
 */
export function createOpenAIClient(config: OpenAIClientConfig = {}): OpenAIClientInstance {
  // Private state via closure
  const client = new OpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config.baseURL,
    organization: config.organization,
    project: config.project,
    timeout: config.timeout ?? 60000,
    maxRetries: config.maxRetries ?? 2,
  });

  let defaultModel: ChatModel = 'gpt-4o';

  // Return instance object with methods
  return {
    getClient(): OpenAI {
      return client;
    },

    setDefaultModel(model: ChatModel): void {
      defaultModel = model;
    },

    async chat(
      messages: ChatCompletionMessageParam[],
      options: ChatCompletionOptions = {}
    ): Promise<ChatCompletionResult> {
      const response = await client.chat.completions.create({
        model: options.model ?? defaultModel,
        messages,
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        tools: options.tools,
        tool_choice: options.toolChoice,
        response_format: options.responseFormat,
        seed: options.seed,
        user: options.user,
      });

      const choice = response.choices[0];
      return {
        id: response.id,
        content: choice?.message?.content ?? null,
        toolCalls: choice?.message?.tool_calls,
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
      messages: ChatCompletionMessageParam[],
      options: StreamingOptions = {}
    ): AsyncGenerator<string, ChatCompletionResult, unknown> {
      const stream = await client.chat.completions.create({
        model: options.model ?? defaultModel,
        messages,
        temperature: options.temperature,
        max_completion_tokens: options.maxTokens,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        stop: options.stop,
        tools: options.tools,
        tool_choice: options.toolChoice,
        response_format: options.responseFormat,
        seed: options.seed,
        user: options.user,
        stream: true,
      });

      let fullContent = '';
      let id = '';
      let finishReason: string | null = null;
      const toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];

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
            options.onToolCall?.(toolCall);
            // Accumulate tool calls
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
      options: EmbeddingOptions = {}
    ): Promise<EmbeddingResult[]> {
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

    async generateImage(
      prompt: string,
      options: ImageGenerationOptions = {}
    ): Promise<ImageResult[]> {
      const response = await client.images.generate({
        model: options.model ?? 'dall-e-3',
        prompt,
        n: options.n ?? 1,
        size: options.size ?? '1024x1024',
        quality: options.quality,
        style: options.style,
        response_format: options.responseFormat,
        user: options.user,
      });

      return (response.data ?? []).map((item) => ({
        url: item.url,
        b64Json: item.b64_json,
        revisedPrompt: item.revised_prompt,
      }));
    },

    async textToSpeech(input: string, options: TTSOptions = {}): Promise<ArrayBuffer> {
      const response = await client.audio.speech.create({
        model: options.model ?? 'tts-1',
        voice: options.voice ?? 'alloy',
        input,
        speed: options.speed,
        response_format: options.responseFormat,
      });

      return response.arrayBuffer();
    },

    async speechToText(file: Uploadable, options: STTOptions = {}): Promise<string> {
      const response = await client.audio.transcriptions.create({
        model: options.model ?? 'whisper-1',
        file,
        language: options.language,
        prompt: options.prompt,
        response_format: options.responseFormat as
          | 'json'
          | 'text'
          | 'srt'
          | 'verbose_json'
          | 'vtt'
          | undefined,
        temperature: options.temperature,
      });

      return typeof response === 'string' ? response : response.text;
    },

    async translateAudio(
      file: Uploadable,
      options: Omit<STTOptions, 'language'> = {}
    ): Promise<string> {
      const response = await client.audio.translations.create({
        model: options.model ?? 'whisper-1',
        file,
        prompt: options.prompt,
        response_format: options.responseFormat as
          | 'json'
          | 'text'
          | 'srt'
          | 'verbose_json'
          | 'vtt'
          | undefined,
        temperature: options.temperature,
      });

      return typeof response === 'string' ? response : response.text;
    },

    async moderate(
      input: string | string[],
      options: ModerationOptions = {}
    ): Promise<ModerationResult[]> {
      const response = await client.moderations.create({
        model: options.model ?? 'text-moderation-latest',
        input,
      });

      return response.results.map((result) => ({
        id: response.id,
        flagged: result.flagged,
        categories: result.categories as unknown as Record<string, boolean>,
        categoryScores: result.category_scores as unknown as Record<string, number>,
      }));
    },

    async listModels(): Promise<OpenAI.Model[]> {
      const response = await client.models.list();
      return Array.from(response.data);
    },

    async getModel(modelId: string): Promise<OpenAI.Model> {
      return client.models.retrieve(modelId);
    },
  };
}

