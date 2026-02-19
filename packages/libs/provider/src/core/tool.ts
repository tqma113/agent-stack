/**
 * Tool Format Converters
 *
 * Converts between unified tool format and provider-specific formats.
 */

import type { UnifiedTool, UnifiedToolChoice } from './types.js';

// ============================================
// Anthropic Tool Conversion
// ============================================

/**
 * Anthropic tool definition
 */
export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Anthropic tool choice
 */
export type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };

/**
 * Convert unified tool to Anthropic format
 */
export function toAnthropicTool(tool: UnifiedTool): AnthropicTool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: tool.function.parameters,
  };
}

/**
 * Convert unified tools to Anthropic format
 */
export function toAnthropicTools(tools: UnifiedTool[]): AnthropicTool[] {
  return tools.map(toAnthropicTool);
}

/**
 * Convert unified tool choice to Anthropic format
 */
export function toAnthropicToolChoice(
  choice: UnifiedToolChoice | undefined
): AnthropicToolChoice | undefined {
  if (!choice) return undefined;

  if (choice === 'none') {
    // Anthropic doesn't have 'none', return undefined to disable tools
    return undefined;
  }

  if (choice === 'auto') {
    return { type: 'auto' };
  }

  if (choice === 'required') {
    return { type: 'any' };
  }

  if (typeof choice === 'object' && choice.type === 'function') {
    return {
      type: 'tool',
      name: choice.function.name,
    };
  }

  return { type: 'auto' };
}

// ============================================
// Google Gemini Tool Conversion
// ============================================

/**
 * Google function declaration
 */
export interface GoogleFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Google tool definition
 */
export interface GoogleTool {
  functionDeclarations: GoogleFunctionDeclaration[];
}

/**
 * Google tool config
 */
export interface GoogleToolConfig {
  functionCallingConfig: {
    mode: 'AUTO' | 'ANY' | 'NONE';
    allowedFunctionNames?: string[];
  };
}

/**
 * Convert unified tool to Google function declaration
 */
export function toGoogleFunctionDeclaration(tool: UnifiedTool): GoogleFunctionDeclaration {
  return {
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  };
}

/**
 * Convert unified tools to Google format
 */
export function toGoogleTools(tools: UnifiedTool[]): GoogleTool[] {
  if (tools.length === 0) return [];

  return [
    {
      functionDeclarations: tools.map(toGoogleFunctionDeclaration),
    },
  ];
}

/**
 * Convert unified tool choice to Google tool config
 */
export function toGoogleToolConfig(
  choice: UnifiedToolChoice | undefined
): GoogleToolConfig | undefined {
  if (!choice) {
    return {
      functionCallingConfig: {
        mode: 'AUTO',
      },
    };
  }

  if (choice === 'none') {
    return {
      functionCallingConfig: {
        mode: 'NONE',
      },
    };
  }

  if (choice === 'auto') {
    return {
      functionCallingConfig: {
        mode: 'AUTO',
      },
    };
  }

  if (choice === 'required') {
    return {
      functionCallingConfig: {
        mode: 'ANY',
      },
    };
  }

  if (typeof choice === 'object' && choice.type === 'function') {
    return {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [choice.function.name],
      },
    };
  }

  return undefined;
}

// ============================================
// OpenAI Format (passthrough)
// ============================================

/**
 * OpenAI tool definition (same as unified)
 */
export type OpenAITool = UnifiedTool;

/**
 * OpenAI tool choice (same as unified)
 */
export type OpenAIToolChoice = UnifiedToolChoice;

/**
 * Convert unified tool to OpenAI format (passthrough)
 */
export function toOpenAITool(tool: UnifiedTool): OpenAITool {
  return tool;
}

/**
 * Convert unified tools to OpenAI format (passthrough)
 */
export function toOpenAITools(tools: UnifiedTool[]): OpenAITool[] {
  return tools;
}

/**
 * Convert unified tool choice to OpenAI format (passthrough)
 */
export function toOpenAIToolChoice(
  choice: UnifiedToolChoice | undefined
): OpenAIToolChoice | undefined {
  return choice;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Create a unified tool definition
 */
export function createTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): UnifiedTool {
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
 * Create JSON Schema parameters for a tool
 */
export function createParameters(
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
 * Validate tool definition
 */
export function isValidTool(tool: unknown): tool is UnifiedTool {
  if (!tool || typeof tool !== 'object') return false;

  const t = tool as UnifiedTool;
  return (
    t.type === 'function' &&
    typeof t.function === 'object' &&
    typeof t.function.name === 'string' &&
    typeof t.function.description === 'string' &&
    typeof t.function.parameters === 'object'
  );
}
