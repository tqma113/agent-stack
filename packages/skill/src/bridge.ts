/**
 * @agent-stack/skill - Tool Bridge
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
import type { SkillManager } from './manager';
import { generateToolName, formatErrorResult } from './helpers';

/**
 * Create Agent-compatible tools from all skills
 */
export function createSkillToolBridge(
  manager: SkillManager,
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
 * SkillToolProvider class for easier integration with Agent
 */
export class SkillToolProvider {
  private manager: SkillManager;
  private options: SkillToolBridgeOptions;
  private tools: Map<string, BridgedSkillTool> = new Map();

  constructor(manager: SkillManager, options: SkillToolBridgeOptions = {}) {
    this.manager = manager;
    this.options = options;
    this.buildToolsMap();
  }

  /**
   * Get all bridged tools as Agent Tool array
   */
  getTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools from a specific skill
   */
  getToolsFromSkill(skillName: string): AgentTool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.skillName === skillName
    );
  }

  /**
   * Refresh tools from all skills
   */
  async refresh(): Promise<void> {
    this.buildToolsMap();
  }

  /**
   * Find tool by name
   */
  findTool(name: string): BridgedSkillTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }

  /**
   * Get skill names that have tools
   */
  getSkillsWithTools(): string[] {
    const skills = new Set<string>();
    for (const tool of this.tools.values()) {
      skills.add(tool.skillName);
    }
    return Array.from(skills);
  }

  /**
   * Build tools map from manager
   */
  private buildToolsMap(): void {
    this.tools.clear();

    const bridgedTools = createSkillToolBridge(this.manager, this.options);
    for (const tool of bridgedTools) {
      this.tools.set(tool.name, tool);
    }
  }
}
