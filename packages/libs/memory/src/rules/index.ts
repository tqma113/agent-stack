/**
 * @ai-stack/memory - Rules Layer
 *
 * Export all rule components.
 */

// Rule Engine
export {
  createRuleEngine,
  createRule,
  conditions,
  actions,
  type IRuleEngine,
} from './rule-engine.js';

// Default Rules
export {
  DEFAULT_RETRIEVAL_RULES,
  DEFAULT_WRITE_RULES,
  getDefaultRules,
  getDefaultRetrievalRules,
  getDefaultWriteRules,
  createEventTypeWriteRule,
  createContentPatternRule,
} from './default-rules.js';
