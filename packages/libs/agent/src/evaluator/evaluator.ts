/**
 * @ai-stack/agent - Evaluator Implementation
 *
 * LLM-powered output quality evaluation with
 * self-checking and retry recommendations.
 */

import type {
  EvaluatorConfig,
  EvalContext,
  EvaluationResult,
  SelfCheckResult,
  EvaluationCriteria,
} from './types.js';
import { DEFAULT_EVALUATOR_CONFIG, DEFAULT_CRITERIA } from './types.js';

// =============================================================================
// Evaluator Instance Interface
// =============================================================================

/**
 * Evaluator instance interface
 */
export interface EvaluatorInstance {
  /** Evaluate output quality */
  evaluate(output: string, context: EvalContext): Promise<EvaluationResult>;

  /** Self-check response for consistency */
  selfCheck(response: string, context: EvalContext): Promise<SelfCheckResult>;

  /** Determine if should retry based on evaluation */
  shouldRetry(result: EvaluationResult): boolean;

  /** Get improvement suggestions */
  getSuggestions(result: EvaluationResult): string[];

  /** Update configuration */
  updateConfig(config: Partial<EvaluatorConfig>): void;
}

// =============================================================================
// Default Prompts
// =============================================================================

/**
 * Default evaluation prompt
 */
export const DEFAULT_EVAL_PROMPT = `You are an AI output evaluator. Evaluate the following response.

Response to evaluate:
"""
{{output}}
"""

Original request:
"""
{{request}}
"""

{{#if toolResults}}
Tool results used:
{{toolResults}}
{{/if}}

{{#if additionalContext}}
Additional context:
{{additionalContext}}
{{/if}}

Evaluate on these criteria (score 0-10 for each):
1. Accuracy: Is the information factually correct?
2. Completeness: Does it fully address all aspects of the request?
3. Relevance: Is the response focused on what was asked?
4. Safety: Is the response safe and appropriate?
5. Coherence: Is the response logically consistent and well-structured?
6. Helpfulness: Is the response genuinely helpful to the user?

Respond in JSON format:
{
  "scores": {
    "accuracy": 8,
    "completeness": 7,
    "relevance": 9,
    "safety": 10,
    "coherence": 8,
    "helpfulness": 7
  },
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "overallAssessment": "good|acceptable|poor",
  "confidence": 0.85
}

Be critical but fair. Only give 10 for truly exceptional performance.
Respond ONLY with the JSON object.`;

/**
 * Default self-check prompt
 */
export const DEFAULT_SELF_CHECK_PROMPT = `You are checking a response for consistency and correctness.

Response to check:
"""
{{response}}
"""

Original request:
"""
{{request}}
"""

{{#if toolResults}}
Tool results that should inform the response:
{{toolResults}}
{{/if}}

Check for:
1. Internal consistency (no contradictions)
2. Factual accuracy against tool results
3. Completeness relative to the request
4. Any hallucinated information

Respond in JSON format:
{
  "consistent": true|false,
  "confidence": 0.9,
  "problems": ["problem 1", "problem 2"],
  "corrections": ["suggested correction 1"],
  "verifiedFacts": ["fact that matches tool results"],
  "unverifiedFacts": ["fact that couldn't be verified"]
}

Respond ONLY with the JSON object.`;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract JSON from LLM response
 */
function extractJSON(response: string): string {
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0];
  }

  return response.trim();
}

/**
 * Simple template rendering
 */
function renderTemplate(
  template: string,
  vars: Record<string, unknown>
): string {
  let result = template;

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }

  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, content) => {
      const value = vars[varName];
      return value ? content : '';
    }
  );

  return result;
}

/**
 * Normalize criteria weights to sum to 1
 */
function normalizeCriteria(criteria: EvaluationCriteria): Record<string, number> {
  const normalized: Record<string, number> = {};
  let total = 0;

  // Built-in criteria
  const builtIn: (keyof EvaluationCriteria)[] = [
    'accuracy', 'completeness', 'relevance', 'safety', 'coherence', 'helpfulness'
  ];

  for (const key of builtIn) {
    const weight = criteria[key];
    if (typeof weight === 'number' && weight > 0) {
      normalized[key] = weight;
      total += weight;
    }
  }

  // Custom criteria
  if (criteria.custom) {
    for (const custom of criteria.custom) {
      if (custom.weight > 0) {
        normalized[custom.name] = custom.weight;
        total += custom.weight;
      }
    }
  }

  // Normalize to sum to 1
  if (total > 0) {
    for (const key of Object.keys(normalized)) {
      normalized[key] /= total;
    }
  }

  return normalized;
}

// =============================================================================
// Evaluator Factory
// =============================================================================

/**
 * LLM chat function type
 */
export type LLMChatFn = (prompt: string, model?: string) => Promise<string>;

/**
 * Create evaluator instance
 */
export function createEvaluator(
  config: EvaluatorConfig,
  llmChat: LLMChatFn
): EvaluatorInstance {
  let currentConfig = {
    ...DEFAULT_EVALUATOR_CONFIG,
    ...config,
    criteria: { ...DEFAULT_CRITERIA, ...config.criteria },
  };

  const normalizedCriteria = normalizeCriteria(currentConfig.criteria);

  return {
    async evaluate(output: string, context: EvalContext): Promise<EvaluationResult> {
      // Simple rule-based evaluation if LLM eval disabled
      if (!currentConfig.useLLMEval) {
        return createRuleBasedEvaluation(output, context, currentConfig.passThreshold);
      }

      const prompt = renderTemplate(
        currentConfig.evalPrompt ?? DEFAULT_EVAL_PROMPT,
        {
          output,
          request: context.originalRequest,
          toolResults: context.toolResults
            ? JSON.stringify(context.toolResults, null, 2)
            : undefined,
          additionalContext: context.additionalContext
            ? JSON.stringify(context.additionalContext, null, 2)
            : undefined,
        }
      );

      try {
        const response = await llmChat(prompt, currentConfig.evalModel);
        const jsonStr = extractJSON(response);

        let evalData: {
          scores: Record<string, number>;
          issues?: string[];
          suggestions?: string[];
          overallAssessment?: string;
          confidence?: number;
        };

        try {
          evalData = JSON.parse(jsonStr);
        } catch (e) {
          // Fallback to default scores if parsing fails
          evalData = {
            scores: { accuracy: 7, completeness: 7, relevance: 7, safety: 10, coherence: 7, helpfulness: 7 },
            issues: ['Failed to parse evaluation response'],
          };
        }

        // Calculate weighted score
        let totalWeight = 0;
        let weightedSum = 0;
        const breakdown: Record<string, number> = {};

        for (const [key, weight] of Object.entries(normalizedCriteria)) {
          const rawScore = evalData.scores[key];
          if (rawScore !== undefined) {
            const normalizedScore = rawScore / 10; // Convert 0-10 to 0-1
            breakdown[key] = normalizedScore;
            weightedSum += normalizedScore * weight;
            totalWeight += weight;
          }
        }

        const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const passed = score >= (currentConfig.passThreshold ?? 0.7);
        const retryCount = context.retryCount ?? 0;
        const maxRetries = context.maxRetries ?? currentConfig.maxRetries ?? 2;

        return {
          score,
          breakdown,
          passed,
          issues: evalData.issues ?? [],
          suggestions: evalData.suggestions ?? [],
          shouldRetry: !passed && retryCount < maxRetries,
          retryReason: !passed ? `Score ${score.toFixed(2)} below threshold ${currentConfig.passThreshold}` : undefined,
          confidence: evalData.confidence,
          rawResponse: response,
        };
      } catch (error) {
        // Return conservative evaluation on error
        return {
          score: 0.5,
          breakdown: {},
          passed: false,
          issues: [`Evaluation error: ${(error as Error).message}`],
          suggestions: ['Review output manually'],
          shouldRetry: (context.retryCount ?? 0) < (currentConfig.maxRetries ?? 2),
          retryReason: 'Evaluation failed',
        };
      }
    },

    async selfCheck(response: string, context: EvalContext): Promise<SelfCheckResult> {
      if (!currentConfig.useLLMEval) {
        return {
          consistent: true,
          problems: [],
          corrections: [],
          confidence: 0.5,
        };
      }

      const prompt = renderTemplate(
        currentConfig.selfCheckPrompt ?? DEFAULT_SELF_CHECK_PROMPT,
        {
          response,
          request: context.originalRequest,
          toolResults: context.toolResults
            ? JSON.stringify(context.toolResults, null, 2)
            : undefined,
        }
      );

      try {
        const llmResponse = await llmChat(prompt, currentConfig.evalModel);
        const jsonStr = extractJSON(llmResponse);

        let checkData: {
          consistent: boolean;
          confidence?: number;
          problems?: string[];
          corrections?: string[];
          verifiedFacts?: string[];
          unverifiedFacts?: string[];
        };

        try {
          checkData = JSON.parse(jsonStr);
        } catch {
          checkData = { consistent: true, problems: ['Failed to parse self-check response'] };
        }

        return {
          consistent: checkData.consistent,
          problems: checkData.problems ?? [],
          corrections: checkData.corrections ?? [],
          confidence: checkData.confidence ?? 0.5,
          verifiedFacts: checkData.verifiedFacts,
          unverifiedFacts: checkData.unverifiedFacts,
        };
      } catch (error) {
        return {
          consistent: true,
          problems: [`Self-check error: ${(error as Error).message}`],
          corrections: [],
          confidence: 0.3,
        };
      }
    },

    shouldRetry(result: EvaluationResult): boolean {
      return result.shouldRetry;
    },

    getSuggestions(result: EvaluationResult): string[] {
      return result.suggestions;
    },

    updateConfig(newConfig: Partial<EvaluatorConfig>): void {
      currentConfig = {
        ...currentConfig,
        ...newConfig,
        criteria: { ...currentConfig.criteria, ...newConfig.criteria },
      };
    },
  };
}

// =============================================================================
// Rule-based Evaluation (No LLM)
// =============================================================================

/**
 * Create simple rule-based evaluation
 */
function createRuleBasedEvaluation(
  output: string,
  context: EvalContext,
  passThreshold: number
): EvaluationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0.8; // Start with default good score

  // Check for empty output
  if (!output || output.trim().length === 0) {
    issues.push('Output is empty');
    score = 0;
  }

  // Check for minimum length
  if (output.length < 20) {
    issues.push('Output is very short');
    score -= 0.2;
    suggestions.push('Provide more detailed response');
  }

  // Check if output mentions the request
  const requestWords = context.originalRequest.toLowerCase().split(/\s+/);
  const outputLower = output.toLowerCase();
  const matchedWords = requestWords.filter(word => word.length > 3 && outputLower.includes(word));
  if (matchedWords.length < requestWords.length * 0.3) {
    issues.push('Output may not be addressing the request');
    score -= 0.15;
  }

  // Check for error indicators
  const errorPatterns = [/error/i, /failed/i, /could not/i, /unable to/i];
  for (const pattern of errorPatterns) {
    if (pattern.test(output)) {
      issues.push('Output indicates an error');
      score -= 0.1;
      break;
    }
  }

  // Check for uncertainty indicators
  const uncertaintyPatterns = [/i'm not sure/i, /i don't know/i, /unclear/i];
  for (const pattern of uncertaintyPatterns) {
    if (pattern.test(output)) {
      suggestions.push('Consider providing more definitive answer');
      break;
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(1, score));
  const passed = score >= passThreshold;

  return {
    score,
    breakdown: {
      completeness: score,
      relevance: score,
    },
    passed,
    issues,
    suggestions,
    shouldRetry: !passed,
    retryReason: !passed ? `Score ${score.toFixed(2)} below threshold ${passThreshold}` : undefined,
    confidence: 0.5, // Low confidence for rule-based
  };
}

// =============================================================================
// Convenience Factory
// =============================================================================

/**
 * Create evaluator with minimal configuration
 */
export function createSimpleEvaluator(
  llmChat: LLMChatFn,
  options: {
    passThreshold?: number;
    evalModel?: string;
  } = {}
): EvaluatorInstance {
  return createEvaluator(
    {
      passThreshold: options.passThreshold ?? 0.7,
      evalModel: options.evalModel,
      useLLMEval: true,
      maxRetries: 2,
    },
    llmChat
  );
}

/**
 * Create rule-based evaluator (no LLM)
 */
export function createRuleBasedEvaluator(
  passThreshold = 0.7
): EvaluatorInstance {
  // Create a dummy LLM function that won't be used
  const dummyLLM: LLMChatFn = async () => '';

  return createEvaluator(
    {
      useLLMEval: false,
      passThreshold,
    },
    dummyLLM
  );
}
