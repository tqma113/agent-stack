/**
 * @ai-stack/agent - Planner Module
 *
 * Provides LLM-powered plan generation with DAG-based
 * task decomposition and dependency management:
 * - PlanDAG: Directed acyclic graph for task dependencies
 * - Planner: LLM-powered plan generation
 * - Parallel execution support
 * - Dynamic replanning on failures
 */

export {
  createPlanDAG,
  type PlanDAGInstance,
} from './plan-dag.js';

export {
  createPlanner,
  createRuleBasedPlanner,
  DEFAULT_PLAN_PROMPT,
  REPLAN_PROMPT,
  DECOMPOSE_PROMPT,
  type PlannerInstance,
  type LLMChatFn,
} from './planner.js';

export type {
  PlanNodeStatus,
  PlanNode,
  PlanStatus,
  PlanDAG,
  PlanProgress,
  PlanningMode,
  PlannerConfig,
  PlanContext,
  PlanEventType,
  PlanEvent,
  PlanEventListener,
} from './types.js';

export { DEFAULT_PLANNER_CONFIG } from './types.js';
