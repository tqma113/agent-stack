/**
 * @ai-stack/tree-index - Tree Search
 *
 * Tree-aware search implementation for searching within subtrees
 * and including hierarchical context.
 */

import type Database from 'better-sqlite3';
import type {
  UUID,
  TreeNode,
  TreeSearchResult,
  SubtreeSearchOptions,
  ITreeSearch,
} from '../types.js';
import type { SemanticSearchResult } from '@ai-stack/memory-store-sqlite';
import { TreeSearchError } from '../errors.js';
import { createTreeStore, type TreeStoreInstance } from '../tree-store.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Semantic store search function type
 */
export type SemanticSearchFunction = (
  query: string,
  options?: {
    limit?: number;
    useVector?: boolean;
    embedding?: number[];
    weights?: { fts: number; vector: number };
  }
) => Promise<SemanticSearchResult[]>;

/**
 * Tree search configuration
 */
export interface TreeSearchConfig {
  /** Tree store instance (or will create new one) */
  treeStore?: TreeStoreInstance;
  /** Semantic search function for content search */
  semanticSearch?: SemanticSearchFunction;
}

/**
 * Tree search instance interface
 */
export interface TreeSearchInstance extends ITreeSearch {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Set the semantic search function */
  setSemanticSearch(fn: SemanticSearchFunction): void;
  /** Search by node name pattern */
  searchByName(pattern: string, rootId?: UUID, options?: SubtreeSearchOptions): Promise<TreeSearchResult[]>;
  /** Search by node path pattern */
  searchByPath(pattern: string, rootId?: UUID, options?: SubtreeSearchOptions): Promise<TreeSearchResult[]>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a tree search instance
 */
export function createTreeSearch(config: TreeSearchConfig = {}): TreeSearchInstance {
  // Private state via closure
  let db: Database.Database | null = null;
  const treeStore = config.treeStore ?? createTreeStore();
  let semanticSearch: SemanticSearchFunction | undefined = config.semanticSearch;

  // ============================================================================
  // Private Helpers
  // ============================================================================

  function getDb(): Database.Database {
    if (!db) {
      throw new TreeSearchError('Database not set');
    }
    return db;
  }

  async function nodeToResult(
    node: TreeNode,
    score: number,
    matchType: TreeSearchResult['matchType'],
    includeAncestors: boolean
  ): Promise<TreeSearchResult> {
    const result: TreeSearchResult = {
      node,
      score,
      matchType,
    };

    if (includeAncestors) {
      result.ancestors = await treeStore.getAncestors(node.id);
    }

    return result;
  }

  // ============================================================================
  // ITreeSearch Implementation
  // ============================================================================

  async function searchInSubtree(
    query: string,
    subtreeRootId: UUID,
    options?: SubtreeSearchOptions
  ): Promise<TreeSearchResult[]> {
    const limit = options?.limit ?? 20;
    const includeAncestors = options?.includeAncestors ?? false;

    try {
      // Get all chunk IDs in subtree
      const chunkIds = await treeStore.getChunksInSubtree(subtreeRootId);

      if (chunkIds.length === 0) {
        // Fall back to name/path search if no chunks
        return searchByName(query, subtreeRootId, options);
      }

      // If no semantic search function, fall back to name search
      if (!semanticSearch) {
        return searchByName(query, subtreeRootId, options);
      }

      // Perform semantic search
      const semanticResults = await semanticSearch(query, {
        limit: limit * 2, // Get more results for filtering
        useVector: options?.useVector,
        embedding: options?.embedding,
        weights: options?.weights,
      });

      // Filter to only chunks in subtree
      const chunkIdSet = new Set(chunkIds);
      const filteredResults = semanticResults.filter((r) =>
        chunkIdSet.has(r.chunk.id)
      );

      // Map to tree search results
      const results: TreeSearchResult[] = [];

      for (const result of filteredResults.slice(0, limit)) {
        // Find tree node(s) for this chunk
        const nodes = await treeStore.getNodesByChunkId(result.chunk.id);

        // Filter by node types if specified
        const matchingNodes = options?.nodeTypes
          ? nodes.filter((n) => options.nodeTypes!.includes(n.nodeType))
          : nodes;

        for (const node of matchingNodes) {
          const treeResult = await nodeToResult(
            node,
            result.score,
            result.matchType,
            includeAncestors
          );
          treeResult.chunk = result.chunk;
          results.push(treeResult);
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      throw new TreeSearchError(
        `Subtree search failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function searchWithContext(
    query: string,
    options?: SubtreeSearchOptions & { rootId?: UUID }
  ): Promise<TreeSearchResult[]> {
    const limit = options?.limit ?? 20;

    try {
      // If rootId specified, search in that subtree
      if (options?.rootId) {
        const root = await treeStore.getRoot(options.rootId);
        if (!root) {
          return [];
        }

        // Get the first node in the tree (usually root node has same path as tree)
        const rootNode = await treeStore.getNodeByPath(options.rootId, '/');
        if (rootNode) {
          return searchInSubtree(query, rootNode.id, {
            ...options,
            includeAncestors: true,
          });
        }
      }

      // If no semantic search, use name search across all trees
      if (!semanticSearch) {
        return searchByName(query, undefined, { ...options, includeAncestors: true });
      }

      // Global semantic search with context
      const semanticResults = await semanticSearch(query, {
        limit: limit * 2,
        useVector: options?.useVector,
        embedding: options?.embedding,
        weights: options?.weights,
      });

      const results: TreeSearchResult[] = [];

      for (const result of semanticResults.slice(0, limit)) {
        // Find tree node(s) for this chunk
        const nodes = await treeStore.getNodesByChunkId(result.chunk.id);

        // Filter by node types if specified
        const matchingNodes = options?.nodeTypes
          ? nodes.filter((n) => options.nodeTypes!.includes(n.nodeType))
          : nodes;

        for (const node of matchingNodes) {
          const treeResult = await nodeToResult(
            node,
            result.score,
            result.matchType,
            true // Always include ancestors for context
          );
          treeResult.chunk = result.chunk;
          results.push(treeResult);
        }
      }

      return results.slice(0, limit);
    } catch (error) {
      throw new TreeSearchError(
        `Search with context failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function filterByHierarchy(
    results: SemanticSearchResult[],
    subtreeRootId: UUID
  ): Promise<TreeSearchResult[]> {
    try {
      // Get all chunk IDs in subtree
      const chunkIds = await treeStore.getChunksInSubtree(subtreeRootId);
      const chunkIdSet = new Set(chunkIds);

      // Filter semantic results to only those in subtree
      const filteredResults: TreeSearchResult[] = [];

      for (const result of results) {
        if (!chunkIdSet.has(result.chunk.id)) {
          continue;
        }

        // Find tree node(s) for this chunk
        const nodes = await treeStore.getNodesByChunkId(result.chunk.id);

        for (const node of nodes) {
          const treeResult = await nodeToResult(node, result.score, result.matchType, true);
          treeResult.chunk = result.chunk;
          filteredResults.push(treeResult);
        }
      }

      return filteredResults;
    } catch (error) {
      throw new TreeSearchError(
        `Filter by hierarchy failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // Extended Search Methods
  // ============================================================================

  async function searchByName(
    pattern: string,
    rootId?: UUID,
    options?: SubtreeSearchOptions
  ): Promise<TreeSearchResult[]> {
    const database = getDb();
    const limit = options?.limit ?? 20;
    const includeAncestors = options?.includeAncestors ?? false;

    try {
      // Build query with LIKE pattern
      let sql = `
        SELECT * FROM tree_nodes
        WHERE name LIKE ?
      `;
      const params: unknown[] = [`%${pattern}%`];

      if (rootId) {
        sql += ' AND tree_root_id = ?';
        params.push(rootId);
      }

      if (options?.nodeTypes && options.nodeTypes.length > 0) {
        sql += ` AND node_type IN (${options.nodeTypes.map(() => '?').join(', ')})`;
        params.push(...options.nodeTypes);
      }

      sql += ` ORDER BY LENGTH(name) ASC, name ASC LIMIT ?`;
      params.push(limit * 2);

      const rows = database.prepare(sql).all(...params) as Array<{
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
      }>;

      const results: TreeSearchResult[] = [];

      for (const row of rows) {
        const node: TreeNode = {
          id: row.id,
          treeType: row.tree_type as TreeNode['treeType'],
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

        // Calculate relevance score based on name match
        const lowerName = node.name.toLowerCase();
        const lowerPattern = pattern.toLowerCase();
        let score = 0;

        if (lowerName === lowerPattern) {
          score = 1.0; // Exact match
        } else if (lowerName.startsWith(lowerPattern)) {
          score = 0.8; // Prefix match
        } else if (lowerName.includes(lowerPattern)) {
          score = 0.5; // Contains match
        }

        const treeResult = await nodeToResult(node, score, 'name', includeAncestors);
        results.push(treeResult);
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (error) {
      throw new TreeSearchError(
        `Name search failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function searchByPath(
    pattern: string,
    rootId?: UUID,
    options?: SubtreeSearchOptions
  ): Promise<TreeSearchResult[]> {
    const database = getDb();
    const limit = options?.limit ?? 20;
    const includeAncestors = options?.includeAncestors ?? false;

    try {
      // Build query with LIKE pattern
      let sql = `
        SELECT * FROM tree_nodes
        WHERE path LIKE ?
      `;
      const params: unknown[] = [`%${pattern}%`];

      if (rootId) {
        sql += ' AND tree_root_id = ?';
        params.push(rootId);
      }

      if (options?.nodeTypes && options.nodeTypes.length > 0) {
        sql += ` AND node_type IN (${options.nodeTypes.map(() => '?').join(', ')})`;
        params.push(...options.nodeTypes);
      }

      sql += ` ORDER BY LENGTH(path) ASC, path ASC LIMIT ?`;
      params.push(limit * 2);

      const rows = database.prepare(sql).all(...params) as Array<{
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
      }>;

      const results: TreeSearchResult[] = [];

      for (const row of rows) {
        const node: TreeNode = {
          id: row.id,
          treeType: row.tree_type as TreeNode['treeType'],
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

        // Calculate relevance score based on path match
        const lowerPath = node.path.toLowerCase();
        const lowerPattern = pattern.toLowerCase();
        let score = 0;

        if (lowerPath === lowerPattern) {
          score = 1.0; // Exact match
        } else if (lowerPath.endsWith(lowerPattern)) {
          score = 0.8; // Suffix match (common for file paths)
        } else if (lowerPath.includes(lowerPattern)) {
          score = 0.5; // Contains match
        }

        const treeResult = await nodeToResult(node, score, 'path', includeAncestors);
        results.push(treeResult);
      }

      // Sort by score descending
      results.sort((a, b) => b.score - a.score);

      return results.slice(0, limit);
    } catch (error) {
      throw new TreeSearchError(
        `Path search failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // Return Instance
  // ============================================================================

  return {
    // Database management
    setDatabase: (database: Database.Database) => {
      db = database;
      treeStore.setDatabase(database);
    },
    setSemanticSearch: (fn: SemanticSearchFunction) => {
      semanticSearch = fn;
    },

    // ITreeSearch methods
    searchInSubtree,
    searchWithContext,
    filterByHierarchy,

    // Extended methods
    searchByName,
    searchByPath,
  };
}
