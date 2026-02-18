/**
 * Helper functions for OpenAI API
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * Create a system message
 */
export function systemMessage(content: string): ChatCompletionMessageParam {
  return { role: 'system', content };
}

/**
 * Create a user message
 */
export function userMessage(content: string): ChatCompletionMessageParam {
  return { role: 'user', content };
}

/**
 * Create a user message with image
 */
export function userMessageWithImage(
  text: string,
  imageUrl: string,
  detail: 'auto' | 'low' | 'high' = 'auto'
): ChatCompletionMessageParam {
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageUrl, detail } },
    ],
  };
}

/**
 * Create an assistant message
 */
export function assistantMessage(content: string): ChatCompletionMessageParam {
  return { role: 'assistant', content };
}

/**
 * Create a tool result message
 */
export function toolMessage(
  toolCallId: string,
  content: string
): ChatCompletionMessageParam {
  return { role: 'tool', tool_call_id: toolCallId, content };
}

/**
 * Define a function tool for chat completions
 */
export function defineTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
} {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters,
    },
  };
}

/**
 * Define JSON Schema parameters for a tool
 */
export function defineParameters(
  properties: Record<string, unknown>,
  required: string[] = []
): Record<string, unknown> {
  return {
    type: 'object',
    properties,
    required,
  };
}

/**
 * Estimate token count for a string (rough approximation)
 * For accurate counts, use tiktoken library
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximately fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedChars = maxTokens * 4;
  if (text.length <= estimatedChars) {
    return text;
  }
  return text.slice(0, estimatedChars - 3) + '...';
}

/**
 * Split text into chunks that fit within token limit
 */
export function chunkText(text: string, maxTokensPerChunk: number): string[] {
  const estimatedCharsPerChunk = maxTokensPerChunk * 4;
  const chunks: string[] = [];

  // Try to split on paragraph boundaries
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length + 2 <= estimatedCharsPerChunk) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If paragraph itself is too long, split it further
      if (paragraph.length > estimatedCharsPerChunk) {
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        currentChunk = '';
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length + 1 <= estimatedCharsPerChunk) {
            currentChunk += (currentChunk ? ' ' : '') + sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}
