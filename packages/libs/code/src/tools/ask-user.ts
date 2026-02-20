/**
 * @ai-stack/code - AskUser Tool
 *
 * Allows the agent to ask the user questions and receive responses.
 */

import type { Tool } from '@ai-stack/agent';
import type { ToolContext } from '../types.js';

export interface AskUserParams {
  /** The question to ask the user */
  question: string;
  /** Optional choices for the user to select from */
  options?: Array<{
    label: string;
    value: string;
    description?: string;
  }>;
  /** Reason for asking (helps user understand context) */
  reason?: string;
}

/**
 * Create the AskUser tool
 */
export function createAskUserTool(context: ToolContext): Tool {
  return {
    name: 'AskUser',
    description: `Ask the user a question and wait for their response.

Use this tool when you need:
- Clarification on ambiguous instructions
- User preferences or choices between options
- Confirmation before taking important actions
- Additional information to complete a task

Parameters:
- question: The question to ask (required)
- options: Optional array of choices [{label, value, description}]
- reason: Optional explanation of why you're asking

If options are provided, user will select from them.
Otherwise, user provides free-form text input.

Returns the user's response, or "User cancelled" if they cancel.`,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The question to ask the user',
        },
        options: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Display label for the option' },
              value: { type: 'string', description: 'Value to return if selected' },
              description: { type: 'string', description: 'Optional description of the option' },
            },
            required: ['label', 'value'],
          },
          description: 'Optional choices for the user to select from',
        },
        reason: {
          type: 'string',
          description: 'Reason for asking (helps user understand context)',
        },
      },
      required: ['question'],
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as unknown as AskUserParams;
      const { question, options, reason } = params;

      if (!context.onAskUser) {
        return 'Error: User interaction not available in this environment';
      }

      // Build the full question with reason if provided
      const fullQuestion = reason ? `${question}\n\nReason: ${reason}` : question;

      // Ask the user
      const response = await context.onAskUser(fullQuestion, options);

      if (response === null) {
        return 'User cancelled the question';
      }

      return response;
    },
  };
}
