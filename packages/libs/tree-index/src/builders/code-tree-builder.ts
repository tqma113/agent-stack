/**
 * @ai-stack/tree-index - Code Tree Builder
 *
 * Builds hierarchical tree structure from code blocks (files and symbols).
 */

import type Database from 'better-sqlite3';
import type {
  UUID,
  TreeRoot,
  TreeNode,
  TreeNodeInput,
  TreeNodeMetadata,
  TreeSyncChange,
  TreeSyncResult,
  ITreeBuilder,
} from '../types.js';
import { TreeBuilderError } from '../errors.js';
import { createTreeStore, type TreeStoreInstance } from '../tree-store.js';
import { normalizePath, getParentPath, getNameFromPath, joinPath } from '../utils/path-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Code block input (from Knowledge indexer)
 */
export interface CodeBlock {
  /** File path relative to root */
  filePath: string;
  /** Symbol name (if symbol, not file) */
  symbolName?: string;
  /** Symbol kind (function, class, etc.) */
  symbolKind?: string;
  /** Parent symbol name (for nested symbols) */
  parentSymbol?: string;
  /** Line number range */
  lineRange?: { start: number; end: number };
  /** Programming language */
  language?: string;
  /** Semantic chunk ID (if indexed) */
  chunkId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Code tree builder configuration
 */
export interface CodeTreeBuilderConfig {
  /** Include directories as nodes */
  includeDirectories?: boolean;
  /** Include file nodes */
  includeFiles?: boolean;
  /** Include symbol nodes */
  includeSymbols?: boolean;
  /** Ignore patterns (glob) */
  ignorePatterns?: string[];
}

const DEFAULT_CONFIG: CodeTreeBuilderConfig = {
  includeDirectories: true,
  includeFiles: true,
  includeSymbols: true,
  ignorePatterns: ['node_modules', '.git', 'dist', 'build'],
};

/**
 * Code tree builder instance
 */
export interface CodeTreeBuilderInstance extends ITreeBuilder<CodeBlock[], CodeTreeBuilderConfig> {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Get the tree store instance */
  getTreeStore(): TreeStoreInstance;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a code tree builder
 */
export function createCodeTreeBuilder(): CodeTreeBuilderInstance {
  // Private state
  const treeStore = createTreeStore();

  // ============================================================================
  // Private Helpers
  // ============================================================================

  function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
    const segments = path.split('/').filter((s) => s.length > 0);
    return segments.some((segment) =>
      ignorePatterns.some((pattern) => {
        if (pattern.includes('*')) {
          // Simple glob matching
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(segment);
        }
        return segment === pattern;
      })
    );
  }

  function getSymbolNodeType(kind?: string): TreeNode['nodeType'] {
    if (!kind) return 'symbol';

    const kindLower = kind.toLowerCase();
    if (kindLower.includes('class')) return 'class';
    if (kindLower.includes('function') || kindLower.includes('method')) return 'function';
    if (kindLower.includes('interface')) return 'interface';
    if (kindLower.includes('type')) return 'type';
    if (kindLower.includes('variable') || kindLower.includes('const')) return 'variable';
    if (kindLower.includes('import')) return 'import';
    if (kindLower.includes('export')) return 'export';
    return 'symbol';
  }

  // ============================================================================
  // Build Implementation
  // ============================================================================

  async function build(
    source: CodeBlock[],
    config?: CodeTreeBuilderConfig
  ): Promise<TreeRoot> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    try {
      // Ensure store is initialized
      await treeStore.initialize();

      // Create tree root
      const root = await treeStore.createRoot({
        treeType: 'code',
        name: 'Code Tree',
        rootPath: '/',
      });

      // Collect all paths (directories + files + symbols)
      const pathSet = new Set<string>();
      const fileToBlocks = new Map<string, CodeBlock[]>();

      for (const block of source) {
        const normalizedPath = normalizePath(block.filePath);

        // Skip ignored paths
        if (shouldIgnore(normalizedPath, cfg.ignorePatterns ?? [])) {
          continue;
        }

        // Track file
        if (cfg.includeFiles) {
          pathSet.add(normalizedPath);
        }

        // Track directories
        if (cfg.includeDirectories) {
          let parentPath = getParentPath(normalizedPath);
          while (parentPath && parentPath !== '/') {
            pathSet.add(parentPath);
            parentPath = getParentPath(parentPath);
          }
        }

        // Group blocks by file
        const blocks = fileToBlocks.get(normalizedPath) ?? [];
        blocks.push(block);
        fileToBlocks.set(normalizedPath, blocks);
      }

      // Sort paths by depth (directories first)
      const sortedPaths = Array.from(pathSet).sort((a, b) => {
        const depthA = a.split('/').length;
        const depthB = b.split('/').length;
        return depthA - depthB || a.localeCompare(b);
      });

      // Create nodes with parent tracking (sequential to maintain FK integrity)
      const pathToNodeId = new Map<string, UUID>();

      for (const path of sortedPaths) {
        const isDirectory = !fileToBlocks.has(path);
        const parentPath = getParentPath(path);
        const parentId = parentPath ? pathToNodeId.get(parentPath) : undefined;
        const name = getNameFromPath(path);

        // Determine metadata
        const blocks = fileToBlocks.get(path);
        const firstBlock = blocks?.[0];
        const metadata: TreeNodeMetadata = {};

        if (firstBlock?.language) {
          metadata.language = firstBlock.language;
        }

        // Create node sequentially to ensure parent exists
        const createdNode = await treeStore.createNode({
          treeType: 'code',
          treeRootId: root.id,
          nodeType: isDirectory ? 'directory' : 'file',
          name,
          path,
          parentId,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          chunkId: isDirectory ? undefined : firstBlock?.chunkId,
        });

        pathToNodeId.set(path, createdNode.id);
      }

      // Add symbol nodes if enabled
      if (cfg.includeSymbols) {
        const symbolInputs: TreeNodeInput[] = [];

        for (const [filePath, blocks] of fileToBlocks) {
          const fileNodeId = pathToNodeId.get(filePath);
          if (!fileNodeId) continue;

          // Track parent symbols for nesting
          const symbolPathToId = new Map<string, UUID>();

          for (const block of blocks) {
            if (!block.symbolName) continue;

            // Determine parent (file or parent symbol)
            let parentId = fileNodeId;
            if (block.parentSymbol) {
              const parentSymbolPath = `${filePath}/${block.parentSymbol}`;
              parentId = symbolPathToId.get(parentSymbolPath) ?? fileNodeId;
            }

            const symbolPath = joinPath(filePath, block.symbolName);
            const symbolId = crypto.randomUUID();
            symbolPathToId.set(symbolPath, symbolId);

            symbolInputs.push({
              treeType: 'code',
              treeRootId: root.id,
              nodeType: getSymbolNodeType(block.symbolKind),
              name: block.symbolName,
              path: symbolPath,
              parentId,
              chunkId: block.chunkId,
              metadata: {
                symbolKind: block.symbolKind,
                lineRange: block.lineRange,
                language: block.language,
                ...block.metadata,
              },
            });
          }
        }

        if (symbolInputs.length > 0) {
          await treeStore.createNodeBatch(symbolInputs);
        }
      }

      return root;
    } catch (error) {
      throw new TreeBuilderError(
        'CodeTreeBuilder',
        `Failed to build code tree: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function sync(
    rootId: UUID,
    changes: TreeSyncChange[]
  ): Promise<TreeSyncResult> {
    const result: TreeSyncResult = {
      added: 0,
      updated: 0,
      deleted: 0,
      moved: 0,
      errors: [],
    };

    try {
      for (const change of changes) {
        try {
          switch (change.type) {
            case 'add':
              if (change.node) {
                await treeStore.createNode({
                  ...change.node,
                  treeRootId: rootId,
                });
                result.added++;
              }
              break;

            case 'update':
              if (change.node) {
                const existing = await treeStore.getNodeByPath(rootId, change.path);
                if (existing) {
                  await treeStore.updateNode(existing.id, change.node);
                  result.updated++;
                }
              }
              break;

            case 'delete':
              const toDelete = await treeStore.getNodeByPath(rootId, change.path);
              if (toDelete) {
                await treeStore.deleteNode(toDelete.id);
                result.deleted++;
              }
              break;

            case 'move':
              // Move requires more complex handling - for now just record
              result.errors.push({
                path: change.path,
                error: 'Move operation not fully implemented',
              });
              break;
          }
        } catch (error) {
          result.errors.push({
            path: change.path,
            error: (error as Error).message,
          });
        }
      }

      return result;
    } catch (error) {
      throw new TreeBuilderError(
        'CodeTreeBuilder',
        `Sync failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function rebuild(
    rootId: UUID,
    source: CodeBlock[],
    config?: CodeTreeBuilderConfig
  ): Promise<TreeRoot> {
    try {
      // Delete existing root
      await treeStore.deleteRoot(rootId);

      // Build fresh
      return build(source, config);
    } catch (error) {
      throw new TreeBuilderError(
        'CodeTreeBuilder',
        `Rebuild failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // ============================================================================
  // Return Instance
  // ============================================================================

  return {
    setDatabase: (database: Database.Database) => {
      treeStore.setDatabase(database);
    },
    getTreeStore: () => treeStore,
    build,
    sync,
    rebuild,
  };
}
