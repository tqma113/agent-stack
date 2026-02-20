/**
 * @ai-stack/agent - Guardrail Module
 *
 * Provides content validation and safety checks:
 * - PII detection (email, phone, SSN, credit cards)
 * - Secrets detection (API keys, passwords, tokens)
 * - Dangerous command detection
 * - Prompt injection detection
 * - Content length limits
 */

export {
  createGuardrail,
  type GuardrailInstance,
} from './guardrail.js';

export {
  createPIIRule,
  createSecretsRule,
  createDangerousCommandsRule,
  createInjectionRule,
  createLengthRule,
  getBuiltInRules,
} from './rules.js';

export type {
  GuardrailRuleType,
  GuardrailSeverity,
  GuardrailContext,
  GuardrailResult,
  GuardrailRule,
  GuardrailConfig,
  BuiltInRuleCategory,
  BuiltInRuleOptions,
} from './types.js';

export { DEFAULT_GUARDRAIL_CONFIG } from './types.js';
