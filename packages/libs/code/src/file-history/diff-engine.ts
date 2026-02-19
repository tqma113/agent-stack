/**
 * @ai-stack/code - Diff Engine
 *
 * Utilities for computing and applying diffs.
 */

import * as Diff from 'diff';

/**
 * Diff result
 */
export interface DiffResult {
  /** Whether there are changes */
  hasChanges: boolean;
  /** Number of additions */
  additions: number;
  /** Number of deletions */
  deletions: number;
  /** Unified diff string */
  unified: string;
  /** Patches for applying */
  patches: Diff.ParsedDiff[];
}

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

  return {
    hasChanges,
    additions,
    deletions,
    unified,
    patches: [patches],
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
export function lineDiff(oldContent: string, newContent: string): Array<{
  type: 'add' | 'remove' | 'unchanged';
  line: string;
  lineNumber: number;
}> {
  const changes = Diff.diffLines(oldContent, newContent);
  const result: Array<{ type: 'add' | 'remove' | 'unchanged'; line: string; lineNumber: number }> = [];
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
