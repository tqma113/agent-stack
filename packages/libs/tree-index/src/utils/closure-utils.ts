/**
 * @ai-stack/tree-index - Closure Table Utilities
 *
 * Helper functions for managing the closure table (ancestor-descendant relationships).
 */

import type Database from 'better-sqlite3';
import type { UUID } from '../types.js';

/**
 * Insert closure entries for a new node
 *
 * When a new node is added, we need to:
 * 1. Add self-reference (node -> node, depth 0)
 * 2. Copy all parent's ancestor entries with depth + 1
 */
export function insertClosureEntries(
  db: Database.Database,
  nodeId: UUID,
  parentId?: UUID
): void {
  // Self-reference (depth 0)
  db.prepare(`
    INSERT INTO tree_closure (ancestor_id, descendant_id, depth)
    VALUES (?, ?, 0)
  `).run(nodeId, nodeId);

  // Copy parent's ancestors with depth + 1
  if (parentId) {
    db.prepare(`
      INSERT INTO tree_closure (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, ?, depth + 1
      FROM tree_closure
      WHERE descendant_id = ?
    `).run(nodeId, parentId);
  }
}

/**
 * Insert closure entries for multiple nodes in batch (optimized)
 *
 * Nodes must be ordered so parents come before children.
 */
export function insertClosureEntriesBatch(
  db: Database.Database,
  nodes: Array<{ id: UUID; parentId?: UUID }>
): void {
  const insertSelf = db.prepare(`
    INSERT INTO tree_closure (ancestor_id, descendant_id, depth)
    VALUES (?, ?, 0)
  `);

  const insertFromParent = db.prepare(`
    INSERT INTO tree_closure (ancestor_id, descendant_id, depth)
    SELECT ancestor_id, ?, depth + 1
    FROM tree_closure
    WHERE descendant_id = ?
  `);

  const transaction = db.transaction(() => {
    for (const node of nodes) {
      insertSelf.run(node.id, node.id);
      if (node.parentId) {
        insertFromParent.run(node.id, node.parentId);
      }
    }
  });

  transaction();
}

/**
 * Delete closure entries for a node and all its descendants
 *
 * This should be called before deleting the node from the main table.
 */
export function deleteClosureEntries(
  db: Database.Database,
  nodeId: UUID
): void {
  // Delete all entries where the node is either ancestor or descendant
  // This handles both the node itself and any descendants
  db.prepare(`
    DELETE FROM tree_closure
    WHERE descendant_id IN (
      SELECT descendant_id FROM tree_closure WHERE ancestor_id = ?
    )
  `).run(nodeId);
}

/**
 * Get all ancestors of a node (ordered by depth, root first)
 */
export function getAncestorIds(
  db: Database.Database,
  nodeId: UUID,
  excludeSelf = true
): UUID[] {
  const minDepth = excludeSelf ? 1 : 0;

  const rows = db.prepare(`
    SELECT ancestor_id, depth
    FROM tree_closure
    WHERE descendant_id = ? AND depth >= ?
    ORDER BY depth DESC
  `).all(nodeId, minDepth) as Array<{ ancestor_id: string; depth: number }>;

  return rows.map((r) => r.ancestor_id);
}

/**
 * Get all descendant IDs of a node (ordered by depth)
 */
export function getDescendantIds(
  db: Database.Database,
  nodeId: UUID,
  excludeSelf = true,
  maxDepth?: number
): UUID[] {
  const minDepth = excludeSelf ? 1 : 0;

  let sql = `
    SELECT descendant_id, depth
    FROM tree_closure
    WHERE ancestor_id = ? AND depth >= ?
  `;
  const params: unknown[] = [nodeId, minDepth];

  if (maxDepth !== undefined) {
    sql += ' AND depth <= ?';
    params.push(maxDepth);
  }

  sql += ' ORDER BY depth';

  const rows = db.prepare(sql).all(...params) as Array<{ descendant_id: string; depth: number }>;

  return rows.map((r) => r.descendant_id);
}

/**
 * Get immediate children IDs (depth = 1)
 */
export function getChildIds(
  db: Database.Database,
  nodeId: UUID
): UUID[] {
  const rows = db.prepare(`
    SELECT descendant_id
    FROM tree_closure
    WHERE ancestor_id = ? AND depth = 1
  `).all(nodeId) as Array<{ descendant_id: string }>;

  return rows.map((r) => r.descendant_id);
}

/**
 * Check if nodeA is an ancestor of nodeB
 */
export function isAncestor(
  db: Database.Database,
  nodeA: UUID,
  nodeB: UUID
): boolean {
  const row = db.prepare(`
    SELECT 1 FROM tree_closure
    WHERE ancestor_id = ? AND descendant_id = ? AND depth > 0
    LIMIT 1
  `).get(nodeA, nodeB);

  return row !== undefined;
}

/**
 * Get the depth between two nodes (or null if not related)
 */
export function getDepthBetween(
  db: Database.Database,
  ancestorId: UUID,
  descendantId: UUID
): number | null {
  const row = db.prepare(`
    SELECT depth FROM tree_closure
    WHERE ancestor_id = ? AND descendant_id = ?
  `).get(ancestorId, descendantId) as { depth: number } | undefined;

  return row?.depth ?? null;
}

/**
 * Move a subtree to a new parent
 *
 * This requires:
 * 1. Remove old ancestor links (except self-references)
 * 2. Add new ancestor links from new parent
 */
export function moveSubtree(
  db: Database.Database,
  nodeId: UUID,
  newParentId: UUID
): void {
  // Get all descendants including self
  const descendants = getDescendantIds(db, nodeId, false);

  db.transaction(() => {
    for (const descendantId of descendants) {
      // Get the depth of this descendant relative to the moving node
      const relativeDepth = getDepthBetween(db, nodeId, descendantId) ?? 0;

      // Delete all ancestor links except self-reference
      db.prepare(`
        DELETE FROM tree_closure
        WHERE descendant_id = ? AND depth > 0
      `).run(descendantId);

      // Add links to new parent's ancestors (with adjusted depths)
      db.prepare(`
        INSERT INTO tree_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, ?, depth + ? + 1
        FROM tree_closure
        WHERE descendant_id = ?
      `).run(descendantId, relativeDepth, newParentId);
    }
  })();
}

/**
 * Get closure statistics for a tree
 */
export function getClosureStats(
  db: Database.Database,
  rootId: UUID
): { totalEntries: number; maxDepth: number; avgDepth: number } {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_entries,
      MAX(depth) as max_depth,
      AVG(depth) as avg_depth
    FROM tree_closure
    WHERE ancestor_id IN (
      SELECT descendant_id FROM tree_closure WHERE ancestor_id = ?
    )
  `).get(rootId) as { total_entries: number; max_depth: number; avg_depth: number };

  return {
    totalEntries: stats.total_entries,
    maxDepth: stats.max_depth ?? 0,
    avgDepth: stats.avg_depth ?? 0,
  };
}

/**
 * Validate closure table integrity for a tree
 */
export function validateClosure(
  db: Database.Database,
  rootId: UUID
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for self-references
  const missingSelf = db.prepare(`
    SELECT id FROM tree_nodes
    WHERE tree_root_id = ?
    AND id NOT IN (
      SELECT descendant_id FROM tree_closure WHERE ancestor_id = descendant_id
    )
  `).all(rootId) as Array<{ id: string }>;

  if (missingSelf.length > 0) {
    errors.push(`Missing self-references for ${missingSelf.length} nodes`);
  }

  // Check for orphaned entries
  const orphaned = db.prepare(`
    SELECT DISTINCT descendant_id FROM tree_closure
    WHERE descendant_id NOT IN (SELECT id FROM tree_nodes)
  `).all() as Array<{ descendant_id: string }>;

  if (orphaned.length > 0) {
    errors.push(`Orphaned closure entries for ${orphaned.length} nodes`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
