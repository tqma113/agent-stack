/**
 * @ai-stack/agent - Guardrail Types
 *
 * Defines types for input/output validation,
 * safety checks, and content filtering.
 */

// =============================================================================
// Guardrail Rules
// =============================================================================

/**
 * Rule type
 */
export type GuardrailRuleType = 'input' | 'output' | 'tool' | 'all';

/**
 * Rule severity
 */
export type GuardrailSeverity = 'block' | 'warn' | 'log';

/**
 * Guardrail context
 */
export interface GuardrailContext {
  /** Tool name (for tool rules) */
  toolName?: string;
  /** Tool arguments (for tool rules) */
  toolArgs?: Record<string, unknown>;
  /** User ID (if available) */
  userId?: string;
  /** Session ID */
  sessionId?: string;
  /** Conversation history */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Guardrail check result
 */
export interface GuardrailResult {
  /** Whether the check passed */
  passed: boolean;
  /** Rule ID that was checked */
  ruleId: string;
  /** Message explaining the result */
  message?: string;
  /** Suggestions for fixing violations */
  suggestions?: string[];
  /** Matched content (for debugging) */
  matchedContent?: string;
  /** Severity if rule failed */
  severity?: GuardrailSeverity;
}

/**
 * Guardrail rule definition
 */
export interface GuardrailRule {
  /** Unique rule ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Rule description */
  description?: string;
  /** Rule type */
  type: GuardrailRuleType;
  /** Check function */
  check: (content: string, context?: GuardrailContext) => GuardrailResult | Promise<GuardrailResult>;
  /** Severity when rule fails */
  severity: GuardrailSeverity;
  /** Whether rule is enabled */
  enabled?: boolean;
  /** Priority (lower = checked first) */
  priority?: number;
}

// =============================================================================
// Guardrail Configuration
// =============================================================================

/**
 * Guardrail configuration
 */
export interface GuardrailConfig {
  /** Rules to apply */
  rules?: GuardrailRule[];

  /** Callback when violation detected */
  onViolation?: (result: GuardrailResult, content: string, context?: GuardrailContext) => void;

  /** Block on any violation (default: true for 'block' severity) */
  blockOnViolation?: boolean;

  /** Enable built-in rules */
  enableBuiltInRules?: boolean;

  /** Custom rules directory (for dynamic loading) */
  rulesDirectory?: string;

  /** Log all checks (even passed) */
  logAllChecks?: boolean;
}

// =============================================================================
// Built-in Rule Categories
// =============================================================================

/**
 * Built-in rule category
 */
export type BuiltInRuleCategory =
  | 'pii'              // Personal Identifiable Information
  | 'secrets'          // API keys, passwords, tokens
  | 'dangerous_commands' // Dangerous shell commands
  | 'injection'        // Prompt injection attempts
  | 'offensive'        // Offensive language
  | 'urls'             // URL validation
  | 'length';          // Content length limits

/**
 * Built-in rule options
 */
export interface BuiltInRuleOptions {
  /** PII detection options */
  pii?: {
    /** Detect email addresses */
    detectEmail?: boolean;
    /** Detect phone numbers */
    detectPhone?: boolean;
    /** Detect SSN */
    detectSSN?: boolean;
    /** Detect credit cards */
    detectCreditCard?: boolean;
    /** Custom patterns */
    customPatterns?: RegExp[];
  };

  /** Secrets detection options */
  secrets?: {
    /** Detect API keys */
    detectApiKeys?: boolean;
    /** Detect passwords */
    detectPasswords?: boolean;
    /** Detect tokens */
    detectTokens?: boolean;
    /** Custom patterns */
    customPatterns?: RegExp[];
  };

  /** Dangerous commands options */
  dangerousCommands?: {
    /** Additional dangerous patterns */
    additionalPatterns?: RegExp[];
    /** Whitelist patterns */
    whitelist?: RegExp[];
  };

  /** Injection detection options */
  injection?: {
    /** Custom injection patterns */
    customPatterns?: RegExp[];
  };

  /** Length limits */
  length?: {
    /** Maximum input length */
    maxInputLength?: number;
    /** Maximum output length */
    maxOutputLength?: number;
  };
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default guardrail configuration
 */
export const DEFAULT_GUARDRAIL_CONFIG: Required<
  Pick<GuardrailConfig, 'blockOnViolation' | 'enableBuiltInRules' | 'logAllChecks'>
> = {
  blockOnViolation: true,
  enableBuiltInRules: true,
  logAllChecks: false,
};
