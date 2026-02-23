/**
 * @ai-stack/tree-index
 *
 * Hybrid Tree Index for AI Stack - Closure Table + Path Enumeration
 * for hierarchical navigation with bidirectional linking to flat content storage.
 *
 * Features:
 * - Hierarchical tree storage using Closure Table pattern
 * - Efficient ancestor/descendant queries in O(1)
 * - Path-based navigation with breadcrumb support
 * - Bidirectional linking to semantic chunks
 * - Tree-aware search with subtree filtering
 * - Multiple tree types: code, document, event, task
 *
 * @packageDocumentation
 */

// Core types
export * from './types.js';

// Errors
export * from './errors.js';

// Tree store
export { createTreeStore, type TreeStoreInstance } from './tree-store.js';

// Search
export {
  createTreeSearch,
  type TreeSearchInstance,
  type TreeSearchConfig,
  type SemanticSearchFunction,
} from './search/tree-search.js';

export {
  filterTreeResults,
  groupResultsBy,
  groupByTreeRoot,
  groupByNodeType,
  sortTreeResults,
  deduplicateResults,
  topNPerRoot,
  buildBreadcrumb,
  formatResult,
  formatResults,
  type TreeFilterOptions,
  type TreeSortField,
  type TreeSortOrder,
  type FormattedTreeResult,
} from './search/tree-filter.js';

// Builders
export {
  createCodeTreeBuilder,
  type CodeTreeBuilderInstance,
  type CodeBlock,
  type CodeTreeBuilderConfig,
} from './builders/code-tree-builder.js';

export {
  createDocTreeBuilder,
  type DocTreeBuilderInstance,
  type DocPage,
  type DocSection,
  type DocSource,
  type DocTreeBuilderConfig,
} from './builders/doc-tree-builder.js';

export {
  createEventTreeBuilder,
  type EventTreeBuilderInstance,
  type EventType,
  type MemoryEventInput,
  type SessionInput,
  type EventTreeBuilderConfig,
} from './builders/event-tree-builder.js';

export {
  createTaskTreeBuilder,
  type TaskTreeBuilderInstance,
  type TaskStatus,
  type TaskStepInput,
  type TaskStateInput,
  type TaskTreeBuilderConfig,
} from './builders/task-tree-builder.js';

// Utilities
export {
  // Path utilities
  normalizePath,
  getParentPath,
  getNameFromPath,
  joinPath,
  getAncestorPaths,
  getPathDepth,
  isAncestorOf,
  isDescendantOf,
  getRelativePath,
  splitPath,
  matchesPattern,
  // Closure utilities
  insertClosureEntries,
  insertClosureEntriesBatch,
  deleteClosureEntries,
  getAncestorIds,
  getDescendantIds,
  getChildIds,
  isAncestor,
  getDepthBetween,
  moveSubtree,
  getClosureStats,
  validateClosure,
} from './utils/index.js';
