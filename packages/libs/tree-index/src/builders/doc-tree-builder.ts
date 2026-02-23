/**
 * @ai-stack/tree-index - Document Tree Builder
 *
 * Builds hierarchical tree structure from document pages and sections.
 */

import type Database from 'better-sqlite3';
import type {
  UUID,
  TreeRoot,
  TreeNodeInput,
  TreeSyncChange,
  TreeSyncResult,
  ITreeBuilder,
} from '../types.js';
import { TreeBuilderError } from '../errors.js';
import { createTreeStore, type TreeStoreInstance } from '../tree-store.js';
import { normalizePath, joinPath } from '../utils/path-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Document page input
 */
export interface DocPage {
  /** Page URL or path */
  url: string;
  /** Page title */
  title: string;
  /** Sections within the page */
  sections?: DocSection[];
  /** Semantic chunk ID for full page content */
  chunkId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document section
 */
export interface DocSection {
  /** Section heading/title */
  heading: string;
  /** Heading level (1-6) */
  level: number;
  /** Section anchor (for linking) */
  anchor?: string;
  /** Semantic chunk ID for section content */
  chunkId?: string;
  /** Nested sections */
  children?: DocSection[];
}

/**
 * Document source input
 */
export interface DocSource {
  /** Source identifier */
  sourceId: string;
  /** Source name/title */
  name: string;
  /** Base URL or path */
  baseUrl: string;
  /** Pages in the source */
  pages: DocPage[];
  /** Source metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Document tree builder configuration
 */
export interface DocTreeBuilderConfig {
  /** Include section nodes */
  includeSections?: boolean;
  /** Maximum heading level to include (1-6) */
  maxHeadingLevel?: number;
}

const DEFAULT_CONFIG: DocTreeBuilderConfig = {
  includeSections: true,
  maxHeadingLevel: 4,
};

/**
 * Document tree builder instance
 */
export interface DocTreeBuilderInstance extends ITreeBuilder<DocSource, DocTreeBuilderConfig> {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Get the tree store instance */
  getTreeStore(): TreeStoreInstance;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a document tree builder
 */
export function createDocTreeBuilder(): DocTreeBuilderInstance {
  // Private state
  const treeStore = createTreeStore();

  // ============================================================================
  // Private Helpers
  // ============================================================================

  function urlToPath(url: string, baseUrl: string): string {
    // Convert URL to a path-like structure
    try {
      const urlObj = new URL(url, baseUrl);
      let path = urlObj.pathname;

      // Clean up path
      path = path.replace(/\/+/g, '/');
      if (!path.startsWith('/')) {
        path = '/' + path;
      }
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }

      return path;
    } catch {
      // If not a valid URL, treat as path
      return normalizePath(url);
    }
  }

  async function createSectionsRecursively(
    sections: DocSection[],
    parentPath: string,
    parentId: UUID,
    rootId: UUID,
    config: DocTreeBuilderConfig
  ): Promise<void> {
    let sortOrder = 0;

    for (const section of sections) {
      // Skip sections beyond max level
      if (config.maxHeadingLevel && section.level > config.maxHeadingLevel) {
        continue;
      }

      const sectionPath = joinPath(parentPath, section.anchor ?? section.heading);

      // Create section node
      const sectionNode = await treeStore.createNode({
        treeType: 'doc',
        treeRootId: rootId,
        nodeType: section.level === 1 ? 'heading' : 'section',
        name: section.heading,
        path: sectionPath,
        parentId,
        sortOrder: sortOrder++,
        chunkId: section.chunkId,
        metadata: {
          headingLevel: section.level,
          anchor: section.anchor,
        },
      });

      // Process nested sections recursively
      if (section.children && section.children.length > 0) {
        await createSectionsRecursively(
          section.children,
          sectionPath,
          sectionNode.id,
          rootId,
          config
        );
      }
    }
  }

  // ============================================================================
  // Build Implementation
  // ============================================================================

  async function build(
    source: DocSource,
    config?: DocTreeBuilderConfig
  ): Promise<TreeRoot> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    try {
      // Ensure store is initialized
      await treeStore.initialize();

      // Create tree root
      const root = await treeStore.createRoot({
        treeType: 'doc',
        name: source.name,
        rootPath: source.baseUrl,
        metadata: source.metadata,
      });

      // Create source node (top-level)
      const sourceNode = await treeStore.createNode({
        treeType: 'doc',
        treeRootId: root.id,
        nodeType: 'source',
        name: source.name,
        path: '/',
        metadata: {
          url: source.baseUrl,
          ...source.metadata,
        },
      });

      // Process pages
      const pageNodes: TreeNodeInput[] = [];
      let pageSortOrder = 0;

      for (const page of source.pages) {
        const pagePath = urlToPath(page.url, source.baseUrl);

        pageNodes.push({
          treeType: 'doc',
          treeRootId: root.id,
          nodeType: 'page',
          name: page.title,
          path: pagePath,
          parentId: sourceNode.id,
          sortOrder: pageSortOrder++,
          chunkId: page.chunkId,
          metadata: {
            url: page.url,
            ...page.metadata,
          },
        });
      }

      // Create page nodes
      const createdPages = await treeStore.createNodeBatch(pageNodes);

      // Build path to node ID mapping
      const pathToNodeId = new Map<string, UUID>();
      for (const page of createdPages) {
        pathToNodeId.set(page.path, page.id);
      }

      // Process sections if enabled
      if (cfg.includeSections) {
        for (let i = 0; i < source.pages.length; i++) {
          const page = source.pages[i];
          const pagePath = urlToPath(page.url, source.baseUrl);
          const pageId = pathToNodeId.get(pagePath);

          if (!pageId || !page.sections) continue;

          await createSectionsRecursively(
            page.sections,
            pagePath,
            pageId,
            root.id,
            cfg
          );
        }
      }

      return root;
    } catch (error) {
      throw new TreeBuilderError(
        'DocTreeBuilder',
        `Failed to build document tree: ${(error as Error).message}`,
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
        'DocTreeBuilder',
        `Sync failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function rebuild(
    rootId: UUID,
    source: DocSource,
    config?: DocTreeBuilderConfig
  ): Promise<TreeRoot> {
    try {
      // Delete existing root
      await treeStore.deleteRoot(rootId);

      // Build fresh
      return build(source, config);
    } catch (error) {
      throw new TreeBuilderError(
        'DocTreeBuilder',
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
