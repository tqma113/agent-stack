/**
 * @ai-stack/agent - Sub-Agent Types
 *
 * Defines types for sub-agent orchestration,
 * including DAG-based execution and parallel processing.
 */

// =============================================================================
// Sub-Agent Configuration
// =============================================================================

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  /** Unique agent ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** System prompt for this sub-agent */
  systemPrompt: string;

  /** Tools available to this sub-agent (by name) */
  tools?: string[];

  /** Model to use (overrides parent) */
  model?: string;

  /** Maximum iterations */
  maxIterations?: number;

  /** Timeout in milliseconds */
  timeoutMs?: number;

  /** Whether this agent can spawn sub-agents */
  canSpawnSubAgents?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Sub-Agent Task
// =============================================================================

/**
 * Task to execute with a sub-agent
 */
export interface SubAgentTask {
  /** Target agent ID */
  agentId: string;

  /** Input/prompt for the agent */
  input: string;

  /** Task timeout (overrides agent config) */
  timeoutMs?: number;

  /** Context from previous tasks */
  context?: Record<string, unknown>;

  /** Dependencies (task IDs that must complete first) */
  dependsOn?: string[];

  /** Custom task metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task status
 */
export type SubAgentTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Result from sub-agent execution
 */
export interface SubAgentResult {
  /** Task ID */
  taskId: string;

  /** Agent ID that executed the task */
  agentId: string;

  /** Output content */
  output: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Token usage */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** Tool calls made */
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
  }>;

  /** Task status */
  status: SubAgentTaskStatus;

  /** Start timestamp */
  startedAt: number;

  /** End timestamp */
  completedAt: number;
}

// =============================================================================
// Sub-Agent DAG
// =============================================================================

/**
 * DAG for sub-agent orchestration
 */
export interface SubAgentDAG {
  /** DAG ID */
  id: string;

  /** Tasks in the DAG */
  tasks: SubAgentTask[];

  /** Dependency edges (from -> to) */
  edges: Array<{ from: string; to: string }>;

  /** DAG metadata */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Manager Configuration
// =============================================================================

/**
 * Sub-agent manager configuration
 */
export interface SubAgentManagerConfig {
  /** Maximum concurrent sub-agents */
  maxConcurrent?: number;

  /** Default timeout for sub-agent execution (ms) */
  defaultTimeoutMs?: number;

  /** Whether to propagate errors from sub-agents */
  propagateErrors?: boolean;

  /** Callback when sub-agent starts */
  onStart?: (agentId: string, input: string) => void;

  /** Callback when sub-agent completes */
  onComplete?: (result: SubAgentResult) => void;

  /** Callback when sub-agent fails */
  onError?: (agentId: string, error: Error) => void;

  /** Enable result caching */
  enableCaching?: boolean;

  /** Cache TTL in milliseconds */
  cacheTTLMs?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default sub-agent manager configuration
 */
export const DEFAULT_SUB_AGENT_MANAGER_CONFIG: Required<
  Pick<SubAgentManagerConfig, 'maxConcurrent' | 'defaultTimeoutMs' | 'propagateErrors' | 'enableCaching'>
> = {
  maxConcurrent: 5,
  defaultTimeoutMs: 60000, // 1 minute
  propagateErrors: true,
  enableCaching: false,
};
