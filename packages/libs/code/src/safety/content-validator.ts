/**
 * @ai-stack/code - Content Validator
 *
 * Validates file content for secrets and sensitive information.
 */

import type { SafetyConfig } from '../types.js';
import { ContentError } from '../errors.js';

/**
 * Secret pattern definition
 */
interface SecretPattern {
  name: string;
  pattern: RegExp;
  description: string;
}

/**
 * Common secret patterns
 */
const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    description: 'AWS access key ID',
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws.{0,20}secret.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]/gi,
    description: 'AWS secret access key',
  },
  {
    name: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    description: 'GitHub personal access token',
  },
  {
    name: 'GitHub OAuth',
    pattern: /github.{0,20}['\"][0-9a-zA-Z]{35,40}['\"]/gi,
    description: 'GitHub OAuth token',
  },
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key.{0,20}['\"][0-9a-zA-Z]{32,}['\"]/gi,
    description: 'Generic API key',
  },
  {
    name: 'Generic Secret',
    pattern: /secret.{0,20}['\"][0-9a-zA-Z]{32,}['\"]/gi,
    description: 'Generic secret',
  },
  {
    name: 'Private Key',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    description: 'Private key file',
  },
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}/g,
    description: 'Slack token',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z-_]{35}/g,
    description: 'Google API key',
  },
  {
    name: 'Stripe Key',
    pattern: /sk_live_[0-9a-zA-Z]{24,}/g,
    description: 'Stripe secret key',
  },
  {
    name: 'Stripe Key Test',
    pattern: /sk_test_[0-9a-zA-Z]{24,}/g,
    description: 'Stripe test key',
  },
  {
    name: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9-]{80,}/g,
    description: 'Anthropic API key',
  },
  {
    name: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    description: 'OpenAI API key',
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    description: 'JWT token',
  },
  {
    name: 'Basic Auth',
    pattern: /basic\s+[a-zA-Z0-9=:_\+\/-]{20,}/gi,
    description: 'Basic authentication header',
  },
  {
    name: 'Bearer Token',
    pattern: /bearer\s+[a-zA-Z0-9=:_\+\/-]{20,}/gi,
    description: 'Bearer token',
  },
];

/**
 * Secret detection result
 */
export interface SecretDetectionResult {
  hasSecrets: boolean;
  secrets: Array<{
    name: string;
    description: string;
    line: number;
    masked: string;
  }>;
}

/**
 * Create a content validator
 */
export function createContentValidator(config: Required<SafetyConfig>) {
  const { blockSecrets } = config;

  /**
   * Detect secrets in content
   */
  function detectSecrets(content: string): SecretDetectionResult {
    if (!blockSecrets) {
      return { hasSecrets: false, secrets: [] };
    }

    const secrets: SecretDetectionResult['secrets'] = [];
    const lines = content.split('\n');

    for (const pattern of SECRET_PATTERNS) {
      // Reset regex state
      pattern.pattern.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.pattern.exec(content)) !== null) {
        // Find line number
        const beforeMatch = content.slice(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

        // Mask the secret for reporting
        const matched = match[0];
        const masked =
          matched.length > 8
            ? matched.slice(0, 4) + '****' + matched.slice(-4)
            : '****';

        secrets.push({
          name: pattern.name,
          description: pattern.description,
          line: lineNumber,
          masked,
        });
      }
    }

    return {
      hasSecrets: secrets.length > 0,
      secrets,
    };
  }

  /**
   * Validate content and throw if secrets detected
   */
  function validateOrThrow(content: string, context?: string): void {
    const result = detectSecrets(content);
    if (result.hasSecrets) {
      const secretList = result.secrets
        .map((s) => `  - ${s.name} at line ${s.line}: ${s.masked}`)
        .join('\n');
      const contextInfo = context ? ` in ${context}` : '';
      throw new ContentError(
        `Potential secrets detected${contextInfo}:\n${secretList}\n\nIf this is intentional, use a secrets manager or environment variables instead.`
      );
    }
  }

  /**
   * Check if content contains secrets
   */
  function hasSecrets(content: string): boolean {
    return detectSecrets(content).hasSecrets;
  }

  return {
    detectSecrets,
    validateOrThrow,
    hasSecrets,
  };
}

export type ContentValidator = ReturnType<typeof createContentValidator>;
