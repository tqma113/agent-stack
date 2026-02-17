/**
 * @agent-stack/skill
 *
 * Skill system for agent-stack - dynamic skill loading and management
 */

// Export types
export type {
  // State
  SkillState,

  // Skill definition (skill.json)
  SkillDefinition,
  SkillToolDefinition,
  SkillPromptDefinition,
  SkillPromptArgument,
  SkillResourceDefinition,
  SkillHooks,

  // Configuration (skills.json)
  SkillConfig,
  SkillEntry,

  // Loaded skill
  ToolHandler,
  HookHandler,
  ResolvedTool,
  LoadedSkill,

  // Agent integration
  AgentTool,

  // Bridge
  SkillToolBridgeOptions,
  BridgedSkillTool,

  // Manager
  SkillManagerOptions,

  // Events
  SkillEventType,
  SkillEvent,
  SkillEventHandler,
} from './types';

// Export errors
export {
  SkillError,
  SkillConfigurationError,
  SkillLoadError,
  SkillHandlerError,
  SkillToolExecutionError,
  SkillNotFoundError,
} from './types';

// Export config functions
export {
  CONFIG_FILE_NAMES,
  SKILL_DIRECTORIES,
  SKILL_DEFINITION_FILE,
  loadConfig,
  loadConfigFromDefaults,
  findConfigFile,
  parseConfig,
  loadSkillDefinition,
  parseSkillDefinition,
  discoverSkills,
  discoverSkillsFromDefaults,
} from './config';

// Export loader functions
export {
  loadSkill,
  loadSkillFromDirectory,
  loadSkillFromPackage,
  resolveToolHandler,
} from './loader';

// Export manager
export {
  createSkillManager,
  type SkillManagerInstance,
} from './manager';

// Export bridge
export {
  createSkillToolProvider,
  createSkillToolBridge,
  bridgeSkillTool,
  convertToolParameters,
  type SkillToolProviderInstance,
} from './bridge';

// Export helpers
export {
  sanitizeToolName,
  generateToolName,
  parseHandlerPath,
  formatErrorResult,
} from './helpers';
