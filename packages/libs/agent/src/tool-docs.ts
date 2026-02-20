/**
 * Tool Documentation Generator
 *
 * Based on Anthropic's "Building Effective Agents" recommendations:
 * - Provide clear examples
 * - Document edge cases
 * - Give hints for proper usage
 */

import type { Tool, ToolExample } from './types.js';

/**
 * Generate enhanced tool description for LLM consumption
 *
 * Creates a rich description including examples, hints, edge cases,
 * and constraints to help LLM use the tool correctly.
 */
export function generateToolDescription(tool: Tool): string {
  const sections: string[] = [];

  // Base description
  sections.push(tool.description);

  // Return format
  if (tool.returnFormat) {
    sections.push(`\n**Returns**: ${tool.returnFormat}`);
  }

  // Examples
  if (tool.examples && tool.examples.length > 0) {
    sections.push('\n**Examples**:');
    for (const example of tool.examples) {
      const inputStr = JSON.stringify(example.input, null, 0);
      sections.push(`- Input: \`${inputStr}\``);
      // Truncate long outputs
      const outputDisplay = example.output.length > 100
        ? example.output.slice(0, 100) + '...'
        : example.output;
      sections.push(`  Output: \`${outputDisplay}\``);
      if (example.description) {
        sections.push(`  (${example.description})`);
      }
    }
  }

  // Hints
  if (tool.hints && tool.hints.length > 0) {
    sections.push('\n**Tips**:');
    for (const hint of tool.hints) {
      sections.push(`- ${hint}`);
    }
  }

  // Edge cases
  if (tool.edgeCases && tool.edgeCases.length > 0) {
    sections.push('\n**Edge Cases**:');
    for (const edgeCase of tool.edgeCases) {
      sections.push(`- ${edgeCase}`);
    }
  }

  // Constraints
  if (tool.constraints && tool.constraints.length > 0) {
    sections.push('\n**Constraints**:');
    for (const constraint of tool.constraints) {
      sections.push(`- ${constraint}`);
    }
  }

  // Related tools
  if (tool.relatedTools && tool.relatedTools.length > 0) {
    sections.push(`\n**Related tools**: ${tool.relatedTools.join(', ')}`);
  }

  // Anti-patterns
  if (tool.antiPatterns && tool.antiPatterns.length > 0) {
    sections.push('\n**Avoid**:');
    for (const antiPattern of tool.antiPatterns) {
      sections.push(`- ${antiPattern}`);
    }
  }

  return sections.join('\n');
}

/**
 * Convert tool to OpenAI function definition with enhanced description
 */
export function toolToFunctionDef(tool: Tool, enhanced = true) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: enhanced ? generateToolDescription(tool) : tool.description,
      parameters: tool.parameters,
    },
  };
}

/**
 * Convert multiple tools to OpenAI function definitions
 */
export function toolsToFunctionDefs(tools: Tool[], enhanced = true) {
  return tools.map(tool => toolToFunctionDef(tool, enhanced));
}

/**
 * Create a minimal tool description (for token efficiency)
 */
export function generateMinimalDescription(tool: Tool): string {
  const parts = [tool.description];

  // Only include one example if available
  if (tool.examples && tool.examples.length > 0) {
    const ex = tool.examples[0];
    parts.push(`Example: ${JSON.stringify(ex.input)} → ${ex.output.slice(0, 50)}`);
  }

  // Only include critical constraints
  if (tool.constraints && tool.constraints.length > 0) {
    parts.push(`Limits: ${tool.constraints.slice(0, 2).join(', ')}`);
  }

  return parts.join(' | ');
}

/**
 * Estimate token count for tool description
 * (Rough estimate: ~4 chars per token)
 */
export function estimateToolDescriptionTokens(tool: Tool, enhanced = true): number {
  const description = enhanced
    ? generateToolDescription(tool)
    : tool.description;
  return Math.ceil(description.length / 4);
}

/**
 * Optimize tool descriptions to fit within token budget
 *
 * If total tokens exceed budget, progressively simplifies descriptions:
 * 1. Remove anti-patterns
 * 2. Remove related tools
 * 3. Reduce examples to 1
 * 4. Use minimal descriptions
 */
export function optimizeToolsForBudget(
  tools: Tool[],
  maxTokens: number
): { tools: Tool[]; enhanced: boolean } {
  // First try with full enhanced descriptions
  let totalTokens = tools.reduce(
    (sum, tool) => sum + estimateToolDescriptionTokens(tool, true),
    0
  );

  if (totalTokens <= maxTokens) {
    return { tools, enhanced: true };
  }

  // Simplify: remove optional fields
  const simplifiedTools = tools.map(tool => ({
    ...tool,
    antiPatterns: undefined,
    relatedTools: undefined,
    examples: tool.examples?.slice(0, 1),
  }));

  totalTokens = simplifiedTools.reduce(
    (sum, tool) => sum + estimateToolDescriptionTokens(tool, true),
    0
  );

  if (totalTokens <= maxTokens) {
    return { tools: simplifiedTools, enhanced: true };
  }

  // Fall back to minimal descriptions
  return { tools, enhanced: false };
}
