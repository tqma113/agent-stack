/**
 * @ai-stack/skill - Skill Manager
 *
 * Manages skill lifecycle, loading, and state
 */

import type {
  SkillConfig,
  SkillEntry,
  LoadedSkill,
  SkillState,
  ResolvedTool,
  SkillManagerOptions,
  SkillEventType,
  SkillEventHandler,
  SkillDefinition,
  AgentTool,
} from './types';
import { SkillNotFoundError, SkillLoadError } from './types';
import { loadConfig, loadConfigFromDefaults, discoverSkills } from './config';
import { loadSkill, loadSkillFromDirectory } from './loader';
import { generateToolName, formatErrorResult } from './helpers';

/**
 * Skill Manager instance type (returned by factory)
 */
export interface SkillManagerInstance {
  // Initialization
  initialize(config?: SkillConfig | string): Promise<void>;

  // Lifecycle Methods
  loadAll(): Promise<void>;
  load(skillName: string): Promise<void>;
  unload(skillName: string): Promise<void>;
  activate(skillName: string): Promise<void>;
  deactivate(skillName: string): Promise<void>;
  close(): Promise<void>;

  // Directory Discovery
  discoverAndLoad(directory: string): Promise<void>;

  // Dynamic Registration
  registerSkill(definition: SkillDefinition, skillPath: string): Promise<void>;
  unregisterSkill(name: string): Promise<void>;

  // Tool Access
  getTools(): AgentTool[];
  getToolsFromSkill(skillName: string): AgentTool[];

  // State Queries
  getSkillNames(): string[];
  getSkill(name: string): LoadedSkill | undefined;
  getState(name: string): SkillState;
  isLoaded(name: string): boolean;
  isActive(name: string): boolean;
  getAllSkills(): LoadedSkill[];

  // Events
  on(event: SkillEventType, handler: SkillEventHandler): void;
  off(event: SkillEventType, handler: SkillEventHandler): void;
}

/**
 * Create a Skill Manager instance
 */
export function createSkillManager(
  options: SkillManagerOptions = {}
): SkillManagerInstance {
  // Private state via closure
  const skills = new Map<string, LoadedSkill>();
  let config: SkillConfig | null = null;
  const eventHandlers = new Map<SkillEventType, Set<SkillEventHandler>>();

  // Private helper functions
  function emit(
    type: SkillEventType,
    skillName: string,
    data?: unknown,
    error?: Error
  ): void {
    const handlers = eventHandlers.get(type);
    if (handlers) {
      const event = { type, skillName, data, error };
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('Event handler error:', err);
        }
      }
    }
  }

  function updateState(
    skillName: string,
    state: SkillState,
    error?: Error
  ): void {
    const skill = skills.get(skillName);
    if (skill) {
      skill.state = state;
      if (error) {
        skill.error = error;
      }
      emit('state:change', skillName, state, error);

      // Notify tools change
      if (state === 'active' || state === 'loaded') {
        emit('tools:change', skillName, skill.tools);
      }
    }

    // Call options callback
    if (options.onStateChange) {
      options.onStateChange(skillName, state, error);
    }

    if (state === 'active' || state === 'loaded') {
      const skill = skills.get(skillName);
      if (skill && options.onToolsChange) {
        options.onToolsChange(skillName, skill.tools);
      }
    }
  }

  // Instance object
  const instance: SkillManagerInstance = {
    // ============================================
    // Initialization
    // ============================================

    async initialize(inputConfig?: SkillConfig | string): Promise<void> {
      if (typeof inputConfig === 'string') {
        config = await loadConfig(inputConfig);
      } else if (inputConfig) {
        config = inputConfig;
      } else {
        const loadedConfig = await loadConfigFromDefaults();
        if (loadedConfig) {
          config = loadedConfig;
        } else {
          // No config found, create empty config
          config = { skills: {} };
        }
      }
    },

    // ============================================
    // Lifecycle Methods
    // ============================================

    async loadAll(): Promise<void> {
      if (!config) {
        throw new Error('Manager not initialized. Call initialize() first.');
      }

      for (const [name, entry] of Object.entries(config.skills)) {
        if (entry.enabled === false) {
          continue;
        }

        try {
          await instance.load(name);
        } catch (error) {
          console.error(`Failed to load skill "${name}":`, error);
        }
      }
    },

    async load(skillName: string): Promise<void> {
      if (!config) {
        throw new Error('Manager not initialized. Call initialize() first.');
      }

      const entry = config.skills[skillName];
      if (!entry) {
        throw new SkillNotFoundError(skillName);
      }

      // Check if already loaded
      if (skills.has(skillName)) {
        const existing = skills.get(skillName)!;
        if (existing.state === 'loaded' || existing.state === 'active') {
          return; // Already loaded
        }
      }

      try {
        const loadedSkill = await loadSkill(skillName, entry);
        skills.set(loadedSkill.name, loadedSkill);

        // Run onLoad hook if present
        if (loadedSkill.hooks?.onLoad) {
          await loadedSkill.hooks.onLoad();
        }

        emit('skill:loaded', loadedSkill.name);
        updateState(loadedSkill.name, 'loaded');
      } catch (error) {
        const loadedSkill: LoadedSkill = {
          name: skillName,
          definition: { name: skillName },
          state: 'error',
          path: entry.path ?? '',
          tools: [],
          error: error instanceof Error ? error : new Error(String(error)),
        };
        skills.set(skillName, loadedSkill);
        updateState(skillName, 'error', loadedSkill.error);
        throw error;
      }
    },

    async unload(skillName: string): Promise<void> {
      const skill = skills.get(skillName);
      if (!skill) {
        return;
      }

      // Deactivate first if active
      if (skill.state === 'active') {
        await instance.deactivate(skillName);
      }

      // Run onUnload hook if present
      if (skill.hooks?.onUnload) {
        try {
          await skill.hooks.onUnload();
        } catch (error) {
          console.warn(`Error in onUnload hook for "${skillName}":`, error);
        }
      }

      skills.delete(skillName);
      emit('skill:unloaded', skillName);
    },

    async activate(skillName: string): Promise<void> {
      const skill = skills.get(skillName);
      if (!skill) {
        throw new SkillNotFoundError(skillName);
      }

      if (skill.state === 'active') {
        return;
      }

      if (skill.state !== 'loaded') {
        throw new SkillLoadError(
          skillName,
          new Error(`Cannot activate skill in state: ${skill.state}`)
        );
      }

      // Run onActivate hook if present
      if (skill.hooks?.onActivate) {
        await skill.hooks.onActivate();
      }

      updateState(skillName, 'active');
    },

    async deactivate(skillName: string): Promise<void> {
      const skill = skills.get(skillName);
      if (!skill) {
        return;
      }

      if (skill.state !== 'active') {
        return;
      }

      // Run onDeactivate hook if present
      if (skill.hooks?.onDeactivate) {
        try {
          await skill.hooks.onDeactivate();
        } catch (error) {
          console.warn(`Error in onDeactivate hook for "${skillName}":`, error);
        }
      }

      updateState(skillName, 'loaded');
    },

    async close(): Promise<void> {
      const skillNames = Array.from(skills.keys());
      for (const name of skillNames) {
        try {
          await instance.unload(name);
        } catch (error) {
          console.warn(`Error unloading skill "${name}":`, error);
        }
      }

      skills.clear();
      config = null;
      eventHandlers.clear();
    },

    // ============================================
    // Directory Discovery
    // ============================================

    async discoverAndLoad(directory: string): Promise<void> {
      const discovered = await discoverSkills(directory);

      for (const { name, path, definition } of discovered) {
        // Skip if already loaded
        if (skills.has(name)) {
          continue;
        }

        try {
          const loadedSkill = await loadSkillFromDirectory(name, path);
          skills.set(loadedSkill.name, loadedSkill);

          // Run onLoad hook if present
          if (loadedSkill.hooks?.onLoad) {
            await loadedSkill.hooks.onLoad();
          }

          emit('skill:loaded', loadedSkill.name);
          updateState(loadedSkill.name, 'loaded');
        } catch (error) {
          console.error(`Failed to load discovered skill "${name}":`, error);
        }
      }
    },

    // ============================================
    // Dynamic Registration
    // ============================================

    async registerSkill(
      definition: SkillDefinition,
      skillPath: string
    ): Promise<void> {
      if (skills.has(definition.name)) {
        throw new Error(`Skill already registered: ${definition.name}`);
      }

      try {
        const loadedSkill = await loadSkillFromDirectory(
          definition.name,
          skillPath
        );
        skills.set(loadedSkill.name, loadedSkill);

        // Run onLoad hook if present
        if (loadedSkill.hooks?.onLoad) {
          await loadedSkill.hooks.onLoad();
        }

        emit('skill:loaded', loadedSkill.name);
        updateState(loadedSkill.name, 'loaded');
      } catch (error) {
        throw new SkillLoadError(
          definition.name,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async unregisterSkill(name: string): Promise<void> {
      await instance.unload(name);
    },

    // ============================================
    // Tool Access
    // ============================================

    getTools(): AgentTool[] {
      const tools: AgentTool[] = [];

      for (const skill of skills.values()) {
        // Only include tools from active skills
        if (skill.state !== 'active' && skill.state !== 'loaded') {
          continue;
        }

        for (const resolvedTool of skill.tools) {
          const toolName = generateToolName(
            skill.name,
            resolvedTool.definition.name,
            { includeSkillName: true, prefix: 'skill__' }
          );

          tools.push({
            name: toolName,
            description: resolvedTool.definition.description,
            parameters: resolvedTool.definition.parameters || {
              type: 'object',
              properties: {},
            },
            execute: async (args: Record<string, unknown>): Promise<string> => {
              try {
                return await resolvedTool.handler(args);
              } catch (error) {
                return formatErrorResult(error);
              }
            },
          });
        }
      }

      return tools;
    },

    getToolsFromSkill(skillName: string): AgentTool[] {
      const skill = skills.get(skillName);
      if (!skill) {
        return [];
      }

      const tools: AgentTool[] = [];

      for (const resolvedTool of skill.tools) {
        const toolName = generateToolName(
          skill.name,
          resolvedTool.definition.name,
          { includeSkillName: true, prefix: 'skill__' }
        );

        tools.push({
          name: toolName,
          description: resolvedTool.definition.description,
          parameters: resolvedTool.definition.parameters || {
            type: 'object',
            properties: {},
          },
          execute: async (args: Record<string, unknown>): Promise<string> => {
            try {
              return await resolvedTool.handler(args);
            } catch (error) {
              return formatErrorResult(error);
            }
          },
        });
      }

      return tools;
    },

    // ============================================
    // State Queries
    // ============================================

    getSkillNames(): string[] {
      return Array.from(skills.keys());
    },

    getSkill(name: string): LoadedSkill | undefined {
      return skills.get(name);
    },

    getState(name: string): SkillState {
      return skills.get(name)?.state ?? 'unloaded';
    },

    isLoaded(name: string): boolean {
      const state = instance.getState(name);
      return state === 'loaded' || state === 'active';
    },

    isActive(name: string): boolean {
      return instance.getState(name) === 'active';
    },

    getAllSkills(): LoadedSkill[] {
      return Array.from(skills.values());
    },

    // ============================================
    // Events
    // ============================================

    on(event: SkillEventType, handler: SkillEventHandler): void {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
    },

    off(event: SkillEventType, handler: SkillEventHandler): void {
      eventHandlers.get(event)?.delete(handler);
    },
  };

  return instance;
}

