/**
 * @ai-stack/agent - Planner Implementation
 *
 * LLM-powered plan generation with support for
 * structured decomposition and dynamic replanning.
 */

import type {
  PlannerConfig,
  PlanContext,
  PlanNode,
} from './types.js';
import { DEFAULT_PLANNER_CONFIG } from './types.js';
import { createPlanDAG, type PlanDAGInstance } from './plan-dag.js';

// =============================================================================
// Planner Instance Interface
// =============================================================================

/**
 * Planner instance interface
 */
export interface PlannerInstance {
  /** Generate execution plan from goal */
  plan(goal: string, context?: PlanContext): Promise<PlanDAGInstance>;

  /** Replan based on failure or new information */
  replan(dag: PlanDAGInstance, reason: string, context?: PlanContext): Promise<PlanDAGInstance>;

  /** Decompose a complex step into sub-steps */
  decompose(node: PlanNode, context?: PlanContext): Promise<PlanNode[]>;

  /** Get planning prompt for debugging */
  getPlanPrompt(goal: string, context?: PlanContext): string;
}

// =============================================================================
// Default Prompts
// =============================================================================

/**
 * Default planning prompt
 */
export const DEFAULT_PLAN_PROMPT = `You are a task planner. Given a goal, create a structured execution plan.

Output a JSON object with the following structure:
{
  "reasoning": "Brief explanation of your planning approach",
  "steps": [
    {
      "id": "step_1",
      "description": "Clear description of what this step accomplishes",
      "tool": "tool_name_to_use",
      "args": { "arg1": "value1" },
      "dependsOn": [],
      "parallel": true,
      "priority": 1,
      "estimatedDurationMs": 5000
    }
  ]
}

Rules:
1. Each step should be atomic and independently executable
2. Use "dependsOn" to specify dependencies (step IDs that must complete first)
3. Steps with no dependencies can run in parallel if parallel=true
4. Lower priority number = higher priority (execute first when possible)
5. Tool names must match available tools exactly
6. Estimate duration in milliseconds for better scheduling
7. Keep descriptions concise but specific
8. Maximum {{maxSteps}} steps allowed

Available tools:
{{tools}}

Goal: {{goal}}

{{#if constraints}}
Constraints:
{{constraints}}
{{/if}}

{{#if additionalContext}}
Additional context:
{{additionalContext}}
{{/if}}

Respond ONLY with the JSON object, no additional text.`;

/**
 * Replanning prompt
 */
export const REPLAN_PROMPT = `You need to adjust the execution plan due to a failure or change.

Reason for replanning: {{reason}}

{{#if failureInfo}}
Failed step:
- ID: {{failureInfo.nodeId}}
- Error: {{failureInfo.error}}
- Attempt: {{failureInfo.attempt}}
{{/if}}

Completed steps and their results:
{{completedSteps}}

Remaining steps that need adjustment:
{{remainingSteps}}

Available tools:
{{tools}}

Original goal: {{goal}}

Please provide updated steps that:
1. Account for the completed work
2. Address the failure (if applicable)
3. Achieve the original goal

Output format (JSON):
{
  "reasoning": "Why you're making these changes",
  "steps": [
    // New or modified steps...
  ],
  "removedStepIds": ["step_ids_to_remove"]
}

Respond ONLY with the JSON object.`;

/**
 * Decomposition prompt
 */
export const DECOMPOSE_PROMPT = `Break down this complex step into smaller, atomic sub-steps.

Step to decompose:
- ID: {{nodeId}}
- Description: {{description}}
- Tool: {{tool}}
- Args: {{args}}

Available tools:
{{tools}}

Create 2-5 sub-steps that together accomplish this step's goal.

Output format (JSON):
{
  "reasoning": "Why this decomposition makes sense",
  "substeps": [
    {
      "id": "{{nodeId}}_sub_1",
      "description": "What this sub-step does",
      "tool": "tool_name",
      "args": {},
      "dependsOn": [],
      "parallel": true
    }
  ]
}

Respond ONLY with the JSON object.`;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract JSON from LLM response (handles markdown code blocks)
 */
function extractJSON(response: string): string {
  // Try to extract from markdown code block
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to find raw JSON object
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return response.trim();
}

/**
 * Simple template rendering
 */
function renderTemplate(
  template: string,
  vars: Record<string, unknown>
): string {
  let result = template;

  // Handle simple variable substitution
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }

  // Handle conditional blocks {{#if var}}...{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const value = vars[varName];
      return value ? content : '';
    }
  );

  return result;
}

// =============================================================================
// Planner Factory
// =============================================================================

/**
 * LLM chat function type
 */
export type LLMChatFn = (prompt: string, model?: string) => Promise<string>;

/**
 * Create planner instance
 */
export function createPlanner(
  config: PlannerConfig,
  llmChat: LLMChatFn
): PlannerInstance {
  const mergedConfig = { ...DEFAULT_PLANNER_CONFIG, ...config };

  /**
   * Format tools for prompt
   */
  function formatTools(tools: PlanContext['availableTools']): string {
    if (!tools || tools.length === 0) {
      return 'No tools available.';
    }

    return tools.map(tool => {
      let desc = `- ${tool.name}: ${tool.description}`;
      if (tool.parameters) {
        desc += `\n  Parameters: ${JSON.stringify(tool.parameters)}`;
      }
      return desc;
    }).join('\n');
  }

  /**
   * Generate plan prompt
   */
  function getPlanPrompt(goal: string, context?: PlanContext): string {
    const template = config.planPrompt ?? DEFAULT_PLAN_PROMPT;

    return renderTemplate(template, {
      maxSteps: mergedConfig.maxSteps,
      goal,
      tools: formatTools(context?.availableTools),
      constraints: context?.constraints?.join('\n'),
      additionalContext: context?.additionalContext
        ? JSON.stringify(context.additionalContext, null, 2)
        : undefined,
    });
  }

  return {
    async plan(goal: string, context?: PlanContext): Promise<PlanDAGInstance> {
      const prompt = getPlanPrompt(goal, context);

      // Call LLM
      const response = await llmChat(prompt, config.model);

      // Parse response
      const jsonStr = extractJSON(response);
      let planData: {
        reasoning?: string;
        steps: Array<{
          id: string;
          description: string;
          tool?: string;
          args?: Record<string, unknown>;
          dependsOn?: string[];
          parallel?: boolean;
          priority?: number;
          estimatedDurationMs?: number;
        }>;
      };

      try {
        planData = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Failed to parse plan response: ${(e as Error).message}\nResponse: ${response}`);
      }

      // Create DAG
      const dag = createPlanDAG(goal, planData.reasoning);

      // Add nodes
      for (const step of planData.steps) {
        dag.addNode({
          id: step.id,
          description: step.description,
          tool: step.tool,
          args: step.args,
          dependsOn: step.dependsOn ?? [],
          parallel: step.parallel ?? true,
          priority: step.priority,
          estimatedDurationMs: step.estimatedDurationMs,
        });
      }

      // Validate if configured
      if (mergedConfig.validateBeforeExecution) {
        const validation = dag.validate();
        if (!validation.valid) {
          throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
        }
      }

      return dag;
    },

    async replan(
      dag: PlanDAGInstance,
      reason: string,
      context?: PlanContext
    ): Promise<PlanDAGInstance> {
      const currentDAG = dag.getDAG();
      const allNodes = dag.getAllNodes();

      // Separate completed and remaining steps
      const completedSteps = allNodes
        .filter(n => n.status === 'completed')
        .map(n => ({ id: n.id, description: n.description, result: n.result }));

      const remainingSteps = allNodes
        .filter(n => n.status !== 'completed' && n.status !== 'skipped')
        .map(n => ({ id: n.id, description: n.description, tool: n.tool }));

      const prompt = renderTemplate(REPLAN_PROMPT, {
        reason,
        goal: currentDAG.goal,
        failureInfo: context?.failureInfo
          ? JSON.stringify(context.failureInfo, null, 2)
          : undefined,
        completedSteps: JSON.stringify(completedSteps, null, 2),
        remainingSteps: JSON.stringify(remainingSteps, null, 2),
        tools: formatTools(context?.availableTools),
      });

      const response = await llmChat(prompt, config.model);
      const jsonStr = extractJSON(response);

      let replanData: {
        reasoning?: string;
        steps: Array<{
          id: string;
          description: string;
          tool?: string;
          args?: Record<string, unknown>;
          dependsOn?: string[];
          parallel?: boolean;
          priority?: number;
        }>;
        removedStepIds?: string[];
      };

      try {
        replanData = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Failed to parse replan response: ${(e as Error).message}`);
      }

      // Remove specified steps
      if (replanData.removedStepIds) {
        for (const stepId of replanData.removedStepIds) {
          dag.removeNode(stepId);
        }
      }

      // Add new steps
      for (const step of replanData.steps) {
        // Check if step already exists (update) or is new (add)
        const existing = dag.getNode(step.id);
        if (existing) {
          // Update by removing and re-adding
          dag.removeNode(step.id);
        }

        dag.addNode({
          id: step.id,
          description: step.description,
          tool: step.tool,
          args: step.args,
          dependsOn: step.dependsOn ?? [],
          parallel: step.parallel ?? true,
          priority: step.priority,
        });
      }

      return dag;
    },

    async decompose(node: PlanNode, context?: PlanContext): Promise<PlanNode[]> {
      const prompt = renderTemplate(DECOMPOSE_PROMPT, {
        nodeId: node.id,
        description: node.description,
        tool: node.tool ?? 'none',
        args: JSON.stringify(node.args ?? {}),
        tools: formatTools(context?.availableTools),
      });

      const response = await llmChat(prompt, config.model);
      const jsonStr = extractJSON(response);

      let decomposeData: {
        reasoning?: string;
        substeps: Array<{
          id: string;
          description: string;
          tool?: string;
          args?: Record<string, unknown>;
          dependsOn?: string[];
          parallel?: boolean;
        }>;
      };

      try {
        decomposeData = JSON.parse(jsonStr);
      } catch (e) {
        throw new Error(`Failed to parse decompose response: ${(e as Error).message}`);
      }

      // Convert to PlanNode array
      return decomposeData.substeps.map((step, index) => ({
        id: step.id,
        description: step.description,
        tool: step.tool,
        args: step.args,
        dependsOn: step.dependsOn ?? (index > 0 ? [decomposeData.substeps[index - 1].id] : []),
        dependents: [],
        blockedBy: [],
        parallel: step.parallel ?? true,
        status: 'pending' as const,
      }));
    },

    getPlanPrompt,
  };
}

// =============================================================================
// Convenience Factory
// =============================================================================

/**
 * Create a simple rule-based planner (no LLM)
 *
 * Useful for testing or when LLM planning is not needed.
 */
export function createRuleBasedPlanner(
  rules: Array<{
    pattern: RegExp | string;
    generateSteps: (goal: string, match: RegExpMatchArray | null) => Array<Omit<PlanNode, 'status' | 'dependents' | 'blockedBy'>>;
  }>
): PlannerInstance {
  return {
    async plan(goal: string): Promise<PlanDAGInstance> {
      const dag = createPlanDAG(goal);

      // Find matching rule
      for (const rule of rules) {
        const pattern = typeof rule.pattern === 'string'
          ? new RegExp(rule.pattern, 'i')
          : rule.pattern;

        const match = goal.match(pattern);
        if (match) {
          const steps = rule.generateSteps(goal, match);
          for (const step of steps) {
            dag.addNode(step);
          }
          return dag;
        }
      }

      // Default: single step plan
      dag.addNode({
        id: 'step_1',
        description: goal,
        dependsOn: [],
      });

      return dag;
    },

    async replan(dag: PlanDAGInstance): Promise<PlanDAGInstance> {
      // Rule-based planner doesn't support replanning
      return dag;
    },

    async decompose(node: PlanNode): Promise<PlanNode[]> {
      // Rule-based planner doesn't support decomposition
      return [node];
    },

    getPlanPrompt(): string {
      return '[Rule-based planner - no prompt]';
    },
  };
}
