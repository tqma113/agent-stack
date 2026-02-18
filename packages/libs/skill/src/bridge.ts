/**
 * @ai-stack/skill - Tool Bridge
 *
 * Converts Skill tools to Agent-compatible Tool interface
 */

import type {
  SkillToolDefinition,
  SkillToolBridgeOptions,
  BridgedSkillTool,
  AgentTool,
  LoadedSkill,
} from './types';
import type { SkillManagerInstance } from './manager';
import { generateToolName, formatErrorResult } from './helpers';

/**
 * Create Agent-compatible tools from all skills
 */
export function createSkillToolBridge(
  manager: SkillManagerInstance,
  options?: SkillToolBridgeOptions
): BridgedSkillTool[] {
  const tools: BridgedSkillTool[] = [];

  for (const skill of manager.getAllSkills()) {
    // Only include tools from loaded or active skills
    if (skill.state !== 'loaded' && skill.state !== 'active') {
      continue;
    }

    for (const resolvedTool of skill.tools) {
      // Apply filter if provided
      if (
        options?.filter &&
        !options.filter(skill.name, resolvedTool.definition)
      ) {
        continue;
      }

      const bridgedTool = bridgeSkillTool(
        skill,
        resolvedTool.definition,
        resolvedTool.handler,
        options
      );
      tools.push(bridgedTool);
    }
  }

  return tools;
}

/**
 * Convert a single skill tool to Agent tool
 */
export function bridgeSkillTool(
  skill: LoadedSkill,
  toolDef: SkillToolDefinition,
  handler: (args: Record<string, unknown>) => Promise<string>,
  options?: SkillToolBridgeOptions
): BridgedSkillTool {
  const name = generateToolName(skill.name, toolDef.name, {
    prefix: options?.namePrefix,
    includeSkillName: options?.includeSkillName,
    transformer: options?.nameTransformer,
  });

  const description = toolDef.description;
  const parameters = convertToolParameters(toolDef.parameters);

  return {
    name,
    description,
    parameters,
    skillName: skill.name,
    originalToolName: toolDef.name,
    execute: async (args: Record<string, unknown>): Promise<string> => {
      try {
        return await handler(args);
      } catch (error) {
        return formatErrorResult(error);
      }
    },
  };
}

/**
 * Convert tool parameters to ensure proper structure
 */
export function convertToolParameters(
  parameters: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!parameters) {
    return {
      type: 'object',
      properties: {},
    };
  }

  return {
    type: parameters.type ?? 'object',
    properties: parameters.properties ?? {},
    required: parameters.required ?? [],
  };
}

/**
 * Skill Tool Provider instance type (returned by factory)
 */
export interface SkillToolProviderInstance {
  /** Get all bridged tools as Agent Tool array */
  getTools(): AgentTool[];
  /** Get tools from a specific skill */
  getToolsFromSkill(skillName: string): AgentTool[];
  /** Refresh tools from all skills */
  refresh(): Promise<void>;
  /** Find tool by name */
  findTool(name: string): BridgedSkillTool | undefined;
  /** Get tool count */
  readonly count: number;
  /** Get skill names that have tools */
  getSkillsWithTools(): string[];
}

/**
 * Create a Skill Tool Provider instance
 */
export function createSkillToolProvider(
  manager: SkillManagerInstance,
  options: SkillToolBridgeOptions = {}
): SkillToolProviderInstance {
  // Private state via closure
  const tools = new Map<string, BridgedSkillTool>();

  // Helper function to build tools map
  function buildToolsMap(): void {
    tools.clear();

    const bridgedTools = createSkillToolBridge(manager, options);
    for (const tool of bridgedTools) {
      tools.set(tool.name, tool);
    }
  }

  // Initial build
  buildToolsMap();

  // Return instance object
  return {
    getTools(): AgentTool[] {
      return Array.from(tools.values());
    },

    getToolsFromSkill(skillName: string): AgentTool[] {
      return Array.from(tools.values()).filter(
        (tool) => tool.skillName === skillName
      );
    },

    async refresh(): Promise<void> {
      buildToolsMap();
    },

    findTool(name: string): BridgedSkillTool | undefined {
      return tools.get(name);
    },

    get count(): number {
      return tools.size;
    },

    getSkillsWithTools(): string[] {
      const skills = new Set<string>();
      for (const tool of tools.values()) {
        skills.add(tool.skillName);
      }
      return Array.from(skills);
    },
  };
}

