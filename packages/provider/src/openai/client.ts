/**
 * OpenAI Client Wrapper
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

export class OpenAIClient {
  private client: OpenAI;
  private defaultModel: ChatModel = 'gpt-4o';

  constructor(config: OpenAIClientConfig = {}) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: config.baseURL,
      organization: config.organization,
      project: config.project,
      timeout: config.timeout ?? 60000,
      maxRetries: config.maxRetries ?? 2,
    });
  }

  /**
   * Get the underlying OpenAI client instance
   */
  getClient(): OpenAI {
    return this.client;
  }

  /**
   * Set the default model for chat completions
   */
  setDefaultModel(model: ChatModel): void {
    this.defaultModel = model;
  }

  /**
   * Create a chat completion
   */
  async chat(
    messages: ChatCompletionMessageParam[],
    options: ChatCompletionOptions = {}
  ): Promise<ChatCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
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
  }

  /**
   * Create a streaming chat completion
   */
  async *chatStream(
    messages: ChatCompletionMessageParam[],
    options: StreamingOptions = {}
  ): AsyncGenerator<string, ChatCompletionResult, unknown> {
    const stream = await this.client.chat.completions.create({
      model: options.model ?? this.defaultModel,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
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
  }

  /**
   * Create embeddings for text
   */
  async embed(
    input: string | string[],
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult[]> {
    const response = await this.client.embeddings.create({
      model: options.model ?? 'text-embedding-3-small',
      input,
      dimensions: options.dimensions,
      user: options.user,
    });

    return response.data.map((item) => ({
      embedding: item.embedding,
      index: item.index,
    }));
  }

  /**
   * Generate images from a prompt
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageResult[]> {
    const response = await this.client.images.generate({
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
  }

  /**
   * Convert text to speech
   */
  async textToSpeech(
    input: string,
    options: TTSOptions = {}
  ): Promise<ArrayBuffer> {
    const response = await this.client.audio.speech.create({
      model: options.model ?? 'tts-1',
      voice: options.voice ?? 'alloy',
      input,
      speed: options.speed,
      response_format: options.responseFormat,
    });

    return response.arrayBuffer();
  }

  /**
   * Convert speech to text (transcription)
   */
  async speechToText(
    file: Uploadable,
    options: STTOptions = {}
  ): Promise<string> {
    const response = await this.client.audio.transcriptions.create({
      model: options.model ?? 'whisper-1',
      file,
      language: options.language,
      prompt: options.prompt,
      response_format: options.responseFormat as 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt' | undefined,
      temperature: options.temperature,
    });

    return typeof response === 'string' ? response : response.text;
  }

  /**
   * Translate audio to English
   */
  async translateAudio(
    file: Uploadable,
    options: Omit<STTOptions, 'language'> = {}
  ): Promise<string> {
    const response = await this.client.audio.translations.create({
      model: options.model ?? 'whisper-1',
      file,
      prompt: options.prompt,
      response_format: options.responseFormat as 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt' | undefined,
      temperature: options.temperature,
    });

    return typeof response === 'string' ? response : response.text;
  }

  /**
   * Check content for policy violations
   */
  async moderate(
    input: string | string[],
    options: ModerationOptions = {}
  ): Promise<ModerationResult[]> {
    const response = await this.client.moderations.create({
      model: options.model ?? 'text-moderation-latest',
      input,
    });

    return response.results.map((result) => ({
      id: response.id,
      flagged: result.flagged,
      categories: result.categories as unknown as Record<string, boolean>,
      categoryScores: result.category_scores as unknown as Record<string, number>,
    }));
  }

  /**
   * List available models
   */
  async listModels(): Promise<OpenAI.Model[]> {
    const response = await this.client.models.list();
    return Array.from(response.data);
  }

  /**
   * Retrieve a specific model
   */
  async getModel(modelId: string): Promise<OpenAI.Model> {
    return this.client.models.retrieve(modelId);
  }
}
