/**
 * @agent-stack/memory - Rule Engine
 *
 * Manages and evaluates policy rules.
 */

import type { PolicyRule, RuleCondition, RuleAction } from '../policy/types.js';

/**
 * Rule Engine instance interface
 */
export interface IRuleEngine {
  /** Add a rule */
  addRule(rule: PolicyRule): void;
  /** Remove a rule */
  removeRule(ruleId: string): boolean;
  /** Get a rule by ID */
  getRule(ruleId: string): PolicyRule | undefined;
  /** Get all rules */
  getRules(): PolicyRule[];
  /** Get rules by action type */
  getRulesByAction(actionType: RuleAction['type']): PolicyRule[];
  /** Enable a rule */
  enableRule(ruleId: string): boolean;
  /** Disable a rule */
  disableRule(ruleId: string): boolean;
  /** Evaluate rules against context */
  evaluate<T>(context: T, evaluator: (rule: PolicyRule, context: T) => boolean): PolicyRule[];
  /** Clear all rules */
  clear(): void;
  /** Import rules from JSON */
  importRules(rules: PolicyRule[]): void;
  /** Export rules to JSON */
  exportRules(): PolicyRule[];
}

/**
 * Create a Rule Engine instance
 */
export function createRuleEngine(): IRuleEngine {
  // Private state
  const rules: Map<string, PolicyRule> = new Map();

  /**
   * Sort rules by priority (descending)
   */
  function sortedRules(): PolicyRule[] {
    return Array.from(rules.values()).sort((a, b) => b.priority - a.priority);
  }

  return {
    addRule(rule: PolicyRule): void {
      rules.set(rule.id, { ...rule });
    },

    removeRule(ruleId: string): boolean {
      return rules.delete(ruleId);
    },

    getRule(ruleId: string): PolicyRule | undefined {
      const rule = rules.get(ruleId);
      return rule ? { ...rule } : undefined;
    },

    getRules(): PolicyRule[] {
      return sortedRules().map((r) => ({ ...r }));
    },

    getRulesByAction(actionType: RuleAction['type']): PolicyRule[] {
      return sortedRules()
        .filter((r) => r.action.type === actionType)
        .map((r) => ({ ...r }));
    },

    enableRule(ruleId: string): boolean {
      const rule = rules.get(ruleId);
      if (rule) {
        rule.enabled = true;
        return true;
      }
      return false;
    },

    disableRule(ruleId: string): boolean {
      const rule = rules.get(ruleId);
      if (rule) {
        rule.enabled = false;
        return true;
      }
      return false;
    },

    evaluate<T>(context: T, evaluator: (rule: PolicyRule, context: T) => boolean): PolicyRule[] {
      const matched: PolicyRule[] = [];

      for (const rule of sortedRules()) {
        if (!rule.enabled) continue;

        try {
          if (evaluator(rule, context)) {
            matched.push({ ...rule });
          }
        } catch (error) {
          console.warn(`[RuleEngine] Error evaluating rule "${rule.id}":`, error);
        }
      }

      return matched;
    },

    clear(): void {
      rules.clear();
    },

    importRules(newRules: PolicyRule[]): void {
      for (const rule of newRules) {
        rules.set(rule.id, { ...rule });
      }
    },

    exportRules(): PolicyRule[] {
      return sortedRules().map((r) => ({ ...r }));
    },
  };
}

/**
 * Create a policy rule
 */
export function createRule(
  id: string,
  name: string,
  condition: RuleCondition,
  action: RuleAction,
  options: { priority?: number; enabled?: boolean } = {}
): PolicyRule {
  return {
    id,
    name,
    priority: options.priority ?? 0,
    condition,
    action,
    enabled: options.enabled ?? true,
  };
}

/**
 * Condition builder helpers
 */
export const conditions = {
  eventType(...types: string[]): RuleCondition {
    return { type: 'event_type', params: { types } };
  },

  contentMatch(...patterns: string[]): RuleCondition {
    return { type: 'content_match', params: { patterns } };
  },

  tokenThreshold(threshold: number): RuleCondition {
    return { type: 'token_threshold', params: { threshold } };
  },

  timeElapsed(thresholdMs: number): RuleCondition {
    return { type: 'time_elapsed', params: { threshold: thresholdMs } };
  },

  custom(fn: string): RuleCondition {
    return { type: 'custom', params: { fn } };
  },
};

/**
 * Action builder helpers
 */
export const actions = {
  write(...layers: string[]): RuleAction {
    return { type: 'write', params: { layers } };
  },

  skip(reason?: string): RuleAction {
    return { type: 'skip', params: { reason } };
  },

  summarize(): RuleAction {
    return { type: 'summarize', params: {} };
  },

  retrieve(...layers: string[]): RuleAction {
    return { type: 'retrieve', params: { layers } };
  },

  extractProfile(): RuleAction {
    return { type: 'extract_profile', params: {} };
  },
};
