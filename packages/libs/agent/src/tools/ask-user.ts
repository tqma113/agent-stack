/**
 * @ai-stack/agent - AskUser Tool
 *
 * Allows the agent to ask the user questions and receive responses.
 * This is a built-in tool that can be enabled by providing an onAskUser callback.
 */

import type { Tool } from '../types.js';

/**
 * Option for user selection
 */
export interface AskUserOption {
  /** Display label */
  label: string;
  /** Value returned when selected */
  value: string;
  /** Optional description */
  description?: string;
}

/**
 * Parameters for AskUser tool
 */
export interface AskUserParams {
  /** The question to ask the user */
  question: string;
  /** Optional choices for the user to select from */
  options?: AskUserOption[];
  /** Reason for asking (helps user understand context) */
  reason?: string;
}

/**
 * Callback type for handling user questions
 */
export type OnAskUserCallback = (
  question: string,
  options?: AskUserOption[]
) => Promise<string | null>;

/**
 * Create the AskUser tool
 *
 * @param onAskUser - Callback to handle user interaction
 * @returns Tool definition
 */
export function createAskUserTool(onAskUser: OnAskUserCallback): Tool {
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

      // Build the full question with reason if provided
      const fullQuestion = reason ? `${question}\n\nReason: ${reason}` : question;

      // Ask the user
      const response = await onAskUser(fullQuestion, options);

      if (response === null) {
        return 'User cancelled the question';
      }

      return response;
    },
  };
}
