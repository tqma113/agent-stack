/**
 * @ai-stack/tui - Diff utilities
 */

import * as Diff from 'diff';
import type { DiffLine, DiffResult } from './types.js';

/**
 * Compute diff between two strings
 */
export function computeDiff(oldContent: string, newContent: string, filename?: string): DiffResult {
  const patches = Diff.structuredPatch(
    filename || 'file',
    filename || 'file',
    oldContent,
    newContent,
    'old',
    'new'
  );

  let additions = 0;
  let deletions = 0;

  for (const hunk of patches.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) additions++;
      else if (line.startsWith('-')) deletions++;
    }
  }

  const unified = Diff.createPatch(filename || 'file', oldContent, newContent, 'old', 'new');
  const hasChanges = additions > 0 || deletions > 0;
  const lines = lineDiff(oldContent, newContent);

  return {
    hasChanges,
    additions,
    deletions,
    unified,
    lines,
  };
}

/**
 * Apply a patch to content
 */
export function applyPatch(content: string, patch: string): string | false {
  return Diff.applyPatch(content, patch);
}

/**
 * Get a summary of changes
 */
export function getDiffSummary(oldContent: string, newContent: string): string {
  const diff = computeDiff(oldContent, newContent);

  if (!diff.hasChanges) {
    return 'No changes';
  }

  const parts: string[] = [];
  if (diff.additions > 0) {
    parts.push(`+${diff.additions}`);
  }
  if (diff.deletions > 0) {
    parts.push(`-${diff.deletions}`);
  }

  return parts.join(' / ');
}

/**
 * Create a word-level diff for display
 */
export function wordDiff(oldContent: string, newContent: string): string {
  const changes = Diff.diffWords(oldContent, newContent);
  const parts: string[] = [];

  for (const change of changes) {
    if (change.added) {
      parts.push(`[+${change.value}]`);
    } else if (change.removed) {
      parts.push(`[-${change.value}]`);
    } else {
      parts.push(change.value);
    }
  }

  return parts.join('');
}

/**
 * Create a line-level diff for display
 */
export function lineDiff(oldContent: string, newContent: string): DiffLine[] {
  const changes = Diff.diffLines(oldContent, newContent);
  const result: DiffLine[] = [];
  let lineNumber = 1;

  for (const change of changes) {
    const lines = change.value.split('\n').filter((l, i, arr) => i < arr.length - 1 || l);

    for (const line of lines) {
      if (change.added) {
        result.push({ type: 'add', line, lineNumber });
      } else if (change.removed) {
        result.push({ type: 'remove', line, lineNumber });
      } else {
        result.push({ type: 'unchanged', line, lineNumber });
      }
      lineNumber++;
    }
  }

  return result;
}

/**
 * Format a unified diff with colors for terminal display
 */
export function formatUnifiedDiff(unified: string): string {
  const lines = unified.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      result.push(`\x1b[1m${line}\x1b[0m`); // Bold for file headers
    } else if (line.startsWith('@@')) {
      result.push(`\x1b[36m${line}\x1b[0m`); // Cyan for hunk headers
    } else if (line.startsWith('+')) {
      result.push(`\x1b[32m${line}\x1b[0m`); // Green for additions
    } else if (line.startsWith('-')) {
      result.push(`\x1b[31m${line}\x1b[0m`); // Red for deletions
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}
