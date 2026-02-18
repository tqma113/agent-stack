/**
 * @ai-stack/memory - Write Policy
 *
 * Rules and policies for memory write operations.
 */

import type {
  MemoryEvent,
  ProfileItem,
  Confidence,
  ProfileKey,
} from '@ai-stack/memory-store-sqlite';
import type { WritePolicyConfig } from './types.js';
import { ProfileKeyNotAllowedError } from './errors.js';

/**
 * Write decision result
 */
export interface WriteDecision {
  /** Should write to long-term storage */
  shouldWrite: boolean;

  /** Target layer(s) for the write */
  targetLayers: Array<'profile' | 'semantic' | 'summary'>;

  /** Confidence in the decision */
  confidence: Confidence;

  /** Reason for the decision */
  reason: string;

  /** Suggested TTL (if applicable) */
  ttlMs?: number;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Winning value */
  winner: unknown;

  /** Reason for selection */
  reason: string;

  /** Should mark as conflict for user review */
  needsReview: boolean;
}

/**
 * Write Policy Engine instance interface
 */
export interface IWritePolicyEngine {
  /** Get current config */
  getConfig(): WritePolicyConfig;

  /** Update config */
  setConfig(config: Partial<WritePolicyConfig>): void;

  /** Validate profile key against whitelist */
  validateProfileKey(key: string): void;

  /** Decide whether to write an event to long-term memory */
  decideWrite(event: MemoryEvent): WriteDecision;

  /** Resolve conflict between old and new profile values */
  resolveConflict(
    key: string,
    oldItem: ProfileItem | null,
    newItem: ProfileItem
  ): ConflictResolution;

  /** Calculate time decay factor for an item */
  calculateDecay(timestamp: number): number;

  /** Check if an item is stale */
  isStale(timestamp: number): boolean;

  /** Check if summarization should be triggered */
  shouldSummarize(eventCount: number, tokenCount: number): {
    should: boolean;
    reason: string;
  };

  /** Extract preferences from user message */
  extractPreferences(content: string): Array<{ key: ProfileKey; value: unknown; confidence: number }>;
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
 * Create a Write Policy Engine instance
 */
export function createWritePolicyEngine(initialConfig: WritePolicyConfig): IWritePolicyEngine {
  // Private state via closure
  let config = { ...initialConfig };

  // Return the instance object
  return {
    getConfig(): WritePolicyConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<WritePolicyConfig>): void {
      config = { ...config, ...newConfig };
    },

    validateProfileKey(key: string): void {
      if (config.profileKeyWhitelist === null) {
        return; // All keys allowed
      }

      if (!config.profileKeyWhitelist.includes(key as ProfileKey)) {
        throw new ProfileKeyNotAllowedError(key, config.profileKeyWhitelist);
      }
    },

    decideWrite(event: MemoryEvent): WriteDecision {
      const targetLayers: WriteDecision['targetLayers'] = [];
      let confidence = 0.5;
      let reason = '';

      // High-value event types always get written
      if (event.type === 'DECISION') {
        targetLayers.push('semantic', 'summary');
        confidence = 0.9;
        reason = 'Decisions are high-value for future reference';
      } else if (event.type === 'STATE_CHANGE') {
        targetLayers.push('semantic');
        confidence = 0.8;
        reason = 'State changes are important for understanding context';
      } else if (event.type === 'TOOL_RESULT' && isHighValueResult(event)) {
        targetLayers.push('semantic');
        confidence = 0.7;
        reason = 'High-value tool result';
      }

      // Check for user preferences in content
      if (containsPreference(event)) {
        targetLayers.push('profile');
        confidence = Math.max(confidence, 0.8);
        reason += '; Contains user preference';
      }

      // Apply minimum confidence threshold
      const shouldWrite = targetLayers.length > 0 && confidence >= config.minConfidence;

      return {
        shouldWrite,
        targetLayers: shouldWrite ? targetLayers : [],
        confidence,
        reason: reason || 'Does not meet write criteria',
      };
    },

    resolveConflict(
      key: string,
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
          // Both explicit or both inferred - use latest
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

    calculateDecay(timestamp: number): number {
      const ageMs = Date.now() - timestamp;
      const ageDays = ageMs / (24 * 60 * 60 * 1000);

      // Exponential decay: factor ^ days
      return Math.pow(config.timeDecayFactor, ageDays);
    },

    isStale(timestamp: number): boolean {
      return Date.now() - timestamp > config.staleThresholdMs;
    },

    shouldSummarize(eventCount: number, tokenCount: number): {
      should: boolean;
      reason: string;
    } {
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

    extractPreferences(content: string): Array<{ key: ProfileKey; value: unknown; confidence: number }> {
      const preferences: Array<{ key: ProfileKey; value: unknown; confidence: number }> = [];
      const lowerContent = content.toLowerCase();

      // Language preferences
      const languagePatterns = [
        { pattern: /(?:use|speak|respond in|reply in)\s+(chinese|中文)/i, value: 'Chinese' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(english)/i, value: 'English' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(japanese|日本語)/i, value: 'Japanese' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(korean|한국어)/i, value: 'Korean' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(spanish|español)/i, value: 'Spanish' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(french|français)/i, value: 'French' },
        { pattern: /(?:use|speak|respond in|reply in)\s+(german|deutsch)/i, value: 'German' },
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
        { pattern: /(?:format|output)\s+(?:as|in)\s+table/i, value: 'table' },
      ];

      for (const { pattern, value } of formatPatterns) {
        if (pattern.test(lowerContent)) {
          preferences.push({ key: 'response_format' as ProfileKey, value, confidence: 0.85 });
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

      // Code style preferences
      if (/(?:use|prefer)\s+typescript/i.test(lowerContent)) {
        preferences.push({ key: 'code_style' as ProfileKey, value: { preferTypeScript: true }, confidence: 0.85 });
      }
      if (/include\s+(?:code\s+)?comments/i.test(lowerContent)) {
        preferences.push({ key: 'code_style' as ProfileKey, value: { includeComments: true }, confidence: 0.7 });
      }
      if (/no\s+(?:code\s+)?comments/i.test(lowerContent)) {
        preferences.push({ key: 'code_style' as ProfileKey, value: { includeComments: false }, confidence: 0.7 });
      }

      return preferences;
    },
  };
}

