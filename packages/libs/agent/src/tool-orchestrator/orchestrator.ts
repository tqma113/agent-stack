/**
 * @ai-stack/agent - Tool Orchestrator Implementation
 *
 * Intelligent tool selection and execution planning.
 */

import type { Tool, ToolCallResult } from '../types.js';
import type {
  ToolOrchestratorConfig,
  ToolOrchestratorInstance,
  ToolChain,
  ToolChainStep,
  ToolChainResult,
  ToolMetadata,
  PlanningContext,
  ExecutionContext,
} from './types.js';
import { DEFAULT_TOOL_ORCHESTRATOR_CONFIG } from './types.js';

/**
 * Generate a simple UUID (fallback if uuid package not available)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * LLM function type for planning
 */
export type PlannerLLMFn = (prompt: string) => Promise<string>;

/**
 * Default tool relationships
 */
const DEFAULT_TOOL_RELATIONSHIPS: Record<string, { successors: string[]; predecessors: string[] }> = {
  Read: { successors: ['Edit', 'Write'], predecessors: ['Glob', 'Grep'] },
  Write: { successors: [], predecessors: ['Read'] },
  Edit: { successors: [], predecessors: ['Read'] },
  Glob: { successors: ['Read', 'Grep'], predecessors: [] },
  Grep: { successors: ['Read'], predecessors: ['Glob'] },
};

/**
 * Default tool categories
 */
const DEFAULT_TOOL_CATEGORIES: Record<string, ToolMetadata['category']> = {
  Read: 'read',
  Write: 'write',
  Edit: 'write',
  Glob: 'search',
  Grep: 'search',
  AskUser: 'interact',
};

/**
 * Create a tool orchestrator instance
 */
export function createToolOrchestrator(
  config: Partial<ToolOrchestratorConfig> = {},
  llmPlan?: PlannerLLMFn
): ToolOrchestratorInstance {
  const mergedConfig: Required<ToolOrchestratorConfig> = {
    ...DEFAULT_TOOL_ORCHESTRATOR_CONFIG,
    ...config,
  };

  // Tool metadata registry
  const toolMetadata = new Map<string, ToolMetadata>();

  // Execution statistics
  const executionStats = new Map<string, { successes: number; failures: number; totalMs: number }>();

  /**
   * Initialize default tool metadata
   */
  function initializeDefaultMetadata(tools: Tool[]): void {
    for (const tool of tools) {
      if (!toolMetadata.has(tool.name)) {
        const relationships = DEFAULT_TOOL_RELATIONSHIPS[tool.name];
        toolMetadata.set(tool.name, {
          name: tool.name,
          category: DEFAULT_TOOL_CATEGORIES[tool.name] ?? 'other',
          commonSuccessors: relationships?.successors ?? [],
          commonPredecessors: relationships?.predecessors ?? [],
          hasSideEffects: ['Write', 'Edit', 'Delete'].includes(tool.name),
          avgExecutionMs: 1000,
          failureRate: 0.1,
        });
      }
    }
  }

  /**
   * Simple rule-based planning
   */
  function createRuleBasedPlan(goal: string, context: PlanningContext): ToolChain {
    const steps: ToolChainStep[] = [];
    const goalLower = goal.toLowerCase();

    // Analyze goal to determine needed tools
    const needsRead = goalLower.includes('read') || goalLower.includes('view') || goalLower.includes('show');
    const needsWrite = goalLower.includes('write') || goalLower.includes('create') || goalLower.includes('save');
    const needsEdit = goalLower.includes('edit') || goalLower.includes('modify') || goalLower.includes('change') || goalLower.includes('update');
    const needsSearch = goalLower.includes('find') || goalLower.includes('search') || goalLower.includes('look for');

    const availableToolNames = context.availableTools.map(t => t.name);

    // Add search step if needed
    if (needsSearch && (availableToolNames.includes('Glob') || availableToolNames.includes('Grep'))) {
      steps.push({
        id: generateId(),
        toolName: goalLower.includes('content') ? 'Grep' : 'Glob',
        args: {},
        description: 'Search for relevant files',
        priority: 1,
      });
    }

    // Add read step if needed
    if ((needsRead || needsEdit) && availableToolNames.includes('Read')) {
      steps.push({
        id: generateId(),
        toolName: 'Read',
        args: {},
        description: 'Read file content',
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : undefined,
        priority: 2,
      });
    }

    // Add edit step if needed
    if (needsEdit && availableToolNames.includes('Edit')) {
      steps.push({
        id: generateId(),
        toolName: 'Edit',
        args: {},
        description: 'Edit file content',
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : undefined,
        priority: 3,
      });
    }

    // Add write step if needed
    if (needsWrite && availableToolNames.includes('Write')) {
      steps.push({
        id: generateId(),
        toolName: 'Write',
        args: {},
        description: 'Write file content',
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : undefined,
        priority: 3,
      });
    }

    return {
      id: generateId(),
      steps,
      goal,
    };
  }

  return {
    async plan(goal: string, context?: PlanningContext): Promise<ToolChain> {
      if (!context) {
        return {
          id: generateId(),
          steps: [],
          goal,
        };
      }

      // Initialize metadata for available tools
      initializeDefaultMetadata(context.availableTools);

      // Use LLM planning if available
      if (llmPlan) {
        try {
          const toolList = context.availableTools
            .map(t => `- ${t.name}: ${t.description.substring(0, 100)}`)
            .join('\n');

          const prompt = `You are a tool orchestrator. Given the goal and available tools, create a plan.

Goal: ${goal}

Available tools:
${toolList}

${context.additionalContext ? `Additional context: ${context.additionalContext}` : ''}

Respond with a JSON object:
{
  "steps": [
    { "toolName": "ToolName", "description": "What this step does" }
  ]
}

Only include necessary steps. Respond ONLY with the JSON object.`;

          const response = await llmPlan(prompt);

          // Parse response
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as { steps: Array<{ toolName: string; description: string }> };
            const steps: ToolChainStep[] = parsed.steps.map((step, i) => ({
              id: generateId(),
              toolName: step.toolName,
              args: {},
              description: step.description,
              dependsOn: i > 0 ? [parsed.steps[i - 1].toolName] : undefined,
              priority: i + 1,
            }));

            return {
              id: generateId(),
              steps,
              goal,
            };
          }
        } catch {
          // Fall back to rule-based planning
        }
      }

      // Rule-based planning fallback
      return createRuleBasedPlan(goal, context);
    },

    async execute(chain: ToolChain): Promise<ToolChainResult> {
      const startTime = Date.now();
      const stepResults: ToolChainResult['stepResults'] = [];

      // Note: This is a simplified executor that returns planned steps
      // Full execution would require access to the actual tool implementations

      for (const step of chain.steps) {
        stepResults.push({
          stepId: step.id,
          toolName: step.toolName,
          result: `[Planned: ${step.description ?? step.toolName}]`,
          success: true,
          durationMs: 0,
        });
      }

      return {
        success: true,
        stepResults,
        totalDurationMs: Date.now() - startTime,
        usedFallback: false,
      };
    },

    getFallback(toolName: string, _error: Error): ToolChain | null {
      // Simple fallback strategies
      const fallbacks: Record<string, ToolChainStep[]> = {
        Edit: [{ id: generateId(), toolName: 'Write', args: {}, description: 'Use Write as fallback for Edit' }],
        Grep: [{ id: generateId(), toolName: 'Glob', args: {}, description: 'Use Glob to find files, then Read' }],
      };

      const fallbackSteps = fallbacks[toolName];
      if (fallbackSteps) {
        return {
          id: generateId(),
          steps: fallbackSteps,
          goal: `Fallback for ${toolName}`,
        };
      }

      return null;
    },

    suggestNextTools(context: ExecutionContext): string[] {
      if (!context.lastToolCall) {
        // Suggest starting tools
        if (context.availableTools.includes('Glob')) return ['Glob', 'Grep'];
        return context.availableTools.slice(0, 3);
      }

      const lastTool = context.lastToolCall.name;
      const metadata = toolMetadata.get(lastTool);

      if (metadata?.commonSuccessors) {
        return metadata.commonSuccessors.filter(t => context.availableTools.includes(t));
      }

      // Default suggestions based on relationships
      const relationships = DEFAULT_TOOL_RELATIONSHIPS[lastTool];
      if (relationships?.successors) {
        return relationships.successors.filter(t => context.availableTools.includes(t));
      }

      return [];
    },

    recordExecution(toolName: string, success: boolean, durationMs: number): void {
      const existing = executionStats.get(toolName) ?? { successes: 0, failures: 0, totalMs: 0 };

      if (success) {
        existing.successes++;
      } else {
        existing.failures++;
      }
      existing.totalMs += durationMs;

      executionStats.set(toolName, existing);

      // Update metadata
      const metadata = toolMetadata.get(toolName);
      if (metadata) {
        const total = existing.successes + existing.failures;
        metadata.avgExecutionMs = existing.totalMs / total;
        metadata.failureRate = existing.failures / total;
      }
    },

    getToolMetadata(toolName: string): ToolMetadata | null {
      return toolMetadata.get(toolName) ?? null;
    },

    registerToolMetadata(metadata: ToolMetadata): void {
      toolMetadata.set(metadata.name, metadata);
    },
  };
}
