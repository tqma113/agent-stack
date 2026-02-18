/**
 * @ai-stack/skill - Type Definitions
 */

// ============================================
// Skill State Types
// ============================================

/**
 * Skill lifecycle state
 */
export type SkillState = 'unloaded' | 'loading' | 'loaded' | 'active' | 'error';

// ============================================
// Skill Definition Types (skill.json format)
// ============================================

/**
 * Skill definition (skill.json format)
 * Defines the structure and capabilities of a skill
 */
export interface SkillDefinition {
  /** Skill name (unique identifier) */
  name: string;
  /** Skill version (semver) */
  version?: string;
  /** Description of what the skill does */
  description?: string;
  /** Skill author */
  author?: string;

  // Capability definitions
  /** Tools provided by this skill */
  tools?: SkillToolDefinition[];
  /** Prompts provided by this skill */
  prompts?: SkillPromptDefinition[];
  /** Resources provided by this skill */
  resources?: SkillResourceDefinition[];

  // Lifecycle hooks (optional script paths)
  hooks?: SkillHooks;

  // Dependencies
  /** Other skills this skill depends on */
  dependencies?: string[];
}

/**
 * Skill tool definition
 */
export interface SkillToolDefinition {
  /** Tool name (unique within the skill) */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Handler function path (e.g., './handlers.js#myTool' or './handler.ts') */
  handler: string;
}

/**
 * Skill prompt definition
 */
export interface SkillPromptDefinition {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt template content or file path */
  template: string;
  /** Arguments the prompt accepts */
  arguments?: SkillPromptArgument[];
}

/**
 * Skill prompt argument
 */
export interface SkillPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether the argument is required */
  required?: boolean;
  /** Default value */
  default?: string;
}

/**
 * Skill resource definition
 */
export interface SkillResourceDefinition {
  /** Resource name */
  name: string;
  /** Resource URI */
  uri: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * Skill lifecycle hooks
 */
export interface SkillHooks {
  /** Script to run when skill is loaded */
  onLoad?: string;
  /** Script to run when skill is activated */
  onActivate?: string;
  /** Script to run when skill is deactivated */
  onDeactivate?: string;
  /** Script to run when skill is unloaded */
  onUnload?: string;
}

// ============================================
// Configuration Types (skills.json format)
// ============================================

/**
 * Skill configuration file format (skills.json)
 */
export interface SkillConfig {
  /** Map of skill name to configuration entry */
  skills: Record<string, SkillEntry>;
  /** Whether to auto-load all skills on initialization */
  autoLoad?: boolean;
}

/**
 * Skill entry in configuration
 */
export interface SkillEntry {
  /** Local file system path to skill directory */
  path?: string;
  /** npm package name */
  package?: string;
  /** Whether the skill is enabled */
  enabled?: boolean;
  /** Skill-specific configuration options */
  config?: Record<string, unknown>;
}

// ============================================
// Loaded Skill Types
// ============================================

/**
 * Tool handler function type
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/**
 * Hook handler function type
 */
export type HookHandler = () => Promise<void>;

/**
 * Resolved tool with handler function
 */
export interface ResolvedTool {
  /** Tool definition */
  definition: SkillToolDefinition;
  /** Resolved handler function */
  handler: ToolHandler;
}

/**
 * Loaded skill instance with resolved handlers
 */
export interface LoadedSkill {
  /** Skill name */
  name: string;
  /** Skill definition from skill.json */
  definition: SkillDefinition;
  /** Current state */
  state: SkillState;
  /** Path to skill directory */
  path: string;
  /** Resolved tools with handlers */
  tools: ResolvedTool[];
  /** Resolved lifecycle hooks */
  hooks?: {
    onLoad?: HookHandler;
    onActivate?: HookHandler;
    onDeactivate?: HookHandler;
    onUnload?: HookHandler;
  };
  /** Error if state is 'error' */
  error?: Error;
  /** Skill-specific config from SkillEntry */
  config?: Record<string, unknown>;
}

// ============================================
// Agent Tool Interface
// ============================================

/**
 * Agent Tool interface (from @ai-stack/agent)
 * Duplicated here to avoid circular dependency
 */
export interface AgentTool {
  /** Tool name (must be unique) */
  name: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;
  /** Function to execute when tool is called */
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// ============================================
// Bridge Types
// ============================================

/**
 * Options for converting skill tools to Agent tools
 */
export interface SkillToolBridgeOptions {
  /** Prefix to add to tool names (e.g., "skill_") */
  namePrefix?: string;
  /** Whether to include skill name in tool name */
  includeSkillName?: boolean;
  /** Custom name transformer */
  nameTransformer?: (skillName: string, toolName: string) => string;
  /** Filter function to include/exclude tools */
  filter?: (skillName: string, tool: SkillToolDefinition) => boolean;
}

/**
 * Bridged skill tool with metadata
 */
export interface BridgedSkillTool extends AgentTool {
  /** Skill this tool belongs to */
  skillName: string;
  /** Original tool name in skill definition */
  originalToolName: string;
}

// ============================================
// Manager Types
// ============================================

/**
 * Options for SkillManager
 */
export interface SkillManagerOptions {
  /** Callback when skill state changes */
  onStateChange?: (skillName: string, state: SkillState, error?: Error) => void;
  /** Callback when tools list changes */
  onToolsChange?: (skillName: string, tools: ResolvedTool[]) => void;
}

// ============================================
// Event Types
// ============================================

export type SkillEventType =
  | 'state:change'
  | 'tools:change'
  | 'skill:loaded'
  | 'skill:unloaded'
  | 'error';

export interface SkillEvent {
  type: SkillEventType;
  skillName: string;
  data?: unknown;
  error?: Error;
}

export type SkillEventHandler = (event: SkillEvent) => void;

// ============================================
// Error Types
// ============================================

/**
 * Base skill error class
 */
export class SkillError extends Error {
  constructor(
    message: string,
    public code: string,
    public skillName?: string
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

/**
 * Configuration error
 */
export class SkillConfigurationError extends SkillError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'SkillConfigurationError';
  }
}

/**
 * Skill load error
 */
export class SkillLoadError extends SkillError {
  constructor(skillName: string, cause?: Error) {
    super(
      `Failed to load skill: ${skillName}`,
      'LOAD_ERROR',
      skillName
    );
    this.name = 'SkillLoadError';
    this.cause = cause;
  }
}

/**
 * Handler resolution error
 */
export class SkillHandlerError extends SkillError {
  constructor(skillName: string, handlerPath: string, cause?: Error) {
    super(
      `Failed to resolve handler: ${handlerPath} in skill ${skillName}`,
      'HANDLER_ERROR',
      skillName
    );
    this.name = 'SkillHandlerError';
    this.cause = cause;
  }
}

/**
 * Tool execution error
 */
export class SkillToolExecutionError extends SkillError {
  constructor(skillName: string, toolName: string, cause?: Error) {
    super(
      `Tool execution failed: ${toolName} in skill ${skillName}`,
      'TOOL_EXECUTION_ERROR',
      skillName
    );
    this.name = 'SkillToolExecutionError';
    this.cause = cause;
  }
}

/**
 * Skill not found error
 */
export class SkillNotFoundError extends SkillError {
  constructor(skillName: string) {
    super(
      `Skill not found: ${skillName}`,
      'NOT_FOUND_ERROR',
      skillName
    );
    this.name = 'SkillNotFoundError';
  }
}
