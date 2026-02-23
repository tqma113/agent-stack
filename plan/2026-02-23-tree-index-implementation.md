# Hybrid Tree + Flat Storage Architecture Implementation

**Date**: 2026-02-23
**Status**: Completed

## Overview

Implemented the `@ai-stack/tree-index` package providing a hybrid tree index system using Closure Table + Path Enumeration patterns for hierarchical navigation with bidirectional linking to flat content storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Hybrid Architecture                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │   Tree Index     │◄────────────►│   Flat Chunks    │         │
│  │  (Closure Table) │   bidirect   │  (SemanticStore) │         │
│  └──────────────────┘     link     └──────────────────┘         │
│          │                                   │                   │
│          │ getDescendants()                  │ search()          │
│          │ getAncestors()                    │ FTS + Vector      │
│          ▼                                   ▼                   │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              Tree-Aware Search Layer                 │        │
│  │  - searchInSubtree(nodeId, query)                   │        │
│  │  - searchWithContext(query) → results + ancestors   │        │
│  │  - filterByHierarchy(results, subtreeRoot)          │        │
│  └─────────────────────────────────────────────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Package Structure

```
packages/libs/tree-index/
├── src/
│   ├── index.ts           # Public exports
│   ├── types.ts           # Type definitions
│   ├── errors.ts          # Error classes
│   ├── tree-store.ts      # Core tree store (SQLite)
│   ├── builders/
│   │   ├── index.ts
│   │   ├── code-tree-builder.ts
│   │   ├── doc-tree-builder.ts
│   │   ├── event-tree-builder.ts
│   │   └── task-tree-builder.ts
│   ├── search/
│   │   ├── index.ts
│   │   ├── tree-search.ts
│   │   └── tree-filter.ts
│   └── utils/
│       ├── index.ts
│       ├── path-utils.ts
│       └── closure-utils.ts
└── tests/
    ├── tree-store.test.ts
    ├── path-utils.test.ts
    └── builders.test.ts
```

### Database Schema

```sql
-- Tree Roots Registry
CREATE TABLE tree_roots (
  id TEXT PRIMARY KEY,
  tree_type TEXT NOT NULL,        -- 'code' | 'doc' | 'event' | 'task'
  name TEXT NOT NULL,
  root_path TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Tree Nodes (Universal)
CREATE TABLE tree_nodes (
  id TEXT PRIMARY KEY,
  tree_type TEXT NOT NULL,
  tree_root_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,             -- '/src/utils/helpers.ts/createHelper'
  depth INTEGER NOT NULL,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  chunk_id TEXT,                  -- Link to semantic_chunks
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (tree_root_id) REFERENCES tree_roots(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES tree_nodes(id) ON DELETE CASCADE
);

-- Closure Table (Ancestor-Descendant)
CREATE TABLE tree_closure (
  ancestor_id TEXT NOT NULL,
  descendant_id TEXT NOT NULL,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  FOREIGN KEY (ancestor_id) REFERENCES tree_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (descendant_id) REFERENCES tree_nodes(id) ON DELETE CASCADE
);
```

### Key APIs

#### Tree Store

```typescript
interface ITreeStore {
  // Root operations
  createRoot(input: TreeRootInput): Promise<TreeRoot>;
  getRoot(id: string): Promise<TreeRoot | null>;
  listRoots(treeType?: TreeType): Promise<TreeRoot[]>;
  deleteRoot(id: string): Promise<boolean>;

  // Node CRUD
  createNode(input: TreeNodeInput): Promise<TreeNode>;
  createNodeBatch(inputs: TreeNodeInput[]): Promise<TreeNode[]>;
  getNode(id: string): Promise<TreeNode | null>;
  getNodeByPath(rootId: string, path: string): Promise<TreeNode | null>;
  updateNode(id: string, updates: Partial<TreeNodeInput>): Promise<TreeNode | null>;
  deleteNode(id: string): Promise<boolean>;

  // Tree traversal (via Closure Table - O(1) queries)
  getChildren(nodeId: string): Promise<TreeNode[]>;
  getAncestors(nodeId: string): Promise<TreeNode[]>;
  getDescendants(nodeId: string): Promise<TreeNode[]>;
  getSubtree(nodeId: string): Promise<TreeNodeWithChildren>;

  // Chunk linking
  linkChunk(nodeId: string, chunkId: string): Promise<void>;
  getChunksInSubtree(nodeId: string): Promise<string[]>;
}
```

#### Tree Builders

```typescript
// Code Tree Builder
const codeBuilder = createCodeTreeBuilder();
codeBuilder.setDatabase(db);
const root = await codeBuilder.build(codeBlocks);

// Document Tree Builder
const docBuilder = createDocTreeBuilder();
docBuilder.setDatabase(db);
const root = await docBuilder.build(docSource);

// Event Tree Builder
const eventBuilder = createEventTreeBuilder();
eventBuilder.setDatabase(db);
const root = await eventBuilder.build(sessionInput);

// Task Tree Builder
const taskBuilder = createTaskTreeBuilder();
taskBuilder.setDatabase(db);
const root = await taskBuilder.build(taskState);
```

#### Tree Search

```typescript
const search = createTreeSearch({ treeStore, semanticSearch });

// Search within a subtree
const results = await search.searchInSubtree('query', subtreeRootId, {
  limit: 20,
  includeAncestors: true,
});

// Filter existing results by hierarchy
const filtered = await search.filterByHierarchy(semanticResults, subtreeId);
```

## Test Results

```
 ✓ tests/path-utils.test.ts (36 tests)
 ✓ tests/tree-store.test.ts (22 tests)
 ✓ tests/builders.test.ts (10 tests)

 Test Files  3 passed (3)
      Tests  68 passed (68)
```

## Phase 2: Knowledge Package Integration (Completed)

### Completed Items

1. **CodeIndexer Integration**
   - Added tree-index imports and state variables
   - Modified `indexFile()` to capture chunk IDs
   - Accumulate code blocks with chunk IDs for tree building
   - Build code tree after `indexDirectory()` completes
   - Added `enableTreeIndex()`, `getTreeStore()`, `getTreeRoot()` methods

2. **DocIndexer Integration**
   - Added tree-index imports and state variables
   - Modified `indexPage()` to capture chunk IDs
   - Accumulate pages with chunk IDs for tree building
   - Build doc tree after `crawlAll()` completes
   - Added `enableTreeIndex()`, `getTreeStore()`, `getTreeRoot()` methods

3. **KnowledgeManager Updates**
   - Added `treeIndex` configuration option
   - Enable tree indexing on both code and doc indexers
   - Wire tree stores to HybridSearch
   - Added `enableTreeIndex()`, `getCodeTreeStore()`, `getDocTreeStore()`, `getCodeTreeRoot()`, `getDocTreeRoot()` methods

4. **HybridSearch Tree-Aware Search**
   - Added tree store references (`setCodeTreeStore`, `setDocTreeStore`)
   - Added subtree filtering via `tree.subtreeRootId` option
   - Added ancestor breadcrumb enrichment via `tree.includeAncestors` option
   - Added `BreadcrumbItem` type for tree context

### New Types

```typescript
// In @ai-stack/knowledge
interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
  nodeType: string;
}

interface KnowledgeSearchOptions {
  // ... existing options
  tree?: {
    subtreeRootId?: string;
    includeAncestors?: boolean;
    nodeTypes?: string[];
  };
}

interface KnowledgeSearchResult {
  // ... existing fields
  ancestors?: BreadcrumbItem[];
  treeNodeId?: string;
}
```

## Future Work

1. **Memory Retriever Extension**: Add tree-aware retrieval options
2. **Memory Injector Enhancement**: Add hierarchical formatting with breadcrumbs
3. **Performance Optimization**: Add caching layer for frequently accessed trees
4. **Migration Tools**: Create migration scripts for existing data
5. **Integration Tests**: Add comprehensive integration tests for tree-aware search
