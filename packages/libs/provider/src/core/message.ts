/**
 * Message Format Converters
 *
 * Converts between unified message format and provider-specific formats.
 */

import type {
  UnifiedMessage,
  UnifiedContent,
  UnifiedToolCall,
  UnifiedTextContent,
  UnifiedImageContent,
} from './types.js';

// ============================================
// Anthropic Message Conversion
// ============================================

/**
 * Anthropic message structure
 */
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}

export interface AnthropicImageBlock {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type?: string;
    data?: string;
    url?: string;
  };
}

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicImageBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

/**
 * Convert unified messages to Anthropic format
 * Returns system message separately as Anthropic requires it as a parameter
 */
export function toAnthropicMessages(messages: UnifiedMessage[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const system = systemMsg?.role === 'system' ? systemMsg.content : undefined;

  // Convert other messages
  const anthropicMessages: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      continue; // Skip system messages, handled separately
    }

    if (msg.role === 'user') {
      anthropicMessages.push({
        role: 'user',
        content: convertUnifiedContentToAnthropic(msg.content),
      });
    } else if (msg.role === 'assistant') {
      const content: AnthropicContentBlock[] = [];

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      if (msg.tool_calls) {
        for (const toolCall of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments),
          });
        }
      }

      anthropicMessages.push({
        role: 'assistant',
        content: content.length === 1 && content[0].type === 'text'
          ? content[0].text
          : content,
      });
    } else if (msg.role === 'tool') {
      // Tool results in Anthropic are sent as user messages with tool_result content
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: msg.content,
          },
        ],
      });
    }
  }

  // Anthropic requires messages to alternate between user and assistant
  // Merge consecutive messages of the same role
  const mergedMessages = mergeConsecutiveAnthropicMessages(anthropicMessages);

  return { system, messages: mergedMessages };
}

/**
 * Merge consecutive Anthropic messages of the same role
 */
function mergeConsecutiveAnthropicMessages(messages: AnthropicMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    const last = result[result.length - 1];

    if (last && last.role === msg.role) {
      // Merge content
      const lastContent = Array.isArray(last.content)
        ? last.content
        : [{ type: 'text' as const, text: last.content }];
      const msgContent = Array.isArray(msg.content)
        ? msg.content
        : [{ type: 'text' as const, text: msg.content }];

      last.content = [...lastContent, ...msgContent];
    } else {
      result.push({ ...msg });
    }
  }

  return result;
}

/**
 * Convert unified content to Anthropic content
 */
function convertUnifiedContentToAnthropic(
  content: UnifiedContent
): string | AnthropicContentBlock[] {
  if (typeof content === 'string') {
    return content;
  }

  const blocks: AnthropicContentBlock[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text });
    } else if (part.type === 'image_url') {
      // Try to parse as base64 data URL or use as URL
      const url = part.image_url.url;
      if (url.startsWith('data:')) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: match[1],
              data: match[2],
            },
          });
        }
      } else {
        // Anthropic requires base64, but some versions support URL
        blocks.push({
          type: 'image',
          source: {
            type: 'url',
            url,
          },
        });
      }
    }
  }

  return blocks.length === 1 && blocks[0].type === 'text' ? blocks[0].text : blocks;
}

/**
 * Convert Anthropic tool use blocks to unified tool calls
 */
export function fromAnthropicToolUse(blocks: AnthropicContentBlock[]): UnifiedToolCall[] {
  return blocks
    .filter((block): block is AnthropicToolUseBlock => block.type === 'tool_use')
    .map((block) => ({
      id: block.id,
      type: 'function' as const,
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input),
      },
    }));
}

// ============================================
// Google Gemini Message Conversion
// ============================================

/**
 * Google Gemini content structure
 */
export interface GoogleContent {
  role: 'user' | 'model';
  parts: GooglePart[];
}

export interface GoogleTextPart {
  text: string;
}

export interface GoogleInlineDataPart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface GoogleFunctionCallPart {
  functionCall: {
    name: string;
    args: Record<string, unknown>;
  };
}

export interface GoogleFunctionResponsePart {
  functionResponse: {
    name: string;
    response: Record<string, unknown>;
  };
}

export type GooglePart =
  | GoogleTextPart
  | GoogleInlineDataPart
  | GoogleFunctionCallPart
  | GoogleFunctionResponsePart;

/**
 * Convert unified messages to Google Gemini format
 * Returns system instruction separately as Gemini requires it as a parameter
 */
export function toGoogleMessages(messages: UnifiedMessage[]): {
  systemInstruction: string | undefined;
  contents: GoogleContent[];
} {
  // Extract system message
  const systemMsg = messages.find((m) => m.role === 'system');
  const systemInstruction = systemMsg?.role === 'system' ? systemMsg.content : undefined;

  // Track tool calls for function responses
  const toolCallMap = new Map<string, string>();

  // Convert other messages
  const contents: GoogleContent[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      continue; // Skip system messages, handled separately
    }

    if (msg.role === 'user') {
      contents.push({
        role: 'user',
        parts: convertUnifiedContentToGoogle(msg.content),
      });
    } else if (msg.role === 'assistant') {
      const parts: GooglePart[] = [];

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (msg.tool_calls) {
        for (const toolCall of msg.tool_calls) {
          // Track tool call ID to name mapping
          toolCallMap.set(toolCall.id, toolCall.function.name);

          parts.push({
            functionCall: {
              name: toolCall.function.name,
              args: JSON.parse(toolCall.function.arguments),
            },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({
          role: 'model',
          parts,
        });
      }
    } else if (msg.role === 'tool') {
      // Get the function name from tracked tool calls
      const functionName = toolCallMap.get(msg.tool_call_id) ?? 'unknown';

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: functionName,
              response: { result: msg.content },
            },
          },
        ],
      });
    }
  }

  return { systemInstruction, contents };
}

/**
 * Convert unified content to Google parts
 */
function convertUnifiedContentToGoogle(content: UnifiedContent): GooglePart[] {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  const parts: GooglePart[] = [];

  for (const part of content) {
    if (part.type === 'text') {
      parts.push({ text: part.text });
    } else if (part.type === 'image_url') {
      const url = part.image_url.url;
      if (url.startsWith('data:')) {
        const match = url.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }
      // Note: Gemini requires base64, URLs need to be converted
    }
  }

  return parts;
}

/**
 * Convert Google function call parts to unified tool calls
 */
export function fromGoogleFunctionCall(parts: GooglePart[]): UnifiedToolCall[] {
  return parts
    .filter((part): part is GoogleFunctionCallPart => 'functionCall' in part)
    .map((part, index) => ({
      id: `call_${Date.now()}_${index}`,
      type: 'function' as const,
      function: {
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args),
      },
    }));
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a unified text content array
 */
export function createTextContent(text: string): UnifiedTextContent[] {
  return [{ type: 'text', text }];
}

/**
 * Create a unified image content
 */
export function createImageContent(
  url: string,
  detail: 'auto' | 'low' | 'high' = 'auto'
): UnifiedImageContent {
  return {
    type: 'image_url',
    image_url: { url, detail },
  };
}

/**
 * Combine text and image content
 */
export function createMultimodalContent(
  text: string,
  imageUrl: string,
  detail: 'auto' | 'low' | 'high' = 'auto'
): (UnifiedTextContent | UnifiedImageContent)[] {
  return [
    { type: 'text', text },
    createImageContent(imageUrl, detail),
  ];
}
