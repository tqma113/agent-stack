/**
 * @ai-stack/tree-index - Tree Store Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createTreeStore } from '../src/tree-store.js';
import type { TreeNode, TreeNodeInput } from '../src/types.js';

describe('TreeStore', () => {
  let db: Database.Database;
  let store: ReturnType<typeof createTreeStore>;

  beforeEach(async () => {
    db = new Database(':memory:');
    store = createTreeStore();
    store.setDatabase(db);
    await store.initialize();
  });

  afterEach(async () => {
    await store.close();
    db.close();
  });

  describe('Root Operations', () => {
    it('should create a tree root', async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'Test Project',
        rootPath: '/test',
      });

      expect(root).toBeDefined();
      expect(root.id).toBeDefined();
      expect(root.treeType).toBe('code');
      expect(root.name).toBe('Test Project');
      expect(root.rootPath).toBe('/test');
    });

    it('should get a tree root by ID', async () => {
      const created = await store.createRoot({
        treeType: 'doc',
        name: 'Docs',
        rootPath: '/docs',
      });

      const retrieved = await store.getRoot(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should list tree roots by type', async () => {
      await store.createRoot({ treeType: 'code', name: 'Code 1', rootPath: '/code1' });
      await store.createRoot({ treeType: 'code', name: 'Code 2', rootPath: '/code2' });
      await store.createRoot({ treeType: 'doc', name: 'Docs', rootPath: '/docs' });

      const codeRoots = await store.listRoots('code');
      const docRoots = await store.listRoots('doc');
      const allRoots = await store.listRoots();

      expect(codeRoots).toHaveLength(2);
      expect(docRoots).toHaveLength(1);
      expect(allRoots).toHaveLength(3);
    });

    it('should delete a tree root', async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'To Delete',
        rootPath: '/delete',
      });

      const deleted = await store.deleteRoot(root.id);
      const retrieved = await store.getRoot(root.id);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });
  });

  describe('Node Operations', () => {
    let rootId: string;

    beforeEach(async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'Test',
        rootPath: '/',
      });
      rootId = root.id;
    });

    it('should create a tree node', async () => {
      const node = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'src',
        path: '/src',
      });

      expect(node).toBeDefined();
      expect(node.id).toBeDefined();
      expect(node.name).toBe('src');
      expect(node.path).toBe('/src');
      expect(node.depth).toBe(1);
    });

    it('should create nested nodes', async () => {
      const src = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'src',
        path: '/src',
      });

      const utils = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'utils',
        path: '/src/utils',
        parentId: src.id,
      });

      expect(utils.depth).toBe(2);
      expect(utils.parentId).toBe(src.id);
    });

    it('should create nodes in batch', async () => {
      const inputs: TreeNodeInput[] = [
        { treeType: 'code', treeRootId: rootId, nodeType: 'directory', name: 'src', path: '/src' },
        { treeType: 'code', treeRootId: rootId, nodeType: 'directory', name: 'lib', path: '/lib' },
        { treeType: 'code', treeRootId: rootId, nodeType: 'file', name: 'index.ts', path: '/index.ts' },
      ];

      const nodes = await store.createNodeBatch(inputs);

      expect(nodes).toHaveLength(3);
      expect(nodes.map((n) => n.name)).toContain('src');
      expect(nodes.map((n) => n.name)).toContain('lib');
      expect(nodes.map((n) => n.name)).toContain('index.ts');
    });

    it('should get node by path', async () => {
      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'main.ts',
        path: '/src/main.ts',
      });

      const node = await store.getNodeByPath(rootId, '/src/main.ts');

      expect(node).toBeDefined();
      expect(node?.name).toBe('main.ts');
    });

    it('should update a node', async () => {
      const node = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'old.ts',
        path: '/old.ts',
      });

      const updated = await store.updateNode(node.id, {
        name: 'new.ts',
        metadata: { renamed: true },
      });

      expect(updated?.name).toBe('new.ts');
      expect(updated?.metadata?.renamed).toBe(true);
    });

    it('should delete a node', async () => {
      const node = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'temp.ts',
        path: '/temp.ts',
      });

      const deleted = await store.deleteNode(node.id);
      const retrieved = await store.getNode(node.id);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should reject duplicate paths', async () => {
      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'unique.ts',
        path: '/unique.ts',
      });

      await expect(
        store.createNode({
          treeType: 'code',
          treeRootId: rootId,
          nodeType: 'file',
          name: 'unique.ts',
          path: '/unique.ts',
        })
      ).rejects.toThrow();
    });
  });

  describe('Tree Traversal', () => {
    let rootId: string;
    let srcId: string;
    let utilsId: string;

    beforeEach(async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'Test',
        rootPath: '/',
      });
      rootId = root.id;

      // Create tree structure:
      // /src
      //   /utils
      //     /helpers.ts
      //     /format.ts
      //   /index.ts
      // /lib
      //   /core.ts

      const src = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'src',
        path: '/src',
      });
      srcId = src.id;

      const utils = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'utils',
        path: '/src/utils',
        parentId: src.id,
      });
      utilsId = utils.id;

      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'helpers.ts',
        path: '/src/utils/helpers.ts',
        parentId: utils.id,
      });

      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'format.ts',
        path: '/src/utils/format.ts',
        parentId: utils.id,
      });

      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'index.ts',
        path: '/src/index.ts',
        parentId: src.id,
      });

      const lib = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'lib',
        path: '/lib',
      });

      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'core.ts',
        path: '/lib/core.ts',
        parentId: lib.id,
      });
    });

    it('should get children of a node', async () => {
      const children = await store.getChildren(srcId);

      expect(children).toHaveLength(2);
      expect(children.map((c) => c.name)).toContain('utils');
      expect(children.map((c) => c.name)).toContain('index.ts');
    });

    it('should get ancestors of a node', async () => {
      const helpersNode = await store.getNodeByPath(rootId, '/src/utils/helpers.ts');
      const ancestors = await store.getAncestors(helpersNode!.id);

      expect(ancestors).toHaveLength(2);
      expect(ancestors[0].name).toBe('src');
      expect(ancestors[1].name).toBe('utils');
    });

    it('should get descendants of a node', async () => {
      const descendants = await store.getDescendants(srcId);

      expect(descendants).toHaveLength(4); // utils, helpers.ts, format.ts, index.ts
      expect(descendants.map((d) => d.name)).toContain('utils');
      expect(descendants.map((d) => d.name)).toContain('helpers.ts');
    });

    it('should get descendants with max depth', async () => {
      const descendants = await store.getDescendants(srcId, { maxDepth: 1 });

      expect(descendants).toHaveLength(2); // Only utils and index.ts
    });

    it('should get subtree as nested structure', async () => {
      const subtree = await store.getSubtree(srcId);

      expect(subtree.name).toBe('src');
      expect(subtree.children).toHaveLength(2);

      const utilsChild = subtree.children.find((c) => c.name === 'utils');
      expect(utilsChild).toBeDefined();
      expect(utilsChild?.children).toHaveLength(2);
    });

    it('should filter descendants by node type', async () => {
      const files = await store.getDescendants(srcId, { nodeTypes: ['file'] });

      expect(files).toHaveLength(3);
      expect(files.every((f) => f.nodeType === 'file')).toBe(true);
    });
  });

  describe('Chunk Linking', () => {
    let rootId: string;
    let nodeId: string;

    beforeEach(async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'Test',
        rootPath: '/',
      });
      rootId = root.id;

      const node = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'test.ts',
        path: '/test.ts',
      });
      nodeId = node.id;
    });

    it('should link and unlink chunks', async () => {
      const chunkId = 'chunk-123';

      await store.linkChunk(nodeId, chunkId);
      let node = await store.getNode(nodeId);
      expect(node?.chunkId).toBe(chunkId);

      await store.unlinkChunk(nodeId);
      node = await store.getNode(nodeId);
      expect(node?.chunkId).toBeUndefined();
    });

    it('should get chunks in subtree', async () => {
      const parent = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'dir',
        path: '/dir',
      });

      const child1 = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'a.ts',
        path: '/dir/a.ts',
        parentId: parent.id,
        chunkId: 'chunk-a',
      });

      const child2 = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'b.ts',
        path: '/dir/b.ts',
        parentId: parent.id,
        chunkId: 'chunk-b',
      });

      const chunks = await store.getChunksInSubtree(parent.id);

      expect(chunks).toHaveLength(2);
      expect(chunks).toContain('chunk-a');
      expect(chunks).toContain('chunk-b');
    });

    it('should get nodes by chunk ID', async () => {
      const chunkId = 'shared-chunk';

      await store.linkChunk(nodeId, chunkId);

      const nodes = await store.getNodesByChunkId(chunkId);

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe(nodeId);
    });
  });

  describe('Statistics', () => {
    let rootId: string;

    beforeEach(async () => {
      const root = await store.createRoot({
        treeType: 'code',
        name: 'Test',
        rootPath: '/',
      });
      rootId = root.id;

      // Create nodes at various depths
      const src = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'src',
        path: '/src',
      });

      const utils = await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'directory',
        name: 'utils',
        path: '/src/utils',
        parentId: src.id,
      });

      await store.createNode({
        treeType: 'code',
        treeRootId: rootId,
        nodeType: 'file',
        name: 'helper.ts',
        path: '/src/utils/helper.ts',
        parentId: utils.id,
      });
    });

    it('should count nodes', async () => {
      const count = await store.countNodes(rootId);
      expect(count).toBe(3);
    });

    it('should get depth statistics', async () => {
      const stats = await store.getDepthStats(rootId);

      expect(stats.maxDepth).toBe(3);
      expect(stats.avgDepth).toBeGreaterThan(0);
    });
  });
});
