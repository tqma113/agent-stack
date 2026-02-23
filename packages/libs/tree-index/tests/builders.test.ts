/**
 * @ai-stack/tree-index - Builders Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { createCodeTreeBuilder, type CodeBlock } from '../src/builders/code-tree-builder.js';
import { createDocTreeBuilder, type DocSource } from '../src/builders/doc-tree-builder.js';
import { createEventTreeBuilder, type SessionInput } from '../src/builders/event-tree-builder.js';
import { createTaskTreeBuilder, type TaskStateInput } from '../src/builders/task-tree-builder.js';

describe('CodeTreeBuilder', () => {
  let db: Database.Database;
  let builder: ReturnType<typeof createCodeTreeBuilder>;

  beforeEach(() => {
    db = new Database(':memory:');
    builder = createCodeTreeBuilder();
    builder.setDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should build a code tree from blocks', async () => {
    const blocks: CodeBlock[] = [
      { filePath: '/src/index.ts', language: 'typescript' },
      { filePath: '/src/utils/helpers.ts', language: 'typescript' },
      { filePath: '/src/utils/format.ts', language: 'typescript' },
      { filePath: '/lib/core.ts', language: 'typescript' },
    ];

    const root = await builder.build(blocks);
    const store = builder.getTreeStore();

    expect(root).toBeDefined();
    expect(root.treeType).toBe('code');

    // Verify structure
    const srcNode = await store.getNodeByPath(root.id, '/src');
    expect(srcNode).toBeDefined();
    expect(srcNode?.nodeType).toBe('directory');

    const utilsNode = await store.getNodeByPath(root.id, '/src/utils');
    expect(utilsNode).toBeDefined();

    const helpersNode = await store.getNodeByPath(root.id, '/src/utils/helpers.ts');
    expect(helpersNode).toBeDefined();
    expect(helpersNode?.nodeType).toBe('file');
  });

  it('should include symbol nodes when configured', async () => {
    const blocks: CodeBlock[] = [
      { filePath: '/src/index.ts' },
      { filePath: '/src/index.ts', symbolName: 'main', symbolKind: 'function' },
      { filePath: '/src/index.ts', symbolName: 'Config', symbolKind: 'interface' },
    ];

    const root = await builder.build(blocks, { includeSymbols: true });
    const store = builder.getTreeStore();

    const mainNode = await store.getNodeByPath(root.id, '/src/index.ts/main');
    expect(mainNode).toBeDefined();
    expect(mainNode?.nodeType).toBe('function');

    const configNode = await store.getNodeByPath(root.id, '/src/index.ts/Config');
    expect(configNode).toBeDefined();
    expect(configNode?.nodeType).toBe('interface');
  });

  it('should ignore specified patterns', async () => {
    const blocks: CodeBlock[] = [
      { filePath: '/src/index.ts' },
      { filePath: '/node_modules/lib/index.ts' },
      { filePath: '/.git/config' },
    ];

    const root = await builder.build(blocks, {
      ignorePatterns: ['node_modules', '.git'],
    });
    const store = builder.getTreeStore();

    const srcNode = await store.getNodeByPath(root.id, '/src');
    expect(srcNode).toBeDefined();

    const nodeModulesNode = await store.getNodeByPath(root.id, '/node_modules');
    expect(nodeModulesNode).toBeNull();

    const gitNode = await store.getNodeByPath(root.id, '/.git');
    expect(gitNode).toBeNull();
  });
});

describe('DocTreeBuilder', () => {
  let db: Database.Database;
  let builder: ReturnType<typeof createDocTreeBuilder>;

  beforeEach(() => {
    db = new Database(':memory:');
    builder = createDocTreeBuilder();
    builder.setDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should build a document tree from pages', async () => {
    const source: DocSource = {
      sourceId: 'docs-1',
      name: 'API Documentation',
      baseUrl: 'https://docs.example.com',
      pages: [
        {
          url: '/getting-started',
          title: 'Getting Started',
          sections: [
            { heading: 'Installation', level: 1 },
            { heading: 'Configuration', level: 1 },
          ],
        },
        {
          url: '/api-reference',
          title: 'API Reference',
        },
      ],
    };

    const root = await builder.build(source);
    const store = builder.getTreeStore();

    expect(root).toBeDefined();
    expect(root.treeType).toBe('doc');
    expect(root.name).toBe('API Documentation');

    // Verify structure
    const sourceNode = await store.getNodeByPath(root.id, '/');
    expect(sourceNode).toBeDefined();
    expect(sourceNode?.nodeType).toBe('source');

    const gettingStartedNode = await store.getNodeByPath(root.id, '/getting-started');
    expect(gettingStartedNode).toBeDefined();
    expect(gettingStartedNode?.nodeType).toBe('page');
  });

  it('should include sections when configured', async () => {
    const source: DocSource = {
      sourceId: 'docs-1',
      name: 'Docs',
      baseUrl: 'https://docs.example.com',
      pages: [
        {
          url: '/guide',
          title: 'Guide',
          sections: [
            {
              heading: 'Overview',
              level: 1,
              anchor: 'overview',
              children: [
                { heading: 'Features', level: 2, anchor: 'features' },
              ],
            },
          ],
        },
      ],
    };

    const root = await builder.build(source, { includeSections: true });
    const store = builder.getTreeStore();

    const overviewNode = await store.getNodeByPath(root.id, '/guide/overview');
    expect(overviewNode).toBeDefined();
    expect(overviewNode?.nodeType).toBe('heading');

    const featuresNode = await store.getNodeByPath(root.id, '/guide/overview/features');
    expect(featuresNode).toBeDefined();
    expect(featuresNode?.nodeType).toBe('section');
  });
});

describe('EventTreeBuilder', () => {
  let db: Database.Database;
  let builder: ReturnType<typeof createEventTreeBuilder>;

  beforeEach(() => {
    db = new Database(':memory:');
    builder = createEventTreeBuilder();
    builder.setDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should build an event tree from session', async () => {
    const session: SessionInput = {
      sessionId: 'session-1',
      name: 'Test Session',
      startedAt: Date.now() - 3600000,
      events: [
        { id: 'e1', type: 'user_message', timestamp: Date.now() - 3000000, content: 'Hello' },
        { id: 'e2', type: 'assistant_message', timestamp: Date.now() - 2000000, content: 'Hi there!' },
        { id: 'e3', type: 'tool_call', timestamp: Date.now() - 1000000, content: 'search', actor: 'web_search' },
      ],
    };

    const root = await builder.build(session);
    const store = builder.getTreeStore();

    expect(root).toBeDefined();
    expect(root.treeType).toBe('event');

    const sessionNode = await store.getNodeByPath(root.id, '/');
    expect(sessionNode).toBeDefined();
    expect(sessionNode?.nodeType).toBe('session');

    // Check events
    const descendants = await store.getDescendants(sessionNode!.id);
    expect(descendants).toHaveLength(3);
  });

  it('should add events to existing session', async () => {
    const session: SessionInput = {
      sessionId: 'session-1',
      name: 'Test Session',
      startedAt: Date.now(),
      events: [
        { id: 'e1', type: 'user_message', timestamp: Date.now(), content: 'Hello' },
      ],
    };

    const root = await builder.build(session);
    const store = builder.getTreeStore();
    const sessionNode = await store.getNodeByPath(root.id, '/');

    // Add more events
    const added = await builder.addEvents(root.id, sessionNode!.id, [
      { id: 'e2', type: 'assistant_message', timestamp: Date.now(), content: 'Hi!' },
    ]);

    expect(added).toBe(1);

    const descendants = await store.getDescendants(sessionNode!.id);
    expect(descendants).toHaveLength(2);
  });
});

describe('TaskTreeBuilder', () => {
  let db: Database.Database;
  let builder: ReturnType<typeof createTaskTreeBuilder>;

  beforeEach(() => {
    db = new Database(':memory:');
    builder = createTaskTreeBuilder();
    builder.setDatabase(db);
  });

  afterEach(() => {
    db.close();
  });

  it('should build a task tree', async () => {
    const task: TaskStateInput = {
      taskId: 'task-1',
      goal: 'Implement user authentication',
      status: 'in_progress',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now(),
      steps: [
        { id: 's1', description: 'Set up auth provider', status: 'completed', order: 0 },
        { id: 's2', description: 'Create login page', status: 'in_progress', order: 1 },
        { id: 's3', description: 'Add logout functionality', status: 'pending', order: 2 },
      ],
    };

    const root = await builder.build(task);
    const store = builder.getTreeStore();

    expect(root).toBeDefined();
    expect(root.treeType).toBe('task');

    const taskNode = await store.getNodeByPath(root.id, '/');
    expect(taskNode).toBeDefined();
    expect(taskNode?.nodeType).toBe('task');

    const steps = await store.getChildren(taskNode!.id);
    expect(steps).toHaveLength(3);
  });

  it('should handle nested steps', async () => {
    const task: TaskStateInput = {
      taskId: 'task-1',
      goal: 'Build feature',
      status: 'in_progress',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: [
        {
          id: 's1',
          description: 'Main step',
          status: 'in_progress',
          order: 0,
          subSteps: [
            { id: 's1-1', description: 'Sub step 1', status: 'completed', order: 0 },
            { id: 's1-2', description: 'Sub step 2', status: 'pending', order: 1 },
          ],
        },
      ],
    };

    const root = await builder.build(task);
    const store = builder.getTreeStore();

    const mainStep = await store.getNodeByPath(root.id, '/s1');
    expect(mainStep).toBeDefined();
    expect(mainStep?.nodeType).toBe('subtask');

    const subSteps = await store.getChildren(mainStep!.id);
    expect(subSteps).toHaveLength(2);
  });

  it('should update task status', async () => {
    const task: TaskStateInput = {
      taskId: 'task-1',
      goal: 'Test task',
      status: 'in_progress',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: [],
    };

    const root = await builder.build(task);
    const store = builder.getTreeStore();
    const taskNode = await store.getNodeByPath(root.id, '/');

    await builder.updateTaskStatus(root.id, taskNode!.id, 'completed');

    const updated = await store.getNode(taskNode!.id);
    expect(updated?.metadata?.taskStatus).toBe('completed');
    expect(updated?.metadata?.completedAt).toBeDefined();
  });
});
