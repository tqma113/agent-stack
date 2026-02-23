/**
 * @ai-stack/tree-index - Type Definitions
 *
 * Core types for the hybrid tree index system using Closure Table + Path Enumeration.
 */

import type { SemanticChunk, SemanticSearchResult } from '@ai-stack/memory-store-sqlite';

// ============================================================================
// Core Types
// ============================================================================

/**
 * Types of trees supported by the index
 */
export type TreeType = 'code' | 'doc' | 'event' | 'task';

/**
 * Node types within each tree type
 */
export type TreeNodeType =
  // Code tree nodes
  | 'directory'
  | 'file'
  | 'symbol'
  | 'class'
  | 'function'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  | 'import'
  | 'export'
  // Document tree nodes
  | 'source'
  | 'page'
  | 'section'
  | 'heading'
  | 'paragraph'
  // Event tree nodes
  | 'session'
  | 'event'
  | 'message'
  | 'action'
  // Task tree nodes
  | 'task'
  | 'step'
  | 'subtask';

/**
 * UUID type alias
 */
export type UUID = string;

/**
 * Tree node metadata (extensible)
 */
export interface TreeNodeMetadata {
  /** Symbol kind for code nodes */
  symbolKind?: string;
  /** Programming language for code nodes */
  language?: string;
  /** Line number range for code nodes */
  lineRange?: { start: number; end: number };
  /** File size in bytes */
  fileSize?: number;
  /** Last modified timestamp */
  lastModified?: number;
  /** MIME type for documents */
  mimeType?: string;
  /** URL for document sources */
  url?: string;
  /** Event type for event nodes */
  eventType?: string;
  /** Task status for task nodes */
  taskStatus?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  /** Completion timestamp for tasks */
  completedAt?: number;
  /** Custom metadata */
  [key: string]: unknown;
}

// ============================================================================
// Tree Node Types
// ============================================================================

/**
 * Tree node stored in database
 */
export interface TreeNode {
  /** Unique node identifier */
  id: UUID;
  /** Type of tree this node belongs to */
  treeType: TreeType;
  /** Root ID of the tree */
  treeRootId: UUID;
  /** Type of this node */
  nodeType: TreeNodeType;
  /** Display name of the node */
  name: string;
  /** Full hierarchical path (e.g., '/src/utils/helpers.ts/createHelper') */
  path: string;
  /** Depth in the tree (0 for root) */
  depth: number;
  /** Parent node ID (undefined for root) */
  parentId?: UUID;
  /** Sort order among siblings */
  sortOrder: number;
  /** Linked semantic chunk ID */
  chunkId?: UUID;
  /** Node-specific metadata */
  metadata?: TreeNodeMetadata;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Tree node with nested children (for getSubtree)
 */
export interface TreeNodeWithChildren extends TreeNode {
  children: TreeNodeWithChildren[];
}

/**
 * Tree root entry
 */
export interface TreeRoot {
  /** Unique root identifier */
  id: UUID;
  /** Type of tree */
  treeType: TreeType;
  /** Display name */
  name: string;
  /** Root path (e.g., filesystem path for code trees) */
  rootPath: string;
  /** Root-level metadata */
  metadata?: TreeNodeMetadata;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// ============================================================================
// Input Types (for creation)
// ============================================================================

/**
 * Input for creating a tree root
 */
export interface TreeRootInput {
  /** Type of tree */
  treeType: TreeType;
  /** Display name */
  name: string;
  /** Root path */
  rootPath: string;
  /** Optional metadata */
  metadata?: TreeNodeMetadata;
}

/**
 * Input for creating a tree node
 */
export interface TreeNodeInput {
  /** Type of tree this node belongs to */
  treeType: TreeType;
  /** Root ID of the tree */
  treeRootId: UUID;
  /** Type of this node */
  nodeType: TreeNodeType;
  /** Display name */
  name: string;
  /** Full hierarchical path */
  path: string;
  /** Parent node ID (optional, for root-level nodes) */
  parentId?: UUID;
  /** Sort order (default: 0) */
  sortOrder?: number;
  /** Linked semantic chunk ID */
  chunkId?: UUID;
  /** Node-specific metadata */
  metadata?: TreeNodeMetadata;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Result from tree-aware search
 */
export interface TreeSearchResult {
  /** The matched tree node */
  node: TreeNode;
  /** Associated semantic chunk (if linked) */
  chunk?: SemanticChunk;
  /** Ancestor nodes (for breadcrumb/context) */
  ancestors?: TreeNode[];
  /** Search relevance score */
  score: number;
  /** How the match was found */
  matchType: 'fts' | 'vector' | 'hybrid' | 'path' | 'name';
}

/**
 * Options for tree traversal
 */
export interface TreeTraversalOptions {
  /** Maximum depth to traverse (undefined = unlimited) */
  maxDepth?: number;
  /** Include the root node in results */
  includeRoot?: boolean;
  /** Filter by node types */
  nodeTypes?: TreeNodeType[];
  /** Sort order */
  sortBy?: 'name' | 'path' | 'depth' | 'sortOrder' | 'createdAt';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Options for subtree search
 */
export interface SubtreeSearchOptions {
  /** Maximum number of results */
  limit?: number;
  /** Filter by node types */
  nodeTypes?: TreeNodeType[];
  /** Include ancestor paths in results */
  includeAncestors?: boolean;
  /** Use vector search (requires embeddings) */
  useVector?: boolean;
  /** Query embedding (for vector search) */
  embedding?: number[];
  /** Search weights */
  weights?: { fts: number; vector: number };
}

// ============================================================================
// Closure Table Types
// ============================================================================

/**
 * Closure table entry (ancestor-descendant relationship)
 */
export interface TreeClosure {
  /** Ancestor node ID */
  ancestorId: UUID;
  /** Descendant node ID */
  descendantId: UUID;
  /** Path length between nodes (0 = self, 1 = parent-child, etc.) */
  depth: number;
}

// ============================================================================
// Sync Types
// ============================================================================

/**
 * Types of changes for tree synchronization
 */
export type TreeSyncChangeType = 'add' | 'update' | 'delete' | 'move';

/**
 * A single sync change
 */
export interface TreeSyncChange {
  /** Type of change */
  type: TreeSyncChangeType;
  /** Node path */
  path: string;
  /** New node data (for add/update) */
  node?: TreeNodeInput;
  /** New parent path (for move) */
  newParentPath?: string;
}

/**
 * Result of a sync operation
 */
export interface TreeSyncResult {
  /** Number of nodes added */
  added: number;
  /** Number of nodes updated */
  updated: number;
  /** Number of nodes deleted */
  deleted: number;
  /** Number of nodes moved */
  moved: number;
  /** Any errors encountered */
  errors: Array<{ path: string; error: string }>;
}

// ============================================================================
// Store Interface
// ============================================================================

/**
 * Tree store interface
 */
export interface ITreeStore {
  // Lifecycle
  /** Initialize the store (create tables) */
  initialize(): Promise<void>;
  /** Close the store */
  close(): Promise<void>;
  /** Clear all data */
  clear(): Promise<void>;

  // Root operations
  /** Create a new tree root */
  createRoot(input: TreeRootInput): Promise<TreeRoot>;
  /** Get a tree root by ID */
  getRoot(id: UUID): Promise<TreeRoot | null>;
  /** Get all tree roots */
  listRoots(treeType?: TreeType): Promise<TreeRoot[]>;
  /** Delete a tree root (cascades to all nodes) */
  deleteRoot(id: UUID): Promise<boolean>;

  // Node CRUD
  /** Create a new tree node */
  createNode(input: TreeNodeInput): Promise<TreeNode>;
  /** Create multiple nodes in batch */
  createNodeBatch(inputs: TreeNodeInput[]): Promise<TreeNode[]>;
  /** Get a node by ID */
  getNode(id: UUID): Promise<TreeNode | null>;
  /** Get a node by path within a tree */
  getNodeByPath(rootId: UUID, path: string): Promise<TreeNode | null>;
  /** Update a node */
  updateNode(id: UUID, updates: Partial<TreeNodeInput>): Promise<TreeNode | null>;
  /** Delete a node (cascades to descendants) */
  deleteNode(id: UUID): Promise<boolean>;

  // Tree traversal (via Closure Table)
  /** Get immediate children of a node */
  getChildren(nodeId: UUID, options?: TreeTraversalOptions): Promise<TreeNode[]>;
  /** Get all ancestors of a node (for breadcrumb) */
  getAncestors(nodeId: UUID): Promise<TreeNode[]>;
  /** Get all descendants of a node */
  getDescendants(nodeId: UUID, options?: TreeTraversalOptions): Promise<TreeNode[]>;
  /** Get a subtree as nested structure */
  getSubtree(nodeId: UUID, options?: TreeTraversalOptions): Promise<TreeNodeWithChildren>;

  // Chunk linking
  /** Link a semantic chunk to a tree node */
  linkChunk(nodeId: UUID, chunkId: UUID): Promise<void>;
  /** Unlink a chunk from a node */
  unlinkChunk(nodeId: UUID): Promise<void>;
  /** Get all chunk IDs in a subtree */
  getChunksInSubtree(nodeId: UUID): Promise<UUID[]>;
  /** Get nodes by chunk ID */
  getNodesByChunkId(chunkId: UUID): Promise<TreeNode[]>;

  // Statistics
  /** Count nodes in a tree or subtree */
  countNodes(rootId?: UUID, subtreeNodeId?: UUID): Promise<number>;
  /** Get tree depth statistics */
  getDepthStats(rootId: UUID): Promise<{ maxDepth: number; avgDepth: number }>;
}

/**
 * Tree search interface
 */
export interface ITreeSearch {
  /** Search within a subtree */
  searchInSubtree(
    query: string,
    subtreeRootId: UUID,
    options?: SubtreeSearchOptions
  ): Promise<TreeSearchResult[]>;

  /** Search with ancestor context */
  searchWithContext(
    query: string,
    options?: SubtreeSearchOptions & { rootId?: UUID }
  ): Promise<TreeSearchResult[]>;

  /** Filter semantic search results by hierarchy */
  filterByHierarchy(
    results: SemanticSearchResult[],
    subtreeRootId: UUID
  ): Promise<TreeSearchResult[]>;
}

/**
 * Tree builder interface (for each tree type)
 */
export interface ITreeBuilder<TSource, TConfig = unknown> {
  /** Build a tree from source data */
  build(source: TSource, config?: TConfig): Promise<TreeRoot>;
  /** Sync an existing tree with changes */
  sync(rootId: UUID, changes: TreeSyncChange[]): Promise<TreeSyncResult>;
  /** Rebuild a tree from scratch */
  rebuild(rootId: UUID, source: TSource, config?: TConfig): Promise<TreeRoot>;
}
