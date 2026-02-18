/**
 * @ai-stack/memory - Default Rules
 *
 * Pre-configured rules for common memory operations.
 */

import type { PolicyRule } from '../policy/types.js';
import { createRule, conditions, actions } from './rule-engine.js';

/**
 * Default retrieval rules
 */
export const DEFAULT_RETRIEVAL_RULES: PolicyRule[] = [
  createRule(
    'retrieve-on-query',
    'Retrieve on user query',
    conditions.custom('hasUserQuery'),
    actions.retrieve('profile', 'taskState', 'events', 'semantic', 'summary'),
    { priority: 100 }
  ),

  createRule(
    'retrieve-on-new-session',
    'Retrieve profile on new session',
    conditions.custom('newSession'),
    actions.retrieve('profile'),
    { priority: 50 }
  ),

  createRule(
    'retrieve-on-task-active',
    'Retrieve task state when task is active',
    conditions.custom('hasTask'),
    actions.retrieve('taskState'),
    { priority: 80 }
  ),
];

/**
 * Default write rules
 */
export const DEFAULT_WRITE_RULES: PolicyRule[] = [
  createRule(
    'write-decisions',
    'Write decisions to semantic memory',
    conditions.eventType('DECISION'),
    actions.write('semantic', 'summary'),
    { priority: 100 }
  ),

  createRule(
    'write-state-changes',
    'Write state changes to semantic memory',
    conditions.eventType('STATE_CHANGE'),
    actions.write('semantic'),
    { priority: 90 }
  ),

  createRule(
    'write-preferences',
    'Extract and write user preferences',
    conditions.contentMatch('always use', 'prefer', 'from now on', 'remember to'),
    actions.write('profile'),
    { priority: 80 }
  ),

  createRule(
    'auto-summarize',
    'Trigger summarization on token threshold',
    conditions.tokenThreshold(4000),
    actions.summarize(),
    { priority: 70 }
  ),

  createRule(
    'write-important-results',
    'Write important tool results',
    conditions.eventType('TOOL_RESULT'),
    actions.write('semantic'),
    { priority: 60 }
  ),
];

/**
 * Get all default rules
 */
export function getDefaultRules(): PolicyRule[] {
  return [...DEFAULT_RETRIEVAL_RULES, ...DEFAULT_WRITE_RULES];
}

/**
 * Get retrieval rules only
 */
export function getDefaultRetrievalRules(): PolicyRule[] {
  return [...DEFAULT_RETRIEVAL_RULES];
}

/**
 * Get write rules only
 */
export function getDefaultWriteRules(): PolicyRule[] {
  return [...DEFAULT_WRITE_RULES];
}

/**
 * Create custom write rule for specific event types
 */
export function createEventTypeWriteRule(
  id: string,
  name: string,
  eventTypes: string[],
  layers: string[],
  priority = 50
): PolicyRule {
  return createRule(id, name, conditions.eventType(...eventTypes), actions.write(...layers), {
    priority,
  });
}

/**
 * Create custom content pattern rule
 */
export function createContentPatternRule(
  id: string,
  name: string,
  patterns: string[],
  actionType: 'write' | 'extract_profile' | 'summarize',
  priority = 50
): PolicyRule {
  const action =
    actionType === 'write'
      ? actions.write('profile')
      : actionType === 'extract_profile'
        ? actions.extractProfile()
        : actions.summarize();

  return createRule(id, name, conditions.contentMatch(...patterns), action, { priority });
}
