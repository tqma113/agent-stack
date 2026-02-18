/**
 * @agent-stack/memory - Injector
 *
 * Template-based memory injection into prompts.
 */

import type {
  ProfileItem,
  TaskState,
  MemoryEvent,
  Summary,
  SemanticSearchResult,
} from '@agent-stack/memory-store';
import type { MemoryBundle, TokenBudget } from './types.js';

/**
 * Injection options
 */
export interface InjectionOptions {
  /** Include profile section */
  includeProfile?: boolean;

  /** Include task state section */
  includeTaskState?: boolean;

  /** Include recent events section */
  includeEvents?: boolean;

  /** Include summary section */
  includeSummary?: boolean;

  /** Include semantic chunks section */
  includeChunks?: boolean;

  /** Include warnings section */
  includeWarnings?: boolean;

  /** Custom template */
  template?: string;

  /** Token budget for injection */
  budget?: Partial<TokenBudget>;
}

/**
 * Default injection template
 */
export const DEFAULT_INJECTION_TEMPLATE = `
{{#if hasProfile}}
## User Preferences (Hard Constraints)
{{profile}}
{{/if}}

{{#if hasTaskState}}
## Current Task State
{{taskState}}
{{/if}}

{{#if hasSummary}}
## Conversation Summary
{{summary}}
{{/if}}

{{#if hasEvents}}
## Recent Events
{{events}}
{{/if}}

{{#if hasChunks}}
## Related Information
{{chunks}}
{{/if}}

{{#if hasWarnings}}
## Warnings
{{warnings}}
{{/if}}
`.trim();

/**
 * Memory Injector instance interface
 */
export interface IMemoryInjector {
  /** Inject memory bundle into prompt format */
  inject(bundle: MemoryBundle, options?: InjectionOptions): string;
}

/**
 * Truncate text
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format profile items
 */
function formatProfile(items: ProfileItem[]): string {
  return items
    .map((item) => {
      const confidence = item.explicit ? 'explicit' : `confidence: ${item.confidence.toFixed(2)}`;
      const value = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
      return `- **${item.key}**: ${value} (${confidence})`;
    })
    .join('\n');
}

/**
 * Format task state
 */
function formatTaskState(state: TaskState): string {
  const lines: string[] = [];

  lines.push(`**Goal**: ${state.goal}`);
  lines.push(`**Status**: ${state.status}`);

  if (state.constraints.length > 0) {
    lines.push('**Constraints**:');
    for (const c of state.constraints) {
      lines.push(`  - [${c.type}] ${c.description}`);
    }
  }

  if (state.plan.length > 0) {
    lines.push('**Plan**:');
    for (const step of state.plan) {
      const status = state.done.includes(step.id) ? '✓' : step.status === 'in_progress' ? '→' : '○';
      lines.push(`  ${status} ${step.description}`);
    }
  }

  if (state.nextAction) {
    lines.push(`**Next Action**: ${state.nextAction}`);
  }

  return lines.join('\n');
}

/**
 * Format summary
 */
function formatSummary(summary: Summary): string {
  const lines: string[] = [];

  lines.push(summary.short);

  if (summary.bullets.length > 0) {
    lines.push('');
    lines.push('Key points:');
    for (const bullet of summary.bullets) {
      lines.push(`- ${bullet}`);
    }
  }

  if (summary.decisions.length > 0) {
    lines.push('');
    lines.push('Decisions made:');
    for (const decision of summary.decisions) {
      lines.push(`- ${decision.description}`);
    }
  }

  if (summary.todos.filter((t) => !t.completed).length > 0) {
    lines.push('');
    lines.push('Outstanding items:');
    for (const todo of summary.todos.filter((t) => !t.completed)) {
      lines.push(`- ${todo.description}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format recent events
 */
function formatEvents(events: MemoryEvent[]): string {
  return events
    .map((event) => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      return `- [${time}] [${event.type}] ${event.summary}`;
    })
    .join('\n');
}

/**
 * Format semantic chunks
 */
function formatChunks(results: SemanticSearchResult[]): string {
  return results
    .map((result, index) => {
      const source = result.chunk.sourceType || 'unknown';
      const score = result.score.toFixed(2);
      const text = truncate(result.chunk.text, 200);
      return `${index + 1}. [${source}] (score: ${score})\n   ${text}`;
    })
    .join('\n\n');
}

/**
 * Format warnings
 */
function formatWarnings(warnings: MemoryBundle['warnings']): string {
  return warnings
    .map((warning) => `[${warning.type}] ${warning.message}`)
    .join('\n');
}

/**
 * Simple template renderer
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Handle conditionals {{#if key}}...{{/if}}
  const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
  result = result.replace(conditionalRegex, (_, key, content) => {
    return data[key] ? content : '';
  });

  // Handle variables {{key}}
  const variableRegex = /\{\{(\w+)\}\}/g;
  result = result.replace(variableRegex, (_, key) => {
    const value = data[key];
    return value !== undefined ? String(value) : '';
  });

  // Clean up extra newlines
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}

/**
 * Create a Memory Injector instance
 */
export function createMemoryInjector(template: string = DEFAULT_INJECTION_TEMPLATE): IMemoryInjector {
  // Private state via closure
  const defaultTemplate = template;

  // Return the instance object
  return {
    inject(bundle: MemoryBundle, options: InjectionOptions = {}): string {
      const {
        includeProfile = true,
        includeTaskState = true,
        includeEvents = true,
        includeSummary = true,
        includeChunks = true,
        includeWarnings = true,
      } = options;

      const sections: Record<string, string> = {};
      const flags: Record<string, boolean> = {};

      // Profile section
      if (includeProfile && bundle.profile.length > 0) {
        sections.profile = formatProfile(bundle.profile);
        flags.hasProfile = true;
      }

      // Task state section
      if (includeTaskState && bundle.taskState) {
        sections.taskState = formatTaskState(bundle.taskState);
        flags.hasTaskState = true;
      }

      // Summary section
      if (includeSummary && bundle.summary) {
        sections.summary = formatSummary(bundle.summary);
        flags.hasSummary = true;
      }

      // Recent events section
      if (includeEvents && bundle.recentEvents.length > 0) {
        sections.events = formatEvents(bundle.recentEvents);
        flags.hasEvents = true;
      }

      // Semantic chunks section
      if (includeChunks && bundle.retrievedChunks.length > 0) {
        sections.chunks = formatChunks(bundle.retrievedChunks);
        flags.hasChunks = true;
      }

      // Warnings section
      if (includeWarnings && bundle.warnings.length > 0) {
        sections.warnings = formatWarnings(bundle.warnings);
        flags.hasWarnings = true;
      }

      return renderTemplate(options.template || defaultTemplate, {
        ...sections,
        ...flags,
      });
    },
  };
}

