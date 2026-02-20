/**
 * @ai-stack/agent - Evaluator Types
 *
 * Defines types for output quality evaluation,
 * self-checking, and retry decisions.
 */

// =============================================================================
// Evaluation Criteria
// =============================================================================

/**
 * Built-in evaluation dimensions
 */
export type EvaluationDimension =
  | 'accuracy'      // Is the information correct?
  | 'completeness'  // Does it fully address the request?
  | 'relevance'     // Is it focused on what was asked?
  | 'safety'        // Is it safe and appropriate?
  | 'coherence'     // Is it logically consistent?
  | 'helpfulness';  // Is it helpful to the user?

/**
 * Custom evaluation criterion
 */
export interface CustomCriterion {
  /** Criterion name */
  name: string;
  /** Weight (0-1, will be normalized) */
  weight: number;
  /** Description for LLM evaluation */
  description?: string;
  /** Custom evaluator function */
  evaluator?: (output: string, context: EvalContext) => number | Promise<number>;
}

/**
 * Evaluation criteria configuration
 */
export interface EvaluationCriteria {
  /** Accuracy weight (default: 0.25) */
  accuracy?: number;
  /** Completeness weight (default: 0.25) */
  completeness?: number;
  /** Relevance weight (default: 0.2) */
  relevance?: number;
  /** Safety weight (default: 0.15) */
  safety?: number;
  /** Coherence weight (default: 0.1) */
  coherence?: number;
  /** Helpfulness weight (default: 0.05) */
  helpfulness?: number;
  /** Custom criteria */
  custom?: CustomCriterion[];
}

// =============================================================================
// Evaluation Context
// =============================================================================

/**
 * Tool result for evaluation
 */
export interface ToolResultForEval {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Tool result */
  result: string;
  /** Whether tool succeeded */
  success: boolean;
}

/**
 * Context provided to evaluator
 */
export interface EvalContext {
  /** Original user request */
  originalRequest: string;
  /** Conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Tool results from execution */
  toolResults?: ToolResultForEval[];
  /** Additional context */
  additionalContext?: Record<string, unknown>;
  /** Current retry count */
  retryCount?: number;
  /** Maximum retries allowed */
  maxRetries?: number;
}

// =============================================================================
// Evaluation Results
// =============================================================================

/**
 * Evaluation result
 */
export interface EvaluationResult {
  /** Overall score (0-1) */
  score: number;

  /** Breakdown by dimension */
  breakdown: Record<string, number>;

  /** Whether evaluation passed threshold */
  passed: boolean;

  /** Identified issues */
  issues: string[];

  /** Improvement suggestions */
  suggestions: string[];

  /** Whether retry is recommended */
  shouldRetry: boolean;

  /** Reason for retry (if shouldRetry is true) */
  retryReason?: string;

  /** Confidence in evaluation (0-1) */
  confidence?: number;

  /** Raw LLM evaluation response (for debugging) */
  rawResponse?: string;
}

/**
 * Self-check result
 */
export interface SelfCheckResult {
  /** Whether response is consistent */
  consistent: boolean;

  /** Detected problems */
  problems: string[];

  /** Suggested corrections */
  corrections: string[];

  /** Confidence in self-check (0-1) */
  confidence: number;

  /** Facts verified against tool results */
  verifiedFacts?: string[];

  /** Facts that couldn't be verified */
  unverifiedFacts?: string[];
}

// =============================================================================
// Evaluator Configuration
// =============================================================================

/**
 * Evaluator configuration
 */
export interface EvaluatorConfig {
  /** Pass threshold (0-1, default: 0.7) */
  passThreshold?: number;

  /** Use LLM for evaluation (default: true) */
  useLLMEval?: boolean;

  /** Model for evaluation (can use cheaper model) */
  evalModel?: string;

  /** Maximum retries before giving up */
  maxRetries?: number;

  /** Evaluation criteria and weights */
  criteria?: EvaluationCriteria;

  /** Enable self-check after generation */
  enableSelfCheck?: boolean;

  /** Timeout for evaluation (ms) */
  timeoutMs?: number;

  /** Cache evaluation results */
  enableCaching?: boolean;

  /** Custom evaluation prompt */
  evalPrompt?: string;

  /** Custom self-check prompt */
  selfCheckPrompt?: string;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default evaluation criteria weights
 */
export const DEFAULT_CRITERIA: EvaluationCriteria = {
  accuracy: 0.25,
  completeness: 0.25,
  relevance: 0.2,
  safety: 0.15,
  coherence: 0.1,
  helpfulness: 0.05,
};

/**
 * Default evaluator configuration
 */
export const DEFAULT_EVALUATOR_CONFIG: Required<
  Pick<EvaluatorConfig, 'passThreshold' | 'useLLMEval' | 'maxRetries' | 'enableSelfCheck' | 'enableCaching'>
> = {
  passThreshold: 0.7,
  useLLMEval: true,
  maxRetries: 2,
  enableSelfCheck: false,
  enableCaching: false,
};
