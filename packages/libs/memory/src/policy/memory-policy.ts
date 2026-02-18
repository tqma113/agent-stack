/**
 * @ai-stack/memory - Memory Policy
 *
 * Main orchestrator that combines retrieval, write, and budget policies.
 */

import type { ProfileItem, MemoryEvent } from '@ai-stack/memory-store-sqlite';
import type {
  IMemoryPolicy,
  RetrievalContext,
  RetrievalDecision,
  MemorySearchParams,
  WriteContext,
  WriteDecision,
  WriteOperation,
  ConflictResolution,
  TokenBudget,
  BudgetAllocation,
  PolicyRule,
} from './types.js';
import {
  createRetrievalPolicy,
  type RetrievalPolicyConfig,
  type IRetrievalPolicy,
} from './retrieval-policy.js';
import {
  createWritePolicy,
  type WritePolicyConfig,
  type IWritePolicy,
} from './write-policy.js';
import {
  createBudgetPolicy,
  type TokenEstimationOptions,
  type IBudgetPolicy,
} from './budget-policy.js';
import { getDefaultRules } from '../rules/default-rules.js';

/**
 * Memory Policy configuration
 */
export interface MemoryPolicyConfig {
  /** Retrieval policy configuration */
  retrieval?: Partial<RetrievalPolicyConfig>;
  /** Write policy configuration */
  write?: Partial<WritePolicyConfig>;
  /** Token budget configuration */
  budget?: Partial<TokenBudget>;
  /** Token estimation options */
  tokenEstimation?: TokenEstimationOptions;
  /** Load default rules */
  loadDefaultRules?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Memory Policy instance interface
 */
export interface MemoryPolicyInstance extends IMemoryPolicy {
  /** Get retrieval policy */
  getRetrievalPolicy(): IRetrievalPolicy;
  /** Get write policy */
  getWritePolicy(): IWritePolicy;
  /** Get budget policy */
  getBudgetPolicy(): IBudgetPolicy;
  /** Get configuration */
  getConfig(): MemoryPolicyConfig;
}

/**
 * Create a Memory Policy instance
 */
export function createMemoryPolicy(config: MemoryPolicyConfig = {}): MemoryPolicyInstance {
  // Initialize sub-policies
  const retrievalPolicy = createRetrievalPolicy(config.retrieval);
  const writePolicy = createWritePolicy(config.write);
  const budgetPolicy = createBudgetPolicy(config.budget, config.tokenEstimation);

  // Load default rules if enabled
  if (config.loadDefaultRules !== false) {
    const defaultRules = getDefaultRules();
    for (const rule of defaultRules) {
      if (rule.action.type === 'retrieve') {
        retrievalPolicy.addRule(rule);
      } else {
        writePolicy.addRule(rule);
      }
    }
  }

  const debug = config.debug ?? false;

  return {
    // ==========================================================================
    // Retrieval decisions
    // ==========================================================================

    shouldRetrieve(context: RetrievalContext): RetrievalDecision {
      const decision = retrievalPolicy.shouldRetrieve(context);

      if (debug) {
        console.log('[MemoryPolicy] Retrieval decision:', {
          shouldRetrieve: decision.shouldRetrieve,
          reason: decision.reason,
          layers: decision.layers,
        });
      }

      return decision;
    },

    buildSearchParams(context: RetrievalContext): MemorySearchParams {
      return retrievalPolicy.buildSearchParams(context);
    },

    // ==========================================================================
    // Write decisions
    // ==========================================================================

    shouldWrite(context: WriteContext): WriteDecision {
      const decision = writePolicy.shouldWrite(context);

      if (debug) {
        console.log('[MemoryPolicy] Write decision:', {
          shouldWrite: decision.shouldWrite,
          reason: decision.reason,
          operations: decision.operations.length,
        });
      }

      return decision;
    },

    buildWriteOperations(context: WriteContext): WriteOperation[] {
      return writePolicy.buildWriteOperations(context);
    },

    // ==========================================================================
    // Conflict resolution
    // ==========================================================================

    resolveConflict(key: string, existing: unknown, incoming: unknown): ConflictResolution {
      // Convert to ProfileItem format for the write policy
      const oldItem = existing
        ? ({
            key,
            value: existing,
            updatedAt: 0,
            confidence: 0.5,
            explicit: false,
          } as ProfileItem)
        : null;

      const newItem: ProfileItem = {
        key,
        value: incoming,
        updatedAt: Date.now(),
        confidence: 0.8,
        explicit: false,
      };

      return writePolicy.resolveConflict(key, oldItem, newItem);
    },

    // ==========================================================================
    // Token budget
    // ==========================================================================

    allocateBudget(available: TokenBudget): BudgetAllocation {
      return budgetPolicy.allocateBudget({
        profileTokens: available.profile,
        taskStateTokens: available.taskState,
        eventsTokens: available.recentEvents,
        chunksTokens: available.semanticChunks,
        summaryTokens: available.summary,
      });
    },

    // ==========================================================================
    // Rule management
    // ==========================================================================

    addRule(rule: PolicyRule): void {
      if (rule.action.type === 'retrieve') {
        retrievalPolicy.addRule(rule);
      } else {
        writePolicy.addRule(rule);
      }
    },

    removeRule(ruleId: string): void {
      retrievalPolicy.removeRule(ruleId);
      writePolicy.removeRule(ruleId);
    },

    getRules(): PolicyRule[] {
      return [...retrievalPolicy.getRules(), ...writePolicy.getRules()].sort(
        (a, b) => b.priority - a.priority
      );
    },

    enableRule(ruleId: string): void {
      // Try both policies
      const retrievalRules = retrievalPolicy.getRules();
      const writeRules = writePolicy.getRules();

      for (const rule of retrievalRules) {
        if (rule.id === ruleId) {
          rule.enabled = true;
          retrievalPolicy.addRule(rule);
          return;
        }
      }

      for (const rule of writeRules) {
        if (rule.id === ruleId) {
          rule.enabled = true;
          writePolicy.addRule(rule);
          return;
        }
      }
    },

    disableRule(ruleId: string): void {
      // Try both policies
      const retrievalRules = retrievalPolicy.getRules();
      const writeRules = writePolicy.getRules();

      for (const rule of retrievalRules) {
        if (rule.id === ruleId) {
          rule.enabled = false;
          retrievalPolicy.addRule(rule);
          return;
        }
      }

      for (const rule of writeRules) {
        if (rule.id === ruleId) {
          rule.enabled = false;
          writePolicy.addRule(rule);
          return;
        }
      }
    },

    // ==========================================================================
    // Sub-policy access
    // ==========================================================================

    getRetrievalPolicy(): IRetrievalPolicy {
      return retrievalPolicy;
    },

    getWritePolicy(): IWritePolicy {
      return writePolicy;
    },

    getBudgetPolicy(): IBudgetPolicy {
      return budgetPolicy;
    },

    getConfig(): MemoryPolicyConfig {
      return {
        retrieval: retrievalPolicy.getConfig(),
        write: writePolicy.getConfig(),
        budget: budgetPolicy.getBudget(),
        debug,
      };
    },
  };
}
