/**
 * @ai-stack/agent - Built-in Guardrail Rules
 *
 * Pre-defined rules for common security and safety checks.
 */

import type { GuardrailRule, GuardrailContext, BuiltInRuleOptions } from './types.js';

// =============================================================================
// PII Detection Rules
// =============================================================================

/**
 * Create PII detection rule
 */
export function createPIIRule(options: BuiltInRuleOptions['pii'] = {}): GuardrailRule {
  const {
    detectEmail = true,
    detectPhone = true,
    detectSSN = true,
    detectCreditCard = true,
    customPatterns = [],
  } = options;

  const patterns: Array<{ name: string; pattern: RegExp }> = [];

  if (detectEmail) {
    patterns.push({
      name: 'email',
      pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    });
  }

  if (detectPhone) {
    patterns.push({
      name: 'phone',
      pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    });
  }

  if (detectSSN) {
    patterns.push({
      name: 'SSN',
      pattern: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    });
  }

  if (detectCreditCard) {
    patterns.push({
      name: 'credit card',
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    });
  }

  for (let i = 0; i < customPatterns.length; i++) {
    patterns.push({
      name: `custom_${i}`,
      pattern: customPatterns[i],
    });
  }

  return {
    id: 'builtin_pii',
    name: 'No PII in content',
    description: 'Blocks content containing personally identifiable information',
    type: 'output',
    severity: 'block',
    enabled: true,
    priority: 10,
    check: (content: string) => {
      for (const { name, pattern } of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          return {
            passed: false,
            ruleId: 'builtin_pii',
            message: `Contains ${name}`,
            matchedContent: match[0],
            suggestions: [`Remove or mask the ${name} before outputting`],
            severity: 'block',
          };
        }
      }

      return {
        passed: true,
        ruleId: 'builtin_pii',
      };
    },
  };
}

// =============================================================================
// Secrets Detection Rules
// =============================================================================

/**
 * Create secrets detection rule
 */
export function createSecretsRule(options: BuiltInRuleOptions['secrets'] = {}): GuardrailRule {
  const {
    detectApiKeys = true,
    detectPasswords = true,
    detectTokens = true,
    customPatterns = [],
  } = options;

  const patterns: Array<{ name: string; pattern: RegExp }> = [];

  if (detectApiKeys) {
    patterns.push({
      name: 'API key',
      pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    });
    // OpenAI key pattern
    patterns.push({
      name: 'OpenAI API key',
      pattern: /sk-[a-zA-Z0-9]{48}/g,
    });
    // AWS key pattern
    patterns.push({
      name: 'AWS key',
      pattern: /AKIA[A-Z0-9]{16}/g,
    });
  }

  if (detectPasswords) {
    patterns.push({
      name: 'password',
      pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?([^\s'"]{4,})['"]?/gi,
    });
  }

  if (detectTokens) {
    patterns.push({
      name: 'token',
      pattern: /(?:token|bearer)\s*[:=]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    });
    // JWT pattern
    patterns.push({
      name: 'JWT',
      pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    });
  }

  for (let i = 0; i < customPatterns.length; i++) {
    patterns.push({
      name: `custom_secret_${i}`,
      pattern: customPatterns[i],
    });
  }

  return {
    id: 'builtin_secrets',
    name: 'No secrets in content',
    description: 'Blocks content containing secrets, API keys, or tokens',
    type: 'output',
    severity: 'block',
    enabled: true,
    priority: 5,
    check: (content: string) => {
      for (const { name, pattern } of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          return {
            passed: false,
            ruleId: 'builtin_secrets',
            message: `Contains potential ${name}`,
            matchedContent: match[0].substring(0, 20) + '...', // Truncate for safety
            suggestions: ['Never include secrets in output', 'Use environment variables instead'],
            severity: 'block',
          };
        }
      }

      return {
        passed: true,
        ruleId: 'builtin_secrets',
      };
    },
  };
}

// =============================================================================
// Dangerous Commands Rules
// =============================================================================

/**
 * Create dangerous commands rule
 */
export function createDangerousCommandsRule(
  options: BuiltInRuleOptions['dangerousCommands'] = {}
): GuardrailRule {
  const { additionalPatterns = [], whitelist = [] } = options;

  const dangerousPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'recursive delete', pattern: /rm\s+-rf\s+\// },
    { name: 'format disk', pattern: /mkfs/ },
    { name: 'disk destroyer', pattern: /dd\s+if=.*of=\/dev/ },
    { name: 'fork bomb', pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/ },
    { name: 'shutdown', pattern: /shutdown|poweroff|halt/i },
    { name: 'chmod dangerous', pattern: /chmod\s+777\s+\// },
    { name: 'curl to bash', pattern: /curl.*\|\s*(?:ba)?sh/ },
    { name: 'wget to bash', pattern: /wget.*\|\s*(?:ba)?sh/ },
  ];

  for (let i = 0; i < additionalPatterns.length; i++) {
    dangerousPatterns.push({
      name: `custom_dangerous_${i}`,
      pattern: additionalPatterns[i],
    });
  }

  return {
    id: 'builtin_dangerous_commands',
    name: 'No dangerous shell commands',
    description: 'Blocks potentially dangerous shell commands',
    type: 'tool',
    severity: 'block',
    enabled: true,
    priority: 1,
    check: (content: string, context?: GuardrailContext) => {
      // Only check for bash/shell tools
      if (context?.toolName && !['bash', 'shell', 'exec', 'bash_execute'].includes(context.toolName)) {
        return { passed: true, ruleId: 'builtin_dangerous_commands' };
      }

      // Check whitelist first
      for (const whitelistPattern of whitelist) {
        if (whitelistPattern.test(content)) {
          return { passed: true, ruleId: 'builtin_dangerous_commands' };
        }
      }

      // Check dangerous patterns
      for (const { name, pattern } of dangerousPatterns) {
        if (pattern.test(content)) {
          return {
            passed: false,
            ruleId: 'builtin_dangerous_commands',
            message: `Dangerous command detected: ${name}`,
            matchedContent: content.substring(0, 100),
            suggestions: ['Review and modify the command to be safer', 'Consider alternative approaches'],
            severity: 'block',
          };
        }
      }

      return {
        passed: true,
        ruleId: 'builtin_dangerous_commands',
      };
    },
  };
}

// =============================================================================
// Prompt Injection Rules
// =============================================================================

/**
 * Create prompt injection detection rule
 */
export function createInjectionRule(options: BuiltInRuleOptions['injection'] = {}): GuardrailRule {
  const { customPatterns = [] } = options;

  const injectionPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'ignore instructions', pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions/i },
    { name: 'system override', pattern: /you\s+are\s+now\s+(?:a\s+)?(?:different|new|evil)/i },
    { name: 'jailbreak attempt', pattern: /(?:DAN|jailbreak|bypass|override)\s+mode/i },
    { name: 'role play escape', pattern: /pretend\s+(?:to\s+be|you\s+are)\s+(?:not\s+)?(?:an?\s+)?(?:AI|assistant)/i },
    { name: 'instruction injection', pattern: /\[SYSTEM\]|\[INST\]|\[\/INST\]|\<\|system\|\>/i },
  ];

  for (let i = 0; i < customPatterns.length; i++) {
    injectionPatterns.push({
      name: `custom_injection_${i}`,
      pattern: customPatterns[i],
    });
  }

  return {
    id: 'builtin_injection',
    name: 'No prompt injection',
    description: 'Detects potential prompt injection attempts in input',
    type: 'input',
    severity: 'warn',
    enabled: true,
    priority: 2,
    check: (content: string) => {
      for (const { name, pattern } of injectionPatterns) {
        if (pattern.test(content)) {
          return {
            passed: false,
            ruleId: 'builtin_injection',
            message: `Potential prompt injection detected: ${name}`,
            matchedContent: content.substring(0, 100),
            suggestions: ['Sanitize user input', 'Review for malicious intent'],
            severity: 'warn',
          };
        }
      }

      return {
        passed: true,
        ruleId: 'builtin_injection',
      };
    },
  };
}

// =============================================================================
// Length Limit Rules
// =============================================================================

/**
 * Create length limit rule
 */
export function createLengthRule(options: BuiltInRuleOptions['length'] = {}): GuardrailRule {
  const { maxInputLength = 100000, maxOutputLength = 100000 } = options;

  return {
    id: 'builtin_length',
    name: 'Content length limits',
    description: 'Enforces maximum content length',
    type: 'all',
    severity: 'block',
    enabled: true,
    priority: 100,
    check: (content: string, context?: GuardrailContext) => {
      const maxLength = context?.toolName ? maxOutputLength : maxInputLength;

      if (content.length > maxLength) {
        return {
          passed: false,
          ruleId: 'builtin_length',
          message: `Content exceeds maximum length: ${content.length} > ${maxLength}`,
          suggestions: ['Truncate or split the content'],
          severity: 'block',
        };
      }

      return {
        passed: true,
        ruleId: 'builtin_length',
      };
    },
  };
}

// =============================================================================
// Built-in Rules Collection
// =============================================================================

/**
 * Get all built-in rules
 */
export function getBuiltInRules(options: BuiltInRuleOptions = {}): GuardrailRule[] {
  return [
    createPIIRule(options.pii),
    createSecretsRule(options.secrets),
    createDangerousCommandsRule(options.dangerousCommands),
    createInjectionRule(options.injection),
    createLengthRule(options.length),
  ];
}
