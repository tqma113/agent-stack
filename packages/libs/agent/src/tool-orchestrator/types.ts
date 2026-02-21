/**
 * @ai-stack/agent - Tool Orchestrator Types
 *
 * Types for intelligent tool selection and execution planning.
 */

import type { Tool, ToolCallResult } from '../types.js';

/**
 * A step in a tool chain
 */
export interface ToolChainStep {
  /** Unique step ID */
  id: string;

  /** Tool name to execute */
  toolName: string;

  /** Arguments for the tool */
  args: Record<string, unknown>;

  /** Step IDs that must complete before this step */
  dependsOn?: string[];

  /** Description of what this step accomplishes */
  description?: string;

  /** Priority for execution order (lower = higher priority) */
  priority?: number;
}

/**
 * A planned chain of tool executions
 */
export interface ToolChain {
  /** Chain ID */
  id: string;

  /** Steps to execute */
  steps: ToolChainStep[];

  /** Fallback chain if this one fails */
  fallback?: ToolChain;

  /** Goal this chain is trying to accomplish */
  goal?: string;

  /** Estimated cost/complexity */
  estimatedCost?: number;
}

/**
 * Result of tool chain execution
 */
export interface ToolChainResult {
  /** Whether the chain completed successfully */
  success: boolean;

  /** Results from each step */
  stepResults: Array<{
    stepId: string;
    toolName: string;
    result: string;
    success: boolean;
    durationMs: number;
  }>;

  /** Final aggregated result */
  finalResult?: string;

  /** Total execution time */
  totalDurationMs: number;

  /** Whether fallback was used */
  usedFallback: boolean;

  /** Error if chain failed */
  error?: Error;
}

/**
 * Tool orchestrator configuration
 */
export interface ToolOrchestratorConfig {
  /** Enable automatic tool chain planning (default: false) */
  enabled?: boolean;

  /** Maximum steps in a single chain */
  maxSteps?: number;

  /** Maximum concurrent tool executions */
  maxConcurrency?: number;

  /** Timeout for entire chain (ms) */
  chainTimeoutMs?: number;

  /** Retry failed steps */
  retryFailedSteps?: boolean;

  /** Maximum retries per step */
  maxRetries?: number;
}

/**
 * Default configuration
 */
export const DEFAULT_TOOL_ORCHESTRATOR_CONFIG: Required<ToolOrchestratorConfig> = {
  enabled: false,
  maxSteps: 10,
  maxConcurrency: 3,
  chainTimeoutMs: 60000,
  retryFailedSteps: true,
  maxRetries: 2,
};

/**
 * Tool metadata for orchestration
 */
export interface ToolMetadata {
  /** Tool name */
  name: string;

  /** Category for grouping */
  category?: 'read' | 'write' | 'search' | 'execute' | 'interact' | 'other';

  /** Tools that often follow this one */
  commonSuccessors?: string[];

  /** Tools that often precede this one */
  commonPredecessors?: string[];

  /** Whether this tool has side effects */
  hasSideEffects?: boolean;

  /** Average execution time (ms) */
  avgExecutionMs?: number;

  /** Failure rate (0-1) */
  failureRate?: number;
}

/**
 * Tool orchestrator instance interface
 */
export interface ToolOrchestratorInstance {
  /**
   * Plan a tool chain for a given goal
   */
  plan(goal: string, context?: PlanningContext): Promise<ToolChain>;

  /**
   * Execute a tool chain
   */
  execute(chain: ToolChain): Promise<ToolChainResult>;

  /**
   * Get fallback chain for a failed tool
   */
  getFallback(toolName: string, error: Error): ToolChain | null;

  /**
   * Suggest next tools based on current context
   */
  suggestNextTools(context: ExecutionContext): string[];

  /**
   * Update tool metadata based on execution results
   */
  recordExecution(toolName: string, success: boolean, durationMs: number): void;

  /**
   * Get tool metadata
   */
  getToolMetadata(toolName: string): ToolMetadata | null;

  /**
   * Register tool metadata
   */
  registerToolMetadata(metadata: ToolMetadata): void;
}

/**
 * Planning context for tool chain generation
 */
export interface PlanningContext {
  /** Available tools */
  availableTools: Tool[];

  /** Recent tool calls */
  recentToolCalls?: ToolCallResult[];

  /** User preferences */
  preferences?: {
    preferSpeed?: boolean;
    preferReliability?: boolean;
    avoidTools?: string[];
  };

  /** Additional context for planning */
  additionalContext?: string;
}

/**
 * Execution context for tool suggestions
 */
export interface ExecutionContext {
  /** Last tool call */
  lastToolCall?: ToolCallResult;

  /** Available tools */
  availableTools: string[];

  /** Current goal */
  currentGoal?: string;
}
