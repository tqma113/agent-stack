/**
 * @agent-stack/memory - Retrieval Policy
 *
 * Decisions about when and what to retrieve from memory.
 */

import type {
  RetrievalContext,
  RetrievalDecision,
  MemorySearchParams,
  PolicyRule,
} from './types.js';

/**
 * Retrieval policy configuration
 */
export interface RetrievalPolicyConfig {
  /** Maximum recent events to retrieve */
  maxRecentEvents: number;
  /** Maximum semantic chunks to retrieve */
  maxSemanticChunks: number;
  /** Time window for recent events (ms) */
  recentEventsWindowMs: number;
  /** Enable semantic search */
  enableSemanticSearch: boolean;
  /** Enable FTS search */
  enableFtsSearch: boolean;
  /** Minimum query length for semantic search */
  minQueryLength: number;
  /** Auto-retrieve on user message */
  autoRetrieveOnUserMessage: boolean;
}

/**
 * Default retrieval policy configuration
 */
export const DEFAULT_RETRIEVAL_CONFIG: RetrievalPolicyConfig = {
  maxRecentEvents: 10,
  maxSemanticChunks: 5,
  recentEventsWindowMs: 30 * 60 * 1000, // 30 minutes
  enableSemanticSearch: true,
  enableFtsSearch: true,
  minQueryLength: 3,
  autoRetrieveOnUserMessage: true,
};

/**
 * Retrieval Policy instance interface
 */
export interface IRetrievalPolicy {
  /** Get configuration */
  getConfig(): RetrievalPolicyConfig;
  /** Update configuration */
  setConfig(config: Partial<RetrievalPolicyConfig>): void;
  /** Decide whether to retrieve */
  shouldRetrieve(context: RetrievalContext): RetrievalDecision;
  /** Build search parameters */
  buildSearchParams(context: RetrievalContext): MemorySearchParams;
  /** Add a custom rule */
  addRule(rule: PolicyRule): void;
  /** Remove a rule */
  removeRule(ruleId: string): void;
  /** Get all rules */
  getRules(): PolicyRule[];
}

/**
 * Check if query is substantial enough for semantic search
 */
function isSubstantialQuery(query: string | undefined, minLength: number): boolean {
  if (!query) return false;
  const cleaned = query.trim();
  return cleaned.length >= minLength && cleaned.split(/\s+/).length >= 1;
}

/**
 * Determine which layers to retrieve based on context
 */
function determineLayers(
  context: RetrievalContext,
  config: RetrievalPolicyConfig
): RetrievalDecision['layers'] {
  const layers: RetrievalDecision['layers'] = ['profile'];

  // Always include profile and task state if there's an active task
  if (context.taskId) {
    layers.push('taskState');
  }

  // Include events if session is active
  if (context.sessionId) {
    layers.push('events');
    layers.push('summary');
  }

  // Include semantic only if there's a query
  if (context.userQuery && config.enableSemanticSearch) {
    layers.push('semantic');
  }

  return layers;
}

/**
 * Create a Retrieval Policy instance
 */
export function createRetrievalPolicy(
  initialConfig: Partial<RetrievalPolicyConfig> = {}
): IRetrievalPolicy {
  // Private state
  let config: RetrievalPolicyConfig = { ...DEFAULT_RETRIEVAL_CONFIG, ...initialConfig };
  const rules: Map<string, PolicyRule> = new Map();

  return {
    getConfig(): RetrievalPolicyConfig {
      return { ...config };
    },

    setConfig(newConfig: Partial<RetrievalPolicyConfig>): void {
      config = { ...config, ...newConfig };
    },

    shouldRetrieve(context: RetrievalContext): RetrievalDecision {
      // Check custom rules first
      for (const rule of rules.values()) {
        if (!rule.enabled) continue;
        if (rule.action.type !== 'retrieve') continue;

        // Evaluate condition
        const matches = evaluateCondition(rule.condition, context);
        if (matches) {
          return {
            shouldRetrieve: true,
            reason: `Rule "${rule.name}" matched`,
            layers: determineLayers(context, config),
            priority: 'high',
          };
        }
      }

      // Default: retrieve if there's a user query
      if (context.userQuery && config.autoRetrieveOnUserMessage) {
        return {
          shouldRetrieve: true,
          reason: 'User message received',
          layers: determineLayers(context, config),
          priority: 'normal',
        };
      }

      // Retrieve on new session
      if (context.sessionEventCount === 0) {
        return {
          shouldRetrieve: true,
          reason: 'New session started',
          layers: ['profile'],
          priority: 'low',
        };
      }

      return {
        shouldRetrieve: false,
        reason: 'No trigger conditions met',
        layers: [],
        priority: 'low',
      };
    },

    buildSearchParams(context: RetrievalContext): MemorySearchParams {
      const hasQuery = isSubstantialQuery(context.userQuery, config.minQueryLength);

      return {
        query: hasQuery ? context.userQuery : undefined,
        sessionId: context.sessionId,
        taskId: context.taskId,
        limits: {
          events: config.maxRecentEvents,
          semantic: config.maxSemanticChunks,
          summaries: 1,
        },
        eventsWindowMs: config.recentEventsWindowMs,
        useVectorSearch: config.enableSemanticSearch && hasQuery,
      };
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
 * Evaluate a rule condition against context
 */
function evaluateCondition(
  condition: PolicyRule['condition'],
  context: RetrievalContext
): boolean {
  switch (condition.type) {
    case 'custom': {
      const fn = condition.params.fn as string;
      if (fn === 'hasUserQuery') {
        return !!context.userQuery;
      }
      if (fn === 'hasTask') {
        return !!context.taskId;
      }
      if (fn === 'newSession') {
        return context.sessionEventCount === 0;
      }
      return false;
    }

    case 'time_elapsed': {
      const threshold = condition.params.threshold as number;
      return (context.timeSinceLastRetrieval || 0) >= threshold;
    }

    default:
      return false;
  }
}
