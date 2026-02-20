/**
 * @ai-stack/agent - Guardrail Implementation
 *
 * Content validation and safety checks for
 * inputs, outputs, and tool calls.
 */

import type {
  GuardrailConfig,
  GuardrailRule,
  GuardrailResult,
  GuardrailContext,
  GuardrailRuleType,
} from './types.js';
import { DEFAULT_GUARDRAIL_CONFIG } from './types.js';
import { getBuiltInRules } from './rules.js';

// =============================================================================
// Guardrail Instance Interface
// =============================================================================

/**
 * Guardrail instance interface
 */
export interface GuardrailInstance {
  /** Check input content */
  checkInput(input: string, context?: GuardrailContext): Promise<GuardrailResult[]>;

  /** Check output content */
  checkOutput(output: string, context?: GuardrailContext): Promise<GuardrailResult[]>;

  /** Check tool call */
  checkToolCall(
    toolName: string,
    args: Record<string, unknown>,
    context?: GuardrailContext
  ): Promise<GuardrailResult[]>;

  /** Check content with specific rule type */
  check(
    content: string,
    type: GuardrailRuleType,
    context?: GuardrailContext
  ): Promise<GuardrailResult[]>;

  /** Add a rule */
  addRule(rule: GuardrailRule): void;

  /** Remove a rule */
  removeRule(ruleId: string): void;

  /** Enable/disable a rule */
  setRuleEnabled(ruleId: string, enabled: boolean): void;

  /** Get all rules */
  getRules(): GuardrailRule[];

  /** Get rule by ID */
  getRule(ruleId: string): GuardrailRule | undefined;

  /** Check if any result should block */
  shouldBlock(results: GuardrailResult[]): boolean;

  /** Get violations (failed checks) */
  getViolations(results: GuardrailResult[]): GuardrailResult[];
}

// =============================================================================
// Guardrail Factory
// =============================================================================

/**
 * Create guardrail instance
 */
export function createGuardrail(config: GuardrailConfig = {}): GuardrailInstance {
  const mergedConfig = { ...DEFAULT_GUARDRAIL_CONFIG, ...config };

  // Initialize rules
  const rules: Map<string, GuardrailRule> = new Map();

  // Add built-in rules if enabled
  if (mergedConfig.enableBuiltInRules) {
    for (const rule of getBuiltInRules()) {
      rules.set(rule.id, rule);
    }
  }

  // Add custom rules
  if (config.rules) {
    for (const rule of config.rules) {
      rules.set(rule.id, rule);
    }
  }

  /**
   * Run checks for a specific type
   */
  async function runChecks(
    content: string,
    type: GuardrailRuleType,
    context?: GuardrailContext
  ): Promise<GuardrailResult[]> {
    const results: GuardrailResult[] = [];
    const applicableRules = Array.from(rules.values())
      .filter(rule => rule.enabled !== false && (rule.type === type || rule.type === 'all'))
      .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

    for (const rule of applicableRules) {
      try {
        const result = await Promise.resolve(rule.check(content, context));

        if (mergedConfig.logAllChecks || !result.passed) {
          results.push(result);
        }

        if (!result.passed) {
          config.onViolation?.(result, content, context);
        }
      } catch (error) {
        // Rule check failed, treat as passed with warning
        results.push({
          passed: true,
          ruleId: rule.id,
          message: `Rule check error: ${(error as Error).message}`,
        });
      }
    }

    return results;
  }

  return {
    async checkInput(input: string, context?: GuardrailContext): Promise<GuardrailResult[]> {
      return runChecks(input, 'input', context);
    },

    async checkOutput(output: string, context?: GuardrailContext): Promise<GuardrailResult[]> {
      return runChecks(output, 'output', context);
    },

    async checkToolCall(
      toolName: string,
      args: Record<string, unknown>,
      context?: GuardrailContext
    ): Promise<GuardrailResult[]> {
      const toolContext: GuardrailContext = {
        ...context,
        toolName,
        toolArgs: args,
      };

      // Check the tool name and stringified args
      const content = JSON.stringify({ tool: toolName, args });
      const results = await runChecks(content, 'tool', toolContext);

      // Also check individual string arguments
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === 'string') {
          const argResults = await runChecks(value, 'tool', {
            ...toolContext,
            metadata: { ...toolContext.metadata, argumentName: key },
          });
          results.push(...argResults);
        }
      }

      return results;
    },

    async check(
      content: string,
      type: GuardrailRuleType,
      context?: GuardrailContext
    ): Promise<GuardrailResult[]> {
      return runChecks(content, type, context);
    },

    addRule(rule: GuardrailRule): void {
      rules.set(rule.id, rule);
    },

    removeRule(ruleId: string): void {
      rules.delete(ruleId);
    },

    setRuleEnabled(ruleId: string, enabled: boolean): void {
      const rule = rules.get(ruleId);
      if (rule) {
        rule.enabled = enabled;
      }
    },

    getRules(): GuardrailRule[] {
      return Array.from(rules.values());
    },

    getRule(ruleId: string): GuardrailRule | undefined {
      return rules.get(ruleId);
    },

    shouldBlock(results: GuardrailResult[]): boolean {
      if (!mergedConfig.blockOnViolation) return false;

      return results.some(r => !r.passed && r.severity === 'block');
    },

    getViolations(results: GuardrailResult[]): GuardrailResult[] {
      return results.filter(r => !r.passed);
    },
  };
}
