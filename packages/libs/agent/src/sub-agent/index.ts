/**
 * @ai-stack/agent - Sub-Agent Module
 *
 * Provides sub-agent orchestration:
 * - Register and manage multiple sub-agents
 * - Execute tasks in parallel
 * - DAG-based dependency orchestration
 * - Task cancellation and timeout
 */

export {
  createSubAgentManager,
  type SubAgentManagerInstance,
  type AgentFactory,
  type SubAgentLike,
} from './manager.js';

export type {
  SubAgentConfig,
  SubAgentTask,
  SubAgentTaskStatus,
  SubAgentResult,
  SubAgentDAG,
  SubAgentManagerConfig,
} from './types.js';

export { DEFAULT_SUB_AGENT_MANAGER_CONFIG } from './types.js';
