/**
 * @ai-stack/agent - Evaluator Module
 *
 * Provides output quality evaluation with:
 * - Multi-dimensional scoring (accuracy, completeness, etc.)
 * - LLM-powered evaluation
 * - Self-checking for consistency
 * - Retry recommendations
 */

export {
  createEvaluator,
  createSimpleEvaluator,
  createRuleBasedEvaluator,
  DEFAULT_EVAL_PROMPT,
  DEFAULT_SELF_CHECK_PROMPT,
  type EvaluatorInstance,
  type LLMChatFn,
} from './evaluator.js';

export type {
  EvaluationDimension,
  CustomCriterion,
  EvaluationCriteria,
  ToolResultForEval,
  EvalContext,
  EvaluationResult,
  SelfCheckResult,
  EvaluatorConfig,
} from './types.js';

export { DEFAULT_CRITERIA, DEFAULT_EVALUATOR_CONFIG } from './types.js';
