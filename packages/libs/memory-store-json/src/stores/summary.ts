/**
 * @agent-stack/memory-store-json - Summary Store
 *
 * JSON/Markdown-based summary storage for compressed memory.
 */

import * as path from 'node:path';
import type {
  ISummaryStore,
  Summary,
  SummaryInput,
  UUID,
  Timestamp,
} from '@agent-stack/memory-store-sqlite';
import {
  readJsonFile,
  writeJsonFile,
  writeMarkdownFile,
  ensureDir,
  deleteDir,
  listDirs,
  generateId,
  now,
} from '../utils/file-ops.js';

/**
 * Summaries data structure
 */
interface SummariesData {
  summaries: Summary[];
}

/**
 * JSON Summary Store configuration
 */
export interface JsonSummaryStoreConfig {
  basePath: string;
}

/**
 * Convert summary to human-readable Markdown
 */
function summaryToMarkdown(summary: Summary): string {
  const lines: string[] = [];

  lines.push(`# Summary`);
  lines.push('');
  lines.push(`**Date:** ${new Date(summary.timestamp).toISOString()}`);
  lines.push(`**Session:** ${summary.sessionId}`);
  lines.push('');
  lines.push(`## Overview`);
  lines.push('');
  lines.push(summary.short);
  lines.push('');

  if (summary.bullets.length > 0) {
    lines.push(`## Key Points`);
    lines.push('');
    for (const bullet of summary.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push('');
  }

  if (summary.decisions.length > 0) {
    lines.push(`## Decisions`);
    lines.push('');
    for (const decision of summary.decisions) {
      lines.push(`- **${decision.description}**`);
      if (decision.reasoning) {
        lines.push(`  - Reasoning: ${decision.reasoning}`);
      }
    }
    lines.push('');
  }

  if (summary.todos.length > 0) {
    lines.push(`## Todos`);
    lines.push('');
    for (const todo of summary.todos) {
      const checkbox = todo.completed ? '[x]' : '[ ]';
      const priority = todo.priority ? ` (${todo.priority})` : '';
      lines.push(`- ${checkbox} ${todo.description}${priority}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Create a JSON Summary Store instance
 */
export function createJsonSummaryStore(config: JsonSummaryStoreConfig): ISummaryStore {
  const summariesDir = path.join(config.basePath, 'summaries');
  let initialized = false;

  /**
   * Get summaries path for a session
   */
  function getSummariesPath(sessionId: string): string {
    return path.join(summariesDir, sessionId, 'summaries.json');
  }

  /**
   * Get latest markdown path for a session
   */
  function getLatestMdPath(sessionId: string): string {
    return path.join(summariesDir, sessionId, 'latest.md');
  }

  /**
   * Read summaries for a session
   */
  function readSummaries(sessionId: string): Summary[] {
    const data = readJsonFile<SummariesData>(getSummariesPath(sessionId), { summaries: [] });
    return data.summaries;
  }

  /**
   * Write summaries for a session
   */
  function writeSummaries(summaries: Summary[], sessionId: string): void {
    writeJsonFile(getSummariesPath(sessionId), { summaries });

    // Also write latest as markdown for human readability
    if (summaries.length > 0) {
      const latest = summaries[summaries.length - 1];
      writeMarkdownFile(getLatestMdPath(sessionId), summaryToMarkdown(latest));
    }
  }

  /**
   * Get all session IDs
   */
  function getAllSessionIds(): string[] {
    return listDirs(summariesDir);
  }

  /**
   * Get all summaries across all sessions
   */
  function getAllSummaries(): Summary[] {
    const allSummaries: Summary[] = [];
    const sessionIds = getAllSessionIds();

    for (const sessionId of sessionIds) {
      const summaries = readSummaries(sessionId);
      allSummaries.push(...summaries);
    }

    return allSummaries.sort((a, b) => b.timestamp - a.timestamp);
  }

  return {
    async initialize(): Promise<void> {
      ensureDir(summariesDir);
      initialized = true;
    },

    async close(): Promise<void> {
      initialized = false;
    },

    async clear(): Promise<void> {
      deleteDir(summariesDir);
      ensureDir(summariesDir);
    },

    async add(input: SummaryInput): Promise<Summary> {
      const summary: Summary = {
        ...input,
        id: generateId(),
        timestamp: now(),
      };

      const summaries = readSummaries(summary.sessionId);
      summaries.push(summary);
      writeSummaries(summaries, summary.sessionId);

      return summary;
    },

    async get(id: UUID): Promise<Summary | null> {
      const allSummaries = getAllSummaries();
      return allSummaries.find(s => s.id === id) || null;
    },

    async getLatest(sessionId: string): Promise<Summary | null> {
      const summaries = readSummaries(sessionId);
      if (summaries.length === 0) return null;

      // Sort by timestamp and return latest
      summaries.sort((a, b) => b.timestamp - a.timestamp);
      return summaries[0];
    },

    async list(options?: {
      sessionId?: string;
      since?: Timestamp;
      limit?: number;
    }): Promise<Summary[]> {
      let summaries: Summary[];

      if (options?.sessionId) {
        summaries = readSummaries(options.sessionId);
      } else {
        summaries = getAllSummaries();
      }

      // Filter by since
      if (options?.since !== undefined) {
        summaries = summaries.filter(s => s.timestamp >= options.since!);
      }

      // Sort by timestamp descending
      summaries.sort((a, b) => b.timestamp - a.timestamp);

      // Apply limit
      if (options?.limit) {
        summaries = summaries.slice(0, options.limit);
      }

      return summaries;
    },
  };
}
