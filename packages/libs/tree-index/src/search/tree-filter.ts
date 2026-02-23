/**
 * @ai-stack/tree-index - Tree Filter
 *
 * Utilities for filtering search results by tree hierarchy.
 */

import type { UUID, TreeNode, TreeNodeType, TreeSearchResult } from '../types.js';

/**
 * Filter options for tree results
 */
export interface TreeFilterOptions {
  /** Filter by node types */
  nodeTypes?: TreeNodeType[];
  /** Minimum depth (inclusive) */
  minDepth?: number;
  /** Maximum depth (inclusive) */
  maxDepth?: number;
  /** Minimum score threshold */
  minScore?: number;
  /** Only include nodes with chunks */
  requireChunk?: boolean;
  /** Only include nodes without chunks (structural nodes) */
  requireNoChunk?: boolean;
  /** Path pattern (glob-like) */
  pathPattern?: RegExp;
  /** Name pattern */
  namePattern?: RegExp;
  /** Custom filter function */
  customFilter?: (result: TreeSearchResult) => boolean;
}

/**
 * Filter tree search results
 */
export function filterTreeResults(
  results: TreeSearchResult[],
  options: TreeFilterOptions
): TreeSearchResult[] {
  return results.filter((result) => {
    const { node } = result;

    // Node type filter
    if (options.nodeTypes && !options.nodeTypes.includes(node.nodeType)) {
      return false;
    }

    // Depth filters
    if (options.minDepth !== undefined && node.depth < options.minDepth) {
      return false;
    }
    if (options.maxDepth !== undefined && node.depth > options.maxDepth) {
      return false;
    }

    // Score threshold
    if (options.minScore !== undefined && result.score < options.minScore) {
      return false;
    }

    // Chunk filters
    if (options.requireChunk && !node.chunkId) {
      return false;
    }
    if (options.requireNoChunk && node.chunkId) {
      return false;
    }

    // Path pattern
    if (options.pathPattern && !options.pathPattern.test(node.path)) {
      return false;
    }

    // Name pattern
    if (options.namePattern && !options.namePattern.test(node.name)) {
      return false;
    }

    // Custom filter
    if (options.customFilter && !options.customFilter(result)) {
      return false;
    }

    return true;
  });
}

/**
 * Group results by a field
 */
export function groupResultsBy<K extends keyof TreeNode>(
  results: TreeSearchResult[],
  field: K
): Map<TreeNode[K], TreeSearchResult[]> {
  const groups = new Map<TreeNode[K], TreeSearchResult[]>();

  for (const result of results) {
    const key = result.node[field];
    const existing = groups.get(key) ?? [];
    existing.push(result);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Group results by tree root
 */
export function groupByTreeRoot(
  results: TreeSearchResult[]
): Map<UUID, TreeSearchResult[]> {
  return groupResultsBy(results, 'treeRootId');
}

/**
 * Group results by node type
 */
export function groupByNodeType(
  results: TreeSearchResult[]
): Map<TreeNodeType, TreeSearchResult[]> {
  const groups = new Map<TreeNodeType, TreeSearchResult[]>();

  for (const result of results) {
    const key = result.node.nodeType;
    const existing = groups.get(key) ?? [];
    existing.push(result);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Sort results by various criteria
 */
export type TreeSortField = 'score' | 'depth' | 'name' | 'path' | 'createdAt' | 'updatedAt';
export type TreeSortOrder = 'asc' | 'desc';

export function sortTreeResults(
  results: TreeSearchResult[],
  field: TreeSortField = 'score',
  order: TreeSortOrder = 'desc'
): TreeSearchResult[] {
  const direction = order === 'desc' ? -1 : 1;

  return [...results].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'score':
        comparison = a.score - b.score;
        break;
      case 'depth':
        comparison = a.node.depth - b.node.depth;
        break;
      case 'name':
        comparison = a.node.name.localeCompare(b.node.name);
        break;
      case 'path':
        comparison = a.node.path.localeCompare(b.node.path);
        break;
      case 'createdAt':
        comparison = a.node.createdAt - b.node.createdAt;
        break;
      case 'updatedAt':
        comparison = a.node.updatedAt - b.node.updatedAt;
        break;
    }

    return comparison * direction;
  });
}

/**
 * Deduplicate results by node ID
 */
export function deduplicateResults(results: TreeSearchResult[]): TreeSearchResult[] {
  const seen = new Set<UUID>();
  return results.filter((result) => {
    if (seen.has(result.node.id)) {
      return false;
    }
    seen.add(result.node.id);
    return true;
  });
}

/**
 * Take top N results per tree root
 */
export function topNPerRoot(results: TreeSearchResult[], n: number): TreeSearchResult[] {
  const grouped = groupByTreeRoot(results);
  const output: TreeSearchResult[] = [];

  for (const [, group] of grouped) {
    // Sort by score and take top N
    const sorted = sortTreeResults(group, 'score', 'desc');
    output.push(...sorted.slice(0, n));
  }

  return sortTreeResults(output, 'score', 'desc');
}

/**
 * Build breadcrumb path from ancestors
 */
export function buildBreadcrumb(result: TreeSearchResult, separator = ' > '): string {
  if (!result.ancestors || result.ancestors.length === 0) {
    return result.node.name;
  }

  const ancestorNames = result.ancestors.map((a) => a.name);
  return [...ancestorNames, result.node.name].join(separator);
}

/**
 * Format result for display
 */
export interface FormattedTreeResult {
  id: UUID;
  name: string;
  path: string;
  type: TreeNodeType;
  breadcrumb: string;
  score: number;
  matchType: string;
  hasContent: boolean;
}

export function formatResult(result: TreeSearchResult): FormattedTreeResult {
  return {
    id: result.node.id,
    name: result.node.name,
    path: result.node.path,
    type: result.node.nodeType,
    breadcrumb: buildBreadcrumb(result),
    score: result.score,
    matchType: result.matchType,
    hasContent: !!result.chunk,
  };
}

/**
 * Format results for display
 */
export function formatResults(results: TreeSearchResult[]): FormattedTreeResult[] {
  return results.map(formatResult);
}
