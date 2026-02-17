/**
 * @agent-stack/skill - Skill Manager
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
 * SkillManager - Manages skill lifecycle and state
 */
export class SkillManager {
  private skills: Map<string, LoadedSkill> = new Map();
  private config: SkillConfig | null = null;
  private options: SkillManagerOptions;
  private eventHandlers: Map<SkillEventType, Set<SkillEventHandler>> =
    new Map();

  constructor(options: SkillManagerOptions = {}) {
    this.options = options;
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize manager with configuration
   * Loads config from file if string path provided
   */
  async initialize(config?: SkillConfig | string): Promise<void> {
    if (typeof config === 'string') {
      this.config = await loadConfig(config);
    } else if (config) {
      this.config = config;
    } else {
      const loadedConfig = await loadConfigFromDefaults();
      if (loadedConfig) {
        this.config = loadedConfig;
      } else {
        // No config found, create empty config
        this.config = { skills: {} };
      }
    }
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  /**
   * Load all skills from configuration
   */
  async loadAll(): Promise<void> {
    if (!this.config) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }

    for (const [name, entry] of Object.entries(this.config.skills)) {
      if (entry.enabled === false) {
        continue;
      }

      try {
        await this.load(name);
      } catch (error) {
        console.error(`Failed to load skill "${name}":`, error);
      }
    }
  }

  /**
   * Load a specific skill by name
   */
  async load(skillName: string): Promise<void> {
    if (!this.config) {
      throw new Error('Manager not initialized. Call initialize() first.');
    }

    const entry = this.config.skills[skillName];
    if (!entry) {
      throw new SkillNotFoundError(skillName);
    }

    // Check if already loaded
    if (this.skills.has(skillName)) {
      const existing = this.skills.get(skillName)!;
      if (existing.state === 'loaded' || existing.state === 'active') {
        return; // Already loaded
      }
    }

    try {
      const loadedSkill = await loadSkill(skillName, entry);
      this.skills.set(loadedSkill.name, loadedSkill);

      // Run onLoad hook if present
      if (loadedSkill.hooks?.onLoad) {
        await loadedSkill.hooks.onLoad();
      }

      this.emit('skill:loaded', loadedSkill.name);
      this.updateState(loadedSkill.name, 'loaded');
    } catch (error) {
      const loadedSkill: LoadedSkill = {
        name: skillName,
        definition: { name: skillName },
        state: 'error',
        path: entry.path ?? '',
        tools: [],
        error: error instanceof Error ? error : new Error(String(error)),
      };
      this.skills.set(skillName, loadedSkill);
      this.updateState(skillName, 'error', loadedSkill.error);
      throw error;
    }
  }

  /**
   * Unload a skill
   */
  async unload(skillName: string): Promise<void> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return;
    }

    // Deactivate first if active
    if (skill.state === 'active') {
      await this.deactivate(skillName);
    }

    // Run onUnload hook if present
    if (skill.hooks?.onUnload) {
      try {
        await skill.hooks.onUnload();
      } catch (error) {
        console.warn(`Error in onUnload hook for "${skillName}":`, error);
      }
    }

    this.skills.delete(skillName);
    this.emit('skill:unloaded', skillName);
  }

  /**
   * Activate a skill (enables its tools)
   */
  async activate(skillName: string): Promise<void> {
    const skill = this.skills.get(skillName);
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

    this.updateState(skillName, 'active');
  }

  /**
   * Deactivate a skill (disables its tools)
   */
  async deactivate(skillName: string): Promise<void> {
    const skill = this.skills.get(skillName);
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

    this.updateState(skillName, 'loaded');
  }

  /**
   * Close manager and unload all skills
   */
  async close(): Promise<void> {
    const skillNames = Array.from(this.skills.keys());
    for (const name of skillNames) {
      try {
        await this.unload(name);
      } catch (error) {
        console.warn(`Error unloading skill "${name}":`, error);
      }
    }

    this.skills.clear();
    this.config = null;
    this.eventHandlers.clear();
  }

  // ============================================
  // Directory Discovery
  // ============================================

  /**
   * Discover and load skills from a directory
   */
  async discoverAndLoad(directory: string): Promise<void> {
    const discovered = await discoverSkills(directory);

    for (const { name, path, definition } of discovered) {
      // Skip if already loaded
      if (this.skills.has(name)) {
        continue;
      }

      try {
        const loadedSkill = await loadSkillFromDirectory(name, path);
        this.skills.set(loadedSkill.name, loadedSkill);

        // Run onLoad hook if present
        if (loadedSkill.hooks?.onLoad) {
          await loadedSkill.hooks.onLoad();
        }

        this.emit('skill:loaded', loadedSkill.name);
        this.updateState(loadedSkill.name, 'loaded');
      } catch (error) {
        console.error(`Failed to load discovered skill "${name}":`, error);
      }
    }
  }

  // ============================================
  // Dynamic Registration
  // ============================================

  /**
   * Register a skill programmatically
   */
  async registerSkill(
    definition: SkillDefinition,
    skillPath: string
  ): Promise<void> {
    if (this.skills.has(definition.name)) {
      throw new Error(`Skill already registered: ${definition.name}`);
    }

    try {
      const loadedSkill = await loadSkillFromDirectory(
        definition.name,
        skillPath
      );
      this.skills.set(loadedSkill.name, loadedSkill);

      // Run onLoad hook if present
      if (loadedSkill.hooks?.onLoad) {
        await loadedSkill.hooks.onLoad();
      }

      this.emit('skill:loaded', loadedSkill.name);
      this.updateState(loadedSkill.name, 'loaded');
    } catch (error) {
      throw new SkillLoadError(
        definition.name,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Unregister a skill
   */
  async unregisterSkill(name: string): Promise<void> {
    await this.unload(name);
  }

  // ============================================
  // Tool Access
  // ============================================

  /**
   * Get all tools from all loaded and active skills as AgentTool array
   */
  getTools(): AgentTool[] {
    const tools: AgentTool[] = [];

    for (const skill of this.skills.values()) {
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
  }

  /**
   * Get tools from a specific skill
   */
  getToolsFromSkill(skillName: string): AgentTool[] {
    const skill = this.skills.get(skillName);
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
  }

  // ============================================
  // State Queries
  // ============================================

  /**
   * Get all loaded skill names
   */
  getSkillNames(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Get a loaded skill by name
   */
  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * Get skill state
   */
  getState(name: string): SkillState {
    return this.skills.get(name)?.state ?? 'unloaded';
  }

  /**
   * Check if a skill is loaded
   */
  isLoaded(name: string): boolean {
    const state = this.getState(name);
    return state === 'loaded' || state === 'active';
  }

  /**
   * Check if a skill is active
   */
  isActive(name: string): boolean {
    return this.getState(name) === 'active';
  }

  /**
   * Get all loaded skills
   */
  getAllSkills(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to events
   */
  on(event: SkillEventType, handler: SkillEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: SkillEventType, handler: SkillEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Update skill state and emit event
   */
  private updateState(
    skillName: string,
    state: SkillState,
    error?: Error
  ): void {
    const skill = this.skills.get(skillName);
    if (skill) {
      skill.state = state;
      if (error) {
        skill.error = error;
      }
      this.emit('state:change', skillName, state, error);

      // Notify tools change
      if (state === 'active' || state === 'loaded') {
        this.emit('tools:change', skillName, skill.tools);
      }
    }

    // Call options callback
    if (this.options.onStateChange) {
      this.options.onStateChange(skillName, state, error);
    }

    if (state === 'active' || state === 'loaded') {
      const skill = this.skills.get(skillName);
      if (skill && this.options.onToolsChange) {
        this.options.onToolsChange(skillName, skill.tools);
      }
    }
  }

  /**
   * Emit an event
   */
  private emit(
    type: SkillEventType,
    skillName: string,
    data?: unknown,
    error?: Error
  ): void {
    const handlers = this.eventHandlers.get(type);
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
}
