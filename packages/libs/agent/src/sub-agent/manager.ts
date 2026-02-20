/**
 * @ai-stack/agent - Sub-Agent Manager Implementation
 *
 * Orchestrates multiple sub-agents with support for
 * parallel execution and DAG-based dependencies.
 */

import type {
  SubAgentConfig,
  SubAgentTask,
  SubAgentResult,
  SubAgentDAG,
  SubAgentManagerConfig,
  SubAgentTaskStatus,
} from './types.js';
import { DEFAULT_SUB_AGENT_MANAGER_CONFIG } from './types.js';

// =============================================================================
// Types for Agent Factory
// =============================================================================

/**
 * Agent factory function type
 *
 * The manager needs a way to create agents - this is provided
 * by the user to avoid circular dependencies.
 */
export type AgentFactory = (config: SubAgentConfig) => SubAgentLike;

/**
 * Minimal agent interface for sub-agent execution
 */
export interface SubAgentLike {
  /** Execute chat and get response */
  chat(input: string, options?: { maxIterations?: number }): Promise<{
    content: string;
    toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  }>;
}

// =============================================================================
// Sub-Agent Manager Instance Interface
// =============================================================================

/**
 * Sub-agent manager instance interface
 */
export interface SubAgentManagerInstance {
  /** Register a sub-agent configuration */
  register(config: SubAgentConfig): void;

  /** Unregister a sub-agent */
  unregister(agentId: string): void;

  /** Get registered sub-agent config */
  getAgent(agentId: string): SubAgentConfig | undefined;

  /** Get all registered sub-agents */
  getAgents(): SubAgentConfig[];

  /** Execute a single sub-agent task */
  execute(task: SubAgentTask): Promise<SubAgentResult>;

  /** Execute multiple tasks in parallel */
  executeParallel(tasks: SubAgentTask[]): Promise<SubAgentResult[]>;

  /** Execute tasks according to DAG dependencies */
  orchestrate(dag: SubAgentDAG): Promise<SubAgentResult[]>;

  /** Cancel a running task */
  cancel(taskId: string): boolean;

  /** Cancel all running tasks */
  cancelAll(): void;

  /** Get running task count */
  getRunningCount(): number;

  /** Get task result (if cached) */
  getCachedResult(taskId: string): SubAgentResult | undefined;

  /** Clear result cache */
  clearCache(): void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Create timeout promise
 */
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

// =============================================================================
// Sub-Agent Manager Factory
// =============================================================================

/**
 * Create sub-agent manager instance
 */
export function createSubAgentManager(
  agentFactory: AgentFactory,
  config: SubAgentManagerConfig = {}
): SubAgentManagerInstance {
  const mergedConfig = { ...DEFAULT_SUB_AGENT_MANAGER_CONFIG, ...config };

  // Registered sub-agent configs
  const agentConfigs = new Map<string, SubAgentConfig>();

  // Created agent instances (lazy)
  const agentInstances = new Map<string, SubAgentLike>();

  // Running tasks
  const runningTasks = new Map<string, { cancel: () => void }>();

  // Result cache
  const resultCache = new Map<string, { result: SubAgentResult; expiry: number }>();

  /**
   * Get or create agent instance
   */
  function getOrCreateAgent(agentId: string): SubAgentLike {
    let agent = agentInstances.get(agentId);
    if (!agent) {
      const agentConfig = agentConfigs.get(agentId);
      if (!agentConfig) {
        throw new Error(`Agent ${agentId} not registered`);
      }
      agent = agentFactory(agentConfig);
      agentInstances.set(agentId, agent);
    }
    return agent;
  }

  /**
   * Execute single task
   */
  async function executeTask(task: SubAgentTask): Promise<SubAgentResult> {
    const taskId = task.metadata?.taskId as string ?? generateTaskId();
    const startedAt = Date.now();

    // Check cache
    if (mergedConfig.enableCaching) {
      const cached = resultCache.get(taskId);
      if (cached && cached.expiry > Date.now()) {
        return cached.result;
      }
    }

    const agentConfig = agentConfigs.get(task.agentId);
    if (!agentConfig) {
      return {
        taskId,
        agentId: task.agentId,
        output: '',
        success: false,
        error: `Agent ${task.agentId} not registered`,
        durationMs: 0,
        status: 'failed',
        startedAt,
        completedAt: Date.now(),
      };
    }

    config.onStart?.(task.agentId, task.input);

    let cancelled = false;
    const cancelToken = {
      cancel: () => {
        cancelled = true;
      },
    };
    runningTasks.set(taskId, cancelToken);

    try {
      const agent = getOrCreateAgent(task.agentId);
      const timeout = task.timeoutMs ?? agentConfig.timeoutMs ?? mergedConfig.defaultTimeoutMs;

      // Race between execution and timeout
      const response = await Promise.race([
        agent.chat(task.input, { maxIterations: agentConfig.maxIterations }),
        createTimeout(timeout),
      ]);

      if (cancelled) {
        return {
          taskId,
          agentId: task.agentId,
          output: '',
          success: false,
          error: 'Task cancelled',
          durationMs: Date.now() - startedAt,
          status: 'cancelled',
          startedAt,
          completedAt: Date.now(),
        };
      }

      const result: SubAgentResult = {
        taskId,
        agentId: task.agentId,
        output: response.content,
        success: true,
        durationMs: Date.now() - startedAt,
        tokenUsage: response.usage
          ? {
              prompt: response.usage.promptTokens,
              completion: response.usage.completionTokens,
              total: response.usage.totalTokens,
            }
          : undefined,
        toolCalls: response.toolCalls,
        status: 'completed',
        startedAt,
        completedAt: Date.now(),
      };

      config.onComplete?.(result);

      // Cache result
      if (mergedConfig.enableCaching && config.cacheTTLMs) {
        resultCache.set(taskId, {
          result,
          expiry: Date.now() + config.cacheTTLMs,
        });
      }

      return result;
    } catch (error) {
      const isTimeout = (error as Error).message.includes('Timeout');
      const result: SubAgentResult = {
        taskId,
        agentId: task.agentId,
        output: '',
        success: false,
        error: (error as Error).message,
        durationMs: Date.now() - startedAt,
        status: isTimeout ? 'timeout' : 'failed',
        startedAt,
        completedAt: Date.now(),
      };

      config.onError?.(task.agentId, error as Error);

      if (mergedConfig.propagateErrors) {
        throw error;
      }

      return result;
    } finally {
      runningTasks.delete(taskId);
    }
  }

  /**
   * Execute tasks with concurrency limit
   */
  async function executeWithConcurrency(
    tasks: SubAgentTask[],
    maxConcurrent: number
  ): Promise<SubAgentResult[]> {
    const results: SubAgentResult[] = [];
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      const promise = executeTask(task).then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
        // Remove completed promises
        for (let i = executing.length - 1; i >= 0; i--) {
          // Check if promise is settled by attempting to race with an immediately resolved promise
          const settled = await Promise.race([
            executing[i].then(() => true).catch(() => true),
            Promise.resolve(false),
          ]);
          if (settled) {
            executing.splice(i, 1);
          }
        }
      }
    }

    // Wait for all remaining tasks
    await Promise.all(executing);

    return results;
  }

  return {
    register(agentConfig: SubAgentConfig): void {
      agentConfigs.set(agentConfig.id, agentConfig);
      // Clear cached instance if re-registering
      agentInstances.delete(agentConfig.id);
    },

    unregister(agentId: string): void {
      agentConfigs.delete(agentId);
      agentInstances.delete(agentId);
    },

    getAgent(agentId: string): SubAgentConfig | undefined {
      return agentConfigs.get(agentId);
    },

    getAgents(): SubAgentConfig[] {
      return Array.from(agentConfigs.values());
    },

    async execute(task: SubAgentTask): Promise<SubAgentResult> {
      return executeTask(task);
    },

    async executeParallel(tasks: SubAgentTask[]): Promise<SubAgentResult[]> {
      return executeWithConcurrency(tasks, mergedConfig.maxConcurrent);
    },

    async orchestrate(dag: SubAgentDAG): Promise<SubAgentResult[]> {
      const results: SubAgentResult[] = [];
      const completed = new Set<string>();
      const taskMap = new Map<string, SubAgentTask>();

      // Build task map with IDs
      for (const task of dag.tasks) {
        const taskId = task.metadata?.taskId as string ?? generateTaskId();
        taskMap.set(taskId, { ...task, metadata: { ...task.metadata, taskId } });
      }

      // Build dependency map
      const dependencies = new Map<string, Set<string>>();
      for (const task of taskMap.values()) {
        const taskId = task.metadata?.taskId as string;
        dependencies.set(taskId, new Set(task.dependsOn ?? []));
      }

      // Execute tasks in dependency order
      while (completed.size < taskMap.size) {
        // Find tasks ready to execute (all dependencies met)
        const ready: SubAgentTask[] = [];
        for (const [taskId, task] of taskMap) {
          if (completed.has(taskId)) continue;

          const deps = dependencies.get(taskId) ?? new Set();
          const allDepsComplete = Array.from(deps).every(dep => completed.has(dep));
          if (allDepsComplete) {
            ready.push(task);
          }
        }

        if (ready.length === 0) {
          throw new Error('DAG has unresolvable dependencies or cycles');
        }

        // Execute ready tasks in parallel
        const batchResults = await executeWithConcurrency(
          ready,
          Math.min(ready.length, mergedConfig.maxConcurrent)
        );

        for (const result of batchResults) {
          results.push(result);
          completed.add(result.taskId);
        }
      }

      return results;
    },

    cancel(taskId: string): boolean {
      const task = runningTasks.get(taskId);
      if (task) {
        task.cancel();
        runningTasks.delete(taskId);
        return true;
      }
      return false;
    },

    cancelAll(): void {
      for (const [taskId, task] of runningTasks) {
        task.cancel();
        runningTasks.delete(taskId);
      }
    },

    getRunningCount(): number {
      return runningTasks.size;
    },

    getCachedResult(taskId: string): SubAgentResult | undefined {
      const cached = resultCache.get(taskId);
      if (cached && cached.expiry > Date.now()) {
        return cached.result;
      }
      return undefined;
    },

    clearCache(): void {
      resultCache.clear();
    },
  };
}
