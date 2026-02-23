/**
 * @ai-stack/tree-index - Tree Store
 *
 * SQLite-based implementation of ITreeStore using Closure Table + Path Enumeration.
 */

import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  UUID,
  TreeType,
  TreeNode,
  TreeNodeWithChildren,
  TreeRoot,
  TreeRootInput,
  TreeNodeInput,
  TreeTraversalOptions,
  ITreeStore,
} from './types.js';
import {
  TreeDatabaseError,
  TreeNodeNotFoundError,
  TreeDuplicatePathError,
} from './errors.js';
import {
  insertClosureEntries,
  insertClosureEntriesBatch,
  deleteClosureEntries,
  getAncestorIds,
  getDescendantIds,
} from './utils/closure-utils.js';
import { normalizePath, getPathDepth } from './utils/path-utils.js';

// ============================================================================
// Database Row Types
// ============================================================================

interface TreeNodeRow {
  id: string;
  tree_type: string;
  tree_root_id: string;
  node_type: string;
  name: string;
  path: string;
  depth: number;
  parent_id: string | null;
  sort_order: number;
  chunk_id: string | null;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

interface TreeRootRow {
  id: string;
  tree_type: string;
  name: string;
  root_path: string;
  metadata: string | null;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Store Instance Interface
// ============================================================================

/**
 * Extended tree store instance with database management
 */
export interface TreeStoreInstance extends ITreeStore {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Get the database instance */
  getDatabase(): Database.Database;
  /** Check if store is initialized */
  isInitialized(): boolean;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a tree store instance
 */
export function createTreeStore(): TreeStoreInstance {
  // Private state via closure
  let db: Database.Database | null = null;
  let initialized = false;

  // ============================================================================
  // Private Helpers
  // ============================================================================

  function getDb(): Database.Database {
    if (!db) {
      throw new TreeDatabaseError('getDb', 'Database not set');
    }
    return db;
  }

  function now(): number {
    return Date.now();
  }

  function generateId(): UUID {
    return randomUUID();
  }

  function rowToNode(row: TreeNodeRow): TreeNode {
    return {
      id: row.id,
      treeType: row.tree_type as TreeType,
      treeRootId: row.tree_root_id,
      nodeType: row.node_type as TreeNode['nodeType'],
      name: row.name,
      path: row.path,
      depth: row.depth,
      parentId: row.parent_id ?? undefined,
      sortOrder: row.sort_order,
      chunkId: row.chunk_id ?? undefined,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function rowToRoot(row: TreeRootRow): TreeRoot {
    return {
      id: row.id,
      treeType: row.tree_type as TreeType,
      name: row.name,
      rootPath: row.root_path,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function buildSortClause(options?: TreeTraversalOptions): string {
    const sortBy = options?.sortBy ?? 'sortOrder';
    const sortOrder = options?.sortOrder ?? 'asc';
    const direction = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const columnMap: Record<string, string> = {
      name: 'n.name',
      path: 'n.path',
      depth: 'n.depth',
      sortOrder: 'n.sort_order',
      createdAt: 'n.created_at',
    };

    const column = columnMap[sortBy] ?? 'n.sort_order';
    return `ORDER BY ${column} ${direction}`;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  async function initialize(): Promise<void> {
    const database = getDb();

    database.exec(`
      -- Tree Roots Registry
      CREATE TABLE IF NOT EXISTS tree_roots (
        id TEXT PRIMARY KEY,
        tree_type TEXT NOT NULL,
        name TEXT NOT NULL,
        root_path TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tree_roots_type ON tree_roots(tree_type);

      -- Tree Nodes (Universal)
      CREATE TABLE IF NOT EXISTS tree_nodes (
        id TEXT PRIMARY KEY,
        tree_type TEXT NOT NULL,
        tree_root_id TEXT NOT NULL,
        node_type TEXT NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        depth INTEGER NOT NULL,
        parent_id TEXT,
        sort_order INTEGER DEFAULT 0,
        chunk_id TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (tree_root_id) REFERENCES tree_roots(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES tree_nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tree_nodes_root ON tree_nodes(tree_root_id);
      CREATE INDEX IF NOT EXISTS idx_tree_nodes_parent ON tree_nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_tree_nodes_path ON tree_nodes(tree_root_id, path);
      CREATE INDEX IF NOT EXISTS idx_tree_nodes_chunk ON tree_nodes(chunk_id);
      CREATE INDEX IF NOT EXISTS idx_tree_nodes_type ON tree_nodes(tree_type, node_type);

      -- Closure Table (Ancestor-Descendant)
      CREATE TABLE IF NOT EXISTS tree_closure (
        ancestor_id TEXT NOT NULL,
        descendant_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        PRIMARY KEY (ancestor_id, descendant_id),
        FOREIGN KEY (ancestor_id) REFERENCES tree_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (descendant_id) REFERENCES tree_nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tree_closure_descendant ON tree_closure(descendant_id);
      CREATE INDEX IF NOT EXISTS idx_tree_closure_depth ON tree_closure(depth);
    `);

    initialized = true;
  }

  async function close(): Promise<void> {
    initialized = false;
    // Database is managed externally
  }

  async function clear(): Promise<void> {
    const database = getDb();
    database.exec(`
      DELETE FROM tree_closure;
      DELETE FROM tree_nodes;
      DELETE FROM tree_roots;
    `);
  }

  // ============================================================================
  // Root Operations
  // ============================================================================

  async function createRoot(input: TreeRootInput): Promise<TreeRoot> {
    const database = getDb();
    const timestamp = now();

    const root: TreeRoot = {
      id: generateId(),
      treeType: input.treeType,
      name: input.name,
      rootPath: normalizePath(input.rootPath),
      metadata: input.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      database.prepare(`
        INSERT INTO tree_roots (id, tree_type, name, root_path, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        root.id,
        root.treeType,
        root.name,
        root.rootPath,
        root.metadata ? JSON.stringify(root.metadata) : null,
        root.createdAt,
        root.updatedAt
      );

      return root;
    } catch (error) {
      throw new TreeDatabaseError('createRoot', (error as Error).message, error as Error);
    }
  }

  async function getRoot(id: UUID): Promise<TreeRoot | null> {
    const database = getDb();

    try {
      const row = database.prepare(`
        SELECT * FROM tree_roots WHERE id = ?
      `).get(id) as TreeRootRow | undefined;

      return row ? rowToRoot(row) : null;
    } catch (error) {
      throw new TreeDatabaseError('getRoot', (error as Error).message, error as Error);
    }
  }

  async function listRoots(treeType?: TreeType): Promise<TreeRoot[]> {
    const database = getDb();

    try {
      let sql = 'SELECT * FROM tree_roots';
      const params: unknown[] = [];

      if (treeType) {
        sql += ' WHERE tree_type = ?';
        params.push(treeType);
      }

      sql += ' ORDER BY created_at DESC';

      const rows = database.prepare(sql).all(...params) as TreeRootRow[];
      return rows.map(rowToRoot);
    } catch (error) {
      throw new TreeDatabaseError('listRoots', (error as Error).message, error as Error);
    }
  }

  async function deleteRoot(id: UUID): Promise<boolean> {
    const database = getDb();

    try {
      // Cascade delete will handle nodes and closure entries
      const result = database.prepare(`
        DELETE FROM tree_roots WHERE id = ?
      `).run(id);

      return result.changes > 0;
    } catch (error) {
      throw new TreeDatabaseError('deleteRoot', (error as Error).message, error as Error);
    }
  }

  // ============================================================================
  // Node CRUD Operations
  // ============================================================================

  async function createNode(input: TreeNodeInput): Promise<TreeNode> {
    const database = getDb();
    const timestamp = now();
    const path = normalizePath(input.path);
    const depth = getPathDepth(path);

    // Check for duplicate path
    const existing = database.prepare(`
      SELECT 1 FROM tree_nodes WHERE tree_root_id = ? AND path = ?
    `).get(input.treeRootId, path);

    if (existing) {
      throw new TreeDuplicatePathError(path, input.treeRootId);
    }

    const node: TreeNode = {
      id: generateId(),
      treeType: input.treeType,
      treeRootId: input.treeRootId,
      nodeType: input.nodeType,
      name: input.name,
      path,
      depth,
      parentId: input.parentId,
      sortOrder: input.sortOrder ?? 0,
      chunkId: input.chunkId,
      metadata: input.metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      database.transaction(() => {
        // Insert node
        database.prepare(`
          INSERT INTO tree_nodes (
            id, tree_type, tree_root_id, node_type, name, path, depth,
            parent_id, sort_order, chunk_id, metadata, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          node.id,
          node.treeType,
          node.treeRootId,
          node.nodeType,
          node.name,
          node.path,
          node.depth,
          node.parentId ?? null,
          node.sortOrder,
          node.chunkId ?? null,
          node.metadata ? JSON.stringify(node.metadata) : null,
          node.createdAt,
          node.updatedAt
        );

        // Insert closure entries
        insertClosureEntries(database, node.id, node.parentId);
      })();

      return node;
    } catch (error) {
      if (error instanceof TreeDuplicatePathError) {
        throw error;
      }
      throw new TreeDatabaseError('createNode', (error as Error).message, error as Error);
    }
  }

  async function createNodeBatch(inputs: TreeNodeInput[]): Promise<TreeNode[]> {
    if (inputs.length === 0) {
      return [];
    }

    const database = getDb();
    const timestamp = now();
    const nodes: TreeNode[] = [];

    // Prepare nodes with IDs and normalized paths
    for (const input of inputs) {
      const path = normalizePath(input.path);
      const depth = getPathDepth(path);

      nodes.push({
        id: generateId(),
        treeType: input.treeType,
        treeRootId: input.treeRootId,
        nodeType: input.nodeType,
        name: input.name,
        path,
        depth,
        parentId: input.parentId,
        sortOrder: input.sortOrder ?? 0,
        chunkId: input.chunkId,
        metadata: input.metadata,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    try {
      const insertNode = database.prepare(`
        INSERT INTO tree_nodes (
          id, tree_type, tree_root_id, node_type, name, path, depth,
          parent_id, sort_order, chunk_id, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      database.transaction(() => {
        // Insert all nodes
        for (const node of nodes) {
          insertNode.run(
            node.id,
            node.treeType,
            node.treeRootId,
            node.nodeType,
            node.name,
            node.path,
            node.depth,
            node.parentId ?? null,
            node.sortOrder,
            node.chunkId ?? null,
            node.metadata ? JSON.stringify(node.metadata) : null,
            node.createdAt,
            node.updatedAt
          );
        }

        // Insert closure entries in batch
        insertClosureEntriesBatch(
          database,
          nodes.map((n) => ({ id: n.id, parentId: n.parentId }))
        );
      })();

      return nodes;
    } catch (error) {
      throw new TreeDatabaseError('createNodeBatch', (error as Error).message, error as Error);
    }
  }

  async function getNode(id: UUID): Promise<TreeNode | null> {
    const database = getDb();

    try {
      const row = database.prepare(`
        SELECT * FROM tree_nodes WHERE id = ?
      `).get(id) as TreeNodeRow | undefined;

      return row ? rowToNode(row) : null;
    } catch (error) {
      throw new TreeDatabaseError('getNode', (error as Error).message, error as Error);
    }
  }

  async function getNodeByPath(rootId: UUID, path: string): Promise<TreeNode | null> {
    const database = getDb();
    const normalizedPath = normalizePath(path);

    try {
      const row = database.prepare(`
        SELECT * FROM tree_nodes WHERE tree_root_id = ? AND path = ?
      `).get(rootId, normalizedPath) as TreeNodeRow | undefined;

      return row ? rowToNode(row) : null;
    } catch (error) {
      throw new TreeDatabaseError('getNodeByPath', (error as Error).message, error as Error);
    }
  }

  async function updateNode(
    id: UUID,
    updates: Partial<TreeNodeInput>
  ): Promise<TreeNode | null> {
    const database = getDb();

    try {
      const existing = await getNode(id);
      if (!existing) {
        return null;
      }

      const timestamp = now();
      const setClauses: string[] = ['updated_at = ?'];
      const params: unknown[] = [timestamp];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        params.push(updates.name);
      }

      if (updates.nodeType !== undefined) {
        setClauses.push('node_type = ?');
        params.push(updates.nodeType);
      }

      if (updates.sortOrder !== undefined) {
        setClauses.push('sort_order = ?');
        params.push(updates.sortOrder);
      }

      if (updates.chunkId !== undefined) {
        setClauses.push('chunk_id = ?');
        params.push(updates.chunkId ?? null);
      }

      if (updates.metadata !== undefined) {
        setClauses.push('metadata = ?');
        params.push(updates.metadata ? JSON.stringify(updates.metadata) : null);
      }

      params.push(id);

      database.prepare(`
        UPDATE tree_nodes SET ${setClauses.join(', ')} WHERE id = ?
      `).run(...params);

      return getNode(id);
    } catch (error) {
      throw new TreeDatabaseError('updateNode', (error as Error).message, error as Error);
    }
  }

  async function deleteNode(id: UUID): Promise<boolean> {
    const database = getDb();

    try {
      // Delete closure entries first (cascades to descendants)
      deleteClosureEntries(database, id);

      // Delete node and descendants (cascade)
      const result = database.prepare(`
        DELETE FROM tree_nodes WHERE id = ?
      `).run(id);

      return result.changes > 0;
    } catch (error) {
      throw new TreeDatabaseError('deleteNode', (error as Error).message, error as Error);
    }
  }

  // ============================================================================
  // Tree Traversal (via Closure Table)
  // ============================================================================

  async function getChildren(
    nodeId: UUID,
    options?: TreeTraversalOptions
  ): Promise<TreeNode[]> {
    const database = getDb();
    const sortClause = buildSortClause(options);

    try {
      let sql = `
        SELECT n.* FROM tree_nodes n
        JOIN tree_closure c ON n.id = c.descendant_id
        WHERE c.ancestor_id = ? AND c.depth = 1
      `;
      const params: unknown[] = [nodeId];

      if (options?.nodeTypes && options.nodeTypes.length > 0) {
        sql += ` AND n.node_type IN (${options.nodeTypes.map(() => '?').join(', ')})`;
        params.push(...options.nodeTypes);
      }

      sql += ` ${sortClause}`;

      const rows = database.prepare(sql).all(...params) as TreeNodeRow[];
      return rows.map(rowToNode);
    } catch (error) {
      throw new TreeDatabaseError('getChildren', (error as Error).message, error as Error);
    }
  }

  async function getAncestors(nodeId: UUID): Promise<TreeNode[]> {
    const database = getDb();

    try {
      const ancestorIds = getAncestorIds(database, nodeId, true);

      if (ancestorIds.length === 0) {
        return [];
      }

      const placeholders = ancestorIds.map(() => '?').join(', ');
      const rows = database.prepare(`
        SELECT * FROM tree_nodes WHERE id IN (${placeholders})
      `).all(...ancestorIds) as TreeNodeRow[];

      // Sort by depth (root first)
      return rows.map(rowToNode).sort((a, b) => a.depth - b.depth);
    } catch (error) {
      throw new TreeDatabaseError('getAncestors', (error as Error).message, error as Error);
    }
  }

  async function getDescendants(
    nodeId: UUID,
    options?: TreeTraversalOptions
  ): Promise<TreeNode[]> {
    const database = getDb();
    const sortClause = buildSortClause(options);

    try {
      const descendantIds = getDescendantIds(
        database,
        nodeId,
        !options?.includeRoot,
        options?.maxDepth
      );

      if (descendantIds.length === 0) {
        return options?.includeRoot ? [await getNode(nodeId)].filter(Boolean) as TreeNode[] : [];
      }

      const placeholders = descendantIds.map(() => '?').join(', ');
      let sql = `SELECT * FROM tree_nodes n WHERE n.id IN (${placeholders})`;
      const params: unknown[] = [...descendantIds];

      if (options?.nodeTypes && options.nodeTypes.length > 0) {
        sql += ` AND n.node_type IN (${options.nodeTypes.map(() => '?').join(', ')})`;
        params.push(...options.nodeTypes);
      }

      sql += ` ${sortClause}`;

      const rows = database.prepare(sql).all(...params) as TreeNodeRow[];
      return rows.map(rowToNode);
    } catch (error) {
      throw new TreeDatabaseError('getDescendants', (error as Error).message, error as Error);
    }
  }

  async function getSubtree(
    nodeId: UUID,
    options?: TreeTraversalOptions
  ): Promise<TreeNodeWithChildren> {
    try {
      const node = await getNode(nodeId);
      if (!node) {
        throw new TreeNodeNotFoundError(nodeId);
      }

      const descendants = await getDescendants(nodeId, { ...options, includeRoot: false });

      // Build tree structure
      const nodeMap = new Map<string, TreeNodeWithChildren>();

      // Initialize root
      const rootWithChildren: TreeNodeWithChildren = {
        ...node,
        children: [],
      };
      nodeMap.set(node.id, rootWithChildren);

      // Add all descendants to map
      for (const desc of descendants) {
        nodeMap.set(desc.id, { ...desc, children: [] });
      }

      // Build parent-child relationships
      for (const desc of descendants) {
        if (desc.parentId) {
          const parent = nodeMap.get(desc.parentId);
          const child = nodeMap.get(desc.id);
          if (parent && child) {
            parent.children.push(child);
          }
        }
      }

      // Sort children at each level
      const sortFn = (a: TreeNodeWithChildren, b: TreeNodeWithChildren) => {
        const sortBy = options?.sortBy ?? 'sortOrder';
        const direction = options?.sortOrder === 'desc' ? -1 : 1;

        switch (sortBy) {
          case 'name':
            return a.name.localeCompare(b.name) * direction;
          case 'path':
            return a.path.localeCompare(b.path) * direction;
          case 'depth':
            return (a.depth - b.depth) * direction;
          case 'createdAt':
            return (a.createdAt - b.createdAt) * direction;
          default:
            return (a.sortOrder - b.sortOrder) * direction;
        }
      };

      // Recursively sort children
      function sortChildren(node: TreeNodeWithChildren): void {
        node.children.sort(sortFn);
        node.children.forEach(sortChildren);
      }

      sortChildren(rootWithChildren);

      return rootWithChildren;
    } catch (error) {
      if (error instanceof TreeNodeNotFoundError) {
        throw error;
      }
      throw new TreeDatabaseError('getSubtree', (error as Error).message, error as Error);
    }
  }

  // ============================================================================
  // Chunk Linking
  // ============================================================================

  async function linkChunk(nodeId: UUID, chunkId: UUID): Promise<void> {
    const database = getDb();

    try {
      database.prepare(`
        UPDATE tree_nodes SET chunk_id = ?, updated_at = ? WHERE id = ?
      `).run(chunkId, now(), nodeId);
    } catch (error) {
      throw new TreeDatabaseError('linkChunk', (error as Error).message, error as Error);
    }
  }

  async function unlinkChunk(nodeId: UUID): Promise<void> {
    const database = getDb();

    try {
      database.prepare(`
        UPDATE tree_nodes SET chunk_id = NULL, updated_at = ? WHERE id = ?
      `).run(now(), nodeId);
    } catch (error) {
      throw new TreeDatabaseError('unlinkChunk', (error as Error).message, error as Error);
    }
  }

  async function getChunksInSubtree(nodeId: UUID): Promise<UUID[]> {
    const database = getDb();

    try {
      const descendantIds = getDescendantIds(database, nodeId, false);

      if (descendantIds.length === 0) {
        return [];
      }

      const placeholders = descendantIds.map(() => '?').join(', ');
      const rows = database.prepare(`
        SELECT DISTINCT chunk_id FROM tree_nodes
        WHERE id IN (${placeholders}) AND chunk_id IS NOT NULL
      `).all(...descendantIds) as Array<{ chunk_id: string }>;

      return rows.map((r) => r.chunk_id);
    } catch (error) {
      throw new TreeDatabaseError('getChunksInSubtree', (error as Error).message, error as Error);
    }
  }

  async function getNodesByChunkId(chunkId: UUID): Promise<TreeNode[]> {
    const database = getDb();

    try {
      const rows = database.prepare(`
        SELECT * FROM tree_nodes WHERE chunk_id = ?
      `).all(chunkId) as TreeNodeRow[];

      return rows.map(rowToNode);
    } catch (error) {
      throw new TreeDatabaseError('getNodesByChunkId', (error as Error).message, error as Error);
    }
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  async function countNodes(rootId?: UUID, subtreeNodeId?: UUID): Promise<number> {
    const database = getDb();

    try {
      if (subtreeNodeId) {
        const descendantIds = getDescendantIds(database, subtreeNodeId, false);
        return descendantIds.length;
      }

      let sql = 'SELECT COUNT(*) as count FROM tree_nodes';
      const params: unknown[] = [];

      if (rootId) {
        sql += ' WHERE tree_root_id = ?';
        params.push(rootId);
      }

      const result = database.prepare(sql).get(...params) as { count: number };
      return result.count;
    } catch (error) {
      throw new TreeDatabaseError('countNodes', (error as Error).message, error as Error);
    }
  }

  async function getDepthStats(
    rootId: UUID
  ): Promise<{ maxDepth: number; avgDepth: number }> {
    const database = getDb();

    try {
      const result = database.prepare(`
        SELECT MAX(depth) as max_depth, AVG(depth) as avg_depth
        FROM tree_nodes WHERE tree_root_id = ?
      `).get(rootId) as { max_depth: number | null; avg_depth: number | null };

      return {
        maxDepth: result.max_depth ?? 0,
        avgDepth: result.avg_depth ?? 0,
      };
    } catch (error) {
      throw new TreeDatabaseError('getDepthStats', (error as Error).message, error as Error);
    }
  }

  // ============================================================================
  // Return Instance
  // ============================================================================

  return {
    // Database management
    setDatabase: (database: Database.Database) => {
      db = database;
    },
    getDatabase: () => getDb(),
    isInitialized: () => initialized,

    // Lifecycle
    initialize,
    close,
    clear,

    // Root operations
    createRoot,
    getRoot,
    listRoots,
    deleteRoot,

    // Node CRUD
    createNode,
    createNodeBatch,
    getNode,
    getNodeByPath,
    updateNode,
    deleteNode,

    // Tree traversal
    getChildren,
    getAncestors,
    getDescendants,
    getSubtree,

    // Chunk linking
    linkChunk,
    unlinkChunk,
    getChunksInSubtree,
    getNodesByChunkId,

    // Statistics
    countNodes,
    getDepthStats,
  };
}
