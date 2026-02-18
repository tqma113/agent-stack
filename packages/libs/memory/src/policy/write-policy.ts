/**
 * @agent-stack/memory - Write Policy
 *
 * Decisions about when and what to write to memory.
 */

import type { MemoryEvent, ProfileKey, ProfileItem, Confidence } from '@agent-stack/memory-store';
import type {
  WriteContext,
  WriteDecision,
  WriteOperation,
  ConflictResolution,
  PolicyRule,
  ExtractedPreference,
} from './types.js';

/**
 * Write policy configuration
 */
export interface WritePolicyConfig {
  /** Minimum confidence to write to long-term memory */
  minConfidence: Confidence;
  /** Enable automatic summarization */
  autoSummarize: boolean;
  /** Summarize every N events */
  summarizeEveryNEvents: number;
  /** Summarize when tokens exceed threshold */
  summarizeTokenThreshold: number;
  /** Profile key whitelist (null = allow all) */
  profileKeyWhitelist: ProfileKey[] | null;
  /** Conflict resolution strategy */
  conflictStrategy: 'latest' | 'confidence' | 'explicit' | 'manual';
  /** Time decay factor (0-1, lower = faster decay) */
  timeDecayFactor: number;
  /** Stale threshold in milliseconds */
  staleThresholdMs: number;
}

/**
 * Allowed profile keys (whitelist)
 */
const PROFILE_KEYS = [
  'language',
  'tone',
  'format',
  'verbosity',
  'code_style',
  'timezone',
  'units',
  'restrictions',
  'expertise_level',
  'custom',
] as const;

/**
 * Default write policy configuration
 */
export const DEFAULT_WRITE_POLICY_CONFIG: WritePolicyConfig = {
  minConfidence: 0.5,
  autoSummarize: true,
  summarizeEveryNEvents: 20,
  summarizeTokenThreshold: 4000,
  profileKeyWhitelist: [...PROFILE_KEYS],
  conflictStrategy: 'latest',
  timeDecayFactor: 0.9,
  staleThresholdMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Write Policy instance interface
 */
export interface IWritePolicy {
  /** Get configuration */
  getConfig(): WritePolicyConfig;
  /** Update configuration */
  setConfig(config: Partial<WritePolicyConfig>): void;
  /** Decide whether to write */
  shouldWrite(context: WriteContext): WriteDecision;
  /** Build write operations */
  buildWriteOperations(context: WriteContext): WriteOperation[];
  /** Resolve conflict between values */
  resolveConflict(key: string, oldItem: ProfileItem | null, newItem: ProfileItem): ConflictResolution;
  /** Check if summarization should be triggered */
  shouldSummarize(eventCount: number, tokenCount: number): { should: boolean; reason: string };
  /** Extract preferences from content */
  extractPreferences(content: string): ExtractedPreference[];
  /** Calculate time decay factor */
  calculateDecay(timestamp: number): number;
  /** Check if item is stale */
  isStale(timestamp: number): boolean;
  /** Validate profile key */
  validateProfileKey(key: string): boolean;
  /** Add a custom rule */
  addRule(rule: PolicyRule): void;
  /** Remove a rule */
  removeRule(ruleId: string): void;
  /** Get all rules */
  getRules(): PolicyRule[];
}

/**
 * Check if event contains high-value tool result
 */
function isHighValueResult(event: MemoryEvent): boolean {
  const payload = event.payload;

  // Check for substantial content
  if (typeof payload.result === 'string' && payload.result.length > 200) {
    return true;
  }

  // Check for structured data
  if (payload.result && typeof payload.result === 'object') {
    return true;
  }

  return false;
}

/**
 * Check if event contains user preference indicators
 */
function containsPreference(event: MemoryEvent): boolean {
  if (event.type !== 'USER_MSG') return false;

  const content = String(event.payload.content || '').toLowerCase();

  // Common preference indicators
  const preferencePatterns = [
    /always use/i,
    /prefer\s+/i,
    /don'?t\s+(ever|never)/i,
    /from now on/i,
    /remember\s+(that|to)/i,
    /use\s+\w+\s+(format|style|language)/i,
    /i\s+(like|prefer|want|need)/i,
  ];

  return preferencePatterns.some((pattern) => pattern.test(content));
}

/**
 * Create a Write Policy instance
 */
export function createWritePolicy(
  initialConfig: Partial<WritePolicyConfig> = {}
): IWritePolicy {
  // Private state
  let config: WritePolicyConfig = { ...DEFAULT_WRITE_POLICY_CONFIG, ...initialConfig };
  const rules: Map<string, PolicyRule> = new Map();

  return {
    getConfig(): WritePolicyConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<WritePolicyConfig>): void {
      config = { ...config, ...newConfig };
    },

    shouldWrite(context: WriteContext): WriteDecision {
      const event = context.event;
      const operations: WriteOperation[] = [];
      let confidence = 0.5;
      let reason = '';

      // Check custom rules first
      for (const rule of rules.values()) {
        if (!rule.enabled) continue;
        if (rule.action.type !== 'write') continue;

        const matches = evaluateCondition(rule.condition, context);
        if (matches) {
          const layers = (rule.action.params.layers as string[]) || ['semantic'];
          for (const layer of layers) {
            operations.push(createWriteOperation(event, layer as WriteOperation['layer']));
          }
          confidence = 0.9;
          reason = `Rule "${rule.name}" matched`;
          break;
        }
      }

      // Default rules if no custom rule matched
      if (operations.length === 0) {
        // High-value event types
        if (event.type === 'DECISION') {
          operations.push(createWriteOperation(event, 'semantic'));
          confidence = 0.9;
          reason = 'Decisions are high-value for future reference';
        } else if (event.type === 'STATE_CHANGE') {
          operations.push(createWriteOperation(event, 'semantic'));
          confidence = 0.8;
          reason = 'State changes are important for context';
        } else if (event.type === 'TOOL_RESULT' && isHighValueResult(event)) {
          operations.push(createWriteOperation(event, 'semantic'));
          confidence = 0.7;
          reason = 'High-value tool result';
        }

        // Check for user preferences
        if (containsPreference(event)) {
          operations.push({
            layer: 'profile',
            type: 'create',
            payload: { event },
            priority: 10,
          });
          confidence = Math.max(confidence, 0.8);
          reason += '; Contains user preference';
        }
      }

      // Apply minimum confidence threshold
      const shouldWrite = operations.length > 0 && confidence >= config.minConfidence;

      return {
        shouldWrite,
        operations: shouldWrite ? operations : [],
        reason: reason || 'Does not meet write criteria',
        confidence,
      };
    },

    buildWriteOperations(context: WriteContext): WriteOperation[] {
      const decision = this.shouldWrite(context);
      return decision.operations;
    },

    resolveConflict(
      _key: string,
      oldItem: ProfileItem | null,
      newItem: ProfileItem
    ): ConflictResolution {
      if (!oldItem) {
        return {
          winner: newItem.value,
          reason: 'No existing value',
          needsReview: false,
        };
      }

      switch (config.conflictStrategy) {
        case 'latest':
          return {
            winner: newItem.value,
            reason: 'Using latest value (by timestamp)',
            needsReview: false,
          };

        case 'confidence':
          if (newItem.confidence > oldItem.confidence) {
            return {
              winner: newItem.value,
              reason: `Higher confidence: ${newItem.confidence} > ${oldItem.confidence}`,
              needsReview: false,
            };
          }
          return {
            winner: oldItem.value,
            reason: `Lower confidence: ${newItem.confidence} <= ${oldItem.confidence}`,
            needsReview: false,
          };

        case 'explicit':
          if (newItem.explicit && !oldItem.explicit) {
            return {
              winner: newItem.value,
              reason: 'New value is explicit user preference',
              needsReview: false,
            };
          }
          if (!newItem.explicit && oldItem.explicit) {
            return {
              winner: oldItem.value,
              reason: 'Keeping explicit user preference',
              needsReview: false,
            };
          }
          return {
            winner: newItem.value,
            reason: 'Both same explicit status, using latest',
            needsReview: false,
          };

        case 'manual':
          return {
            winner: oldItem.value,
            reason: 'Manual review required for conflict',
            needsReview: true,
          };

        default:
          return {
            winner: newItem.value,
            reason: 'Default: using new value',
            needsReview: false,
          };
      }
    },

    shouldSummarize(eventCount: number, tokenCount: number): { should: boolean; reason: string } {
      if (!config.autoSummarize) {
        return { should: false, reason: 'Auto-summarize disabled' };
      }

      if (eventCount >= config.summarizeEveryNEvents) {
        return {
          should: true,
          reason: `Event count threshold reached: ${eventCount} >= ${config.summarizeEveryNEvents}`,
        };
      }

      if (tokenCount >= config.summarizeTokenThreshold) {
        return {
          should: true,
          reason: `Token threshold reached: ${tokenCount} >= ${config.summarizeTokenThreshold}`,
        };
      }

      return { should: false, reason: 'Thresholds not met' };
    },

    extractPreferences(content: string): ExtractedPreference[] {
      const preferences: ExtractedPreference[] = [];
      const lowerContent = content.toLowerCase();

      // Language preferences
      const languagePatterns = [
        { pattern: /(?:use|speak|respond in|reply in)\s+(chinese|中文)/i, value: 'Chinese' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(english)/i, value: 'English' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(japanese|日本語)/i, value: 'Japanese' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(korean|한국어)/i, value: 'Korean' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(spanish|español)/i, value: 'Spanish' },
      ];

      for (const { pattern, value } of languagePatterns) {
        if (pattern.test(lowerContent)) {
          preferences.push({ key: 'language' as ProfileKey, value, confidence: 0.9 });
        }
      }

      // Format preferences
      const formatPatterns = [
        { pattern: /(?:use|prefer)\s+markdown/i, value: 'markdown' },
        { pattern: /(?:use|prefer)\s+plain\s*text/i, value: 'plain' },
        { pattern: /(?:use|prefer)\s+json/i, value: 'json' },
      ];

      for (const { pattern, value } of formatPatterns) {
        if (pattern.test(lowerContent)) {
          preferences.push({ key: 'format' as ProfileKey, value, confidence: 0.85 });
        }
      }

      // Verbosity preferences
      if (/(?:be|more)\s+(brief|concise|short)/i.test(lowerContent)) {
        preferences.push({ key: 'verbosity' as ProfileKey, value: 'concise', confidence: 0.8 });
      } else if (/(?:be|more)\s+(detailed|verbose|thorough)/i.test(lowerContent)) {
        preferences.push({ key: 'verbosity' as ProfileKey, value: 'detailed', confidence: 0.8 });
      }

      // Tone preferences
      if (/(?:be|more)\s+(formal|professional)/i.test(lowerContent)) {
        preferences.push({ key: 'tone' as ProfileKey, value: 'formal', confidence: 0.75 });
      } else if (/(?:be|more)\s+(casual|friendly|informal)/i.test(lowerContent)) {
        preferences.push({ key: 'tone' as ProfileKey, value: 'casual', confidence: 0.75 });
      }

      return preferences;
    },

    calculateDecay(timestamp: number): number {
      const ageMs = Date.now() - timestamp;
      const ageDays = ageMs / (24 * 60 * 60 * 1000);
      return Math.pow(config.timeDecayFactor, ageDays);
    },

    isStale(timestamp: number): boolean {
      return Date.now() - timestamp > config.staleThresholdMs;
    },

    validateProfileKey(key: string): boolean {
      if (config.profileKeyWhitelist === null) {
        return true;
      }
      return config.profileKeyWhitelist.includes(key as ProfileKey);
    },

    addRule(rule: PolicyRule): void {
      rules.set(rule.id, rule);
    },

    removeRule(ruleId: string): void {
      rules.delete(ruleId);
    },

    getRules(): PolicyRule[] {
      return Array.from(rules.values()).sort((a, b) => b.priority - a.priority);
    },
  };
}

/**
 * Create a write operation from event
 */
function createWriteOperation(event: MemoryEvent, layer: WriteOperation['layer']): WriteOperation {
  return {
    layer,
    type: 'create',
    payload: {
      text: event.summary,
      tags: event.tags,
      sourceEventId: event.id,
      sourceType: event.type,
      sessionId: event.sessionId,
    },
    priority: layer === 'profile' ? 10 : 5,
  };
}

/**
 * Evaluate a rule condition against context
 */
function evaluateCondition(condition: PolicyRule['condition'], context: WriteContext): boolean {
  const event = context.event;

  switch (condition.type) {
    case 'event_type': {
      const types = condition.params.types as string[];
      return types.includes(event.type);
    }

    case 'content_match': {
      const patterns = condition.params.patterns as string[];
      const content = String(event.payload.content || event.summary).toLowerCase();
      return patterns.some((p) => content.includes(p.toLowerCase()));
    }

    case 'token_threshold': {
      const threshold = condition.params.threshold as number;
      return (context.sessionTokenCount || 0) >= threshold;
    }

    case 'custom': {
      const fn = condition.params.fn as string;
      if (fn === 'isDecision') return event.type === 'DECISION';
      if (fn === 'hasPreference') return containsPreference(event);
      return false;
    }

    default:
      return false;
  }
}
