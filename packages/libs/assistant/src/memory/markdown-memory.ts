/**
 * @ai-stack/assistant - Markdown Memory
 *
 * Main memory system that combines Markdown files with SQLite index.
 * Supports optional vector search via SemanticStore integration.
 */

import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createSqliteIndex, type SqliteIndexInstance } from './sqlite-index.js';
import { createSyncEngine, type SyncEngineInstance } from './sync-engine.js';
import { parseMemoryFile } from './markdown-parser.js';
import {
  writeMemoryFile,
  addFact,
  removeFact,
  addTodo,
  updateTodo,
  removeTodo,
  updateProfile,
  appendNotes,
} from './markdown-writer.js';
import { mergeHybridResults } from './hybrid-merge.js';
import type {
  MarkdownMemoryConfig,
  MemoryDocument,
  FactItem,
  TodoItem,
  DailyLogEntry,
  MemorySearchResult,
  MemoryQueryOptions,
  SyncStatus,
  HybridSearchOptions,
  SearchMode,
} from './types.js';

// Optional imports for vector search
import {
  createSemanticStore,
  createDatabase,
  type SemanticStoreInstance,
  type EmbedFunction,
} from '@ai-stack/memory-store-sqlite';

/**
 * Markdown Memory Instance
 */
export interface MarkdownMemoryInstance {
  /** Initialize memory system */
  initialize(): Promise<void>;
  /** Close memory system */
  close(): Promise<void>;

  // Sync Operations
  /** Force sync Markdown files to index */
  sync(): Promise<SyncStatus>;
  /** Get sync status */
  getSyncStatus(): SyncStatus;
  /** Start watching for file changes */
  startWatching(): void;
  /** Stop watching for file changes */
  stopWatching(): void;

  // Search
  /** Search memory (BM25 only) */
  search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]>;
  /** Hybrid search with optional vector search */
  searchHybrid(query: string, options?: HybridSearchOptions): Promise<MemorySearchResult[]>;

  // Vector Search Configuration
  /** Set embedding function for vector search */
  setEmbedFunction(fn: EmbedFunction): void;
  /** Check if vector search is enabled and ready */
  isVectorSearchReady(): boolean;

  // Memory Document Access
  /** Get the current memory document */
  getDocument(): MemoryDocument | null;
  /** Get profile value */
  getProfile(key: string): unknown;
  /** Get all facts */
  getFacts(): FactItem[];
  /** Get all todos */
  getTodos(): TodoItem[];

  // Mutations
  /** Add a fact */
  addFact(content: string): Promise<FactItem>;
  /** Remove a fact */
  removeFact(factId: string): Promise<boolean>;
  /** Add a todo */
  addTodo(content: string, priority?: 'high' | 'medium' | 'low'): Promise<TodoItem>;
  /** Update a todo */
  updateTodo(todoId: string, update: Partial<TodoItem>): Promise<boolean>;
  /** Complete a todo */
  completeTodo(todoId: string): Promise<boolean>;
  /** Remove a todo */
  removeTodo(todoId: string): Promise<boolean>;
  /** Update profile */
  setProfile(key: string, value: unknown): Promise<void>;
  /** Append notes */
  addNotes(notes: string): Promise<void>;

  // Conversation Logging
  /** Log a user message */
  logUserMessage(content: string): Promise<void>;
  /** Log an assistant message */
  logAssistantMessage(content: string): Promise<void>;
  /** Log a tool call */
  logToolCall(toolName: string, result: string): Promise<void>;

  // Context Generation
  /** Generate memory context for prompt injection */
  getMemoryContext(): string;

  // Internal Access (for sync engine)
  /** Get the semantic store instance (if vector search is enabled) */
  getSemanticStore(): SemanticStoreInstance | null;
}

/**
 * Create a Markdown Memory instance
 */
export function createMarkdownMemory(config: MarkdownMemoryConfig): MarkdownMemoryInstance {
  const {
    memoryFile = 'MEMORY.md',
    logsDir = 'memory',
    dbPath = 'index.db',
    syncOnStartup = true,
    watchFiles = true,
    // Vector search config
    enableVectorSearch = false,
    embeddingProvider = 'openai',
    embeddingModel = 'text-embedding-3-small',
    vectorDimensions = 1536,
    embeddingBaseURL,
    searchWeights = { fts: 0.3, vector: 0.7 },
  } = config;

  let index: SqliteIndexInstance | null = null;
  let syncEngine: SyncEngineInstance | null = null;
  let initialized = false;

  // Vector search state
  let semanticStore: SemanticStoreInstance | null = null;
  let embedFunction: EmbedFunction | null = null;
  let vectorSearchReady = false;

  // Ensure directories exist
  function ensureDirectories(): void {
    const memoryDir = dirname(memoryFile);
    if (memoryDir && !existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    const dbDir = dirname(dbPath);
    if (dbDir && !existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
  }

  /**
   * Create embedding function based on provider config
   */
  async function createEmbedFunction(): Promise<EmbedFunction | null> {
    try {
      if (embeddingProvider === 'openai' || embeddingProvider === 'openai-compatible') {
        const { createOpenAIClient } = await import('@ai-stack/provider');
        const client = createOpenAIClient({
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: embeddingBaseURL,
        });
        return async (text: string): Promise<number[]> => {
          const results = await client.embed(text, { model: embeddingModel, dimensions: vectorDimensions });
          return results[0].embedding;
        };
      } else if (embeddingProvider === 'google') {
        const { createGoogleAdapter } = await import('@ai-stack/provider');
        const adapter = createGoogleAdapter({
          provider: 'google',
          apiKey: process.env.GOOGLE_API_KEY,
        });
        if (adapter.embed) {
          return async (text: string): Promise<number[]> => {
            const results = await adapter.embed!(text, { model: embeddingModel });
            return results[0].embedding;
          };
        }
      }
    } catch (error) {
      console.warn('[MarkdownMemory] Failed to create embedding function:', (error as Error).message);
    }
    return null;
  }

  /**
   * Initialize semantic store for vector search
   */
  async function initializeVectorSearch(): Promise<void> {
    if (!enableVectorSearch) return;

    try {
      // Create database instance - use separate DB for vector search to avoid conflicts
      const vectorDbPath = dbPath.replace('.db', '-vector.db');
      const dbInstance = createDatabase({ path: vectorDbPath, enableVec: true });

      // Create semantic store
      semanticStore = createSemanticStore({
        vectorDimensions,
        enableVectorSearch: true,
        enableFtsSearch: false, // We use SqliteIndex for FTS
        embeddingCache: { enabled: true },
        embeddingProvider,
        embeddingModel,
      });
      semanticStore.setDatabase(dbInstance.db);
      await semanticStore.initialize();

      // Create embedding function
      embedFunction = await createEmbedFunction();
      if (embedFunction) {
        semanticStore.setEmbedFunction(embedFunction);
        vectorSearchReady = true;
        console.log('[MarkdownMemory] Vector search initialized successfully');
      } else {
        console.warn('[MarkdownMemory] Vector search enabled but no embedding function available');
      }
    } catch (error) {
      console.warn('[MarkdownMemory] Failed to initialize vector search:', (error as Error).message);
      semanticStore = null;
      vectorSearchReady = false;
    }
  }

  return {
    async initialize(): Promise<void> {
      if (initialized) return;

      ensureDirectories();

      // Create SQLite index (for BM25/FTS search)
      index = createSqliteIndex(dbPath);

      // Initialize vector search if enabled
      await initializeVectorSearch();

      // Create sync engine with optional semantic store
      syncEngine = createSyncEngine({
        memoryFile,
        logsDir,
        index,
        syncOnStartup,
        watchFiles,
        semanticStore: semanticStore ?? undefined,
        embedFunction: embedFunction ?? undefined,
        embeddingProvider,
        embeddingModel,
      });

      await syncEngine.initialize();
      initialized = true;
    },

    async close(): Promise<void> {
      if (syncEngine) {
        await syncEngine.close();
        syncEngine = null;
      }
      if (semanticStore) {
        await semanticStore.close();
        semanticStore = null;
      }
      index = null;
      vectorSearchReady = false;
      initialized = false;
    },

    async sync(): Promise<SyncStatus> {
      if (!syncEngine) throw new Error('Memory not initialized');
      return syncEngine.sync();
    },

    getSyncStatus(): SyncStatus {
      if (!syncEngine) {
        return { itemCount: 0, inProgress: false };
      }
      return syncEngine.getStatus();
    },

    startWatching(): void {
      syncEngine?.startWatching();
    },

    stopWatching(): void {
      syncEngine?.stopWatching();
    },

    async search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]> {
      if (!index) throw new Error('Memory not initialized');
      return index.search(query, options);
    },

    async searchHybrid(query: string, options?: HybridSearchOptions): Promise<MemorySearchResult[]> {
      if (!index) throw new Error('Memory not initialized');

      // Determine search mode
      const mode: SearchMode = options?.mode ?? (vectorSearchReady ? 'hybrid' : 'bm25');
      const weights = options?.weights ?? searchWeights;
      const limit = options?.limit ?? 10;

      // BM25 only mode
      if (mode === 'bm25' || !vectorSearchReady) {
        return index.search(query, options);
      }

      // Vector only mode
      if (mode === 'vector' && semanticStore && embedFunction) {
        try {
          const queryEmbedding = await embedFunction(query);
          const results = await semanticStore.searchVector(queryEmbedding, { limit: limit * 2 });

          // Convert SemanticSearchResult to MemorySearchResult
          return results.slice(0, limit).map((r) => ({
            type: (r.chunk.metadata?.type as 'fact' | 'todo' | 'log' | 'note') ?? 'note',
            content: r.chunk.text,
            score: r.score,
            source: (r.chunk.metadata?.source as string) ?? 'unknown',
            timestamp: r.chunk.timestamp ? new Date(r.chunk.timestamp) : undefined,
            metadata: r.chunk.metadata,
          }));
        } catch (error) {
          console.warn('[MarkdownMemory] Vector search failed, falling back to BM25:', (error as Error).message);
          return index.search(query, options);
        }
      }

      // Hybrid mode: combine BM25 and vector results
      if (mode === 'hybrid' && semanticStore && embedFunction) {
        try {
          // Run BM25 and vector search in parallel
          const [bm25Results, vectorResults] = await Promise.all([
            index.search(query, { ...options, limit: limit * 2 }),
            (async () => {
              const queryEmbedding = await embedFunction!(query);
              const results = await semanticStore!.searchVector(queryEmbedding, { limit: limit * 2 });
              return results.map((r) => ({
                type: (r.chunk.metadata?.type as 'fact' | 'todo' | 'log' | 'note') ?? 'note',
                content: r.chunk.text,
                score: r.score,
                source: (r.chunk.metadata?.source as string) ?? 'unknown',
                timestamp: r.chunk.timestamp ? new Date(r.chunk.timestamp) : undefined,
                metadata: r.chunk.metadata,
              }));
            })(),
          ]);

          // Merge results
          const merged = mergeHybridResults(bm25Results, vectorResults, weights);
          return merged.slice(0, limit);
        } catch (error) {
          console.warn('[MarkdownMemory] Hybrid search failed, falling back to BM25:', (error as Error).message);
          return index.search(query, options);
        }
      }

      // Fallback to BM25
      return index.search(query, options);
    },

    setEmbedFunction(fn: EmbedFunction): void {
      embedFunction = fn;
      if (semanticStore) {
        semanticStore.setEmbedFunction(fn);
        vectorSearchReady = true;
      }
    },

    isVectorSearchReady(): boolean {
      return vectorSearchReady;
    },

    getDocument(): MemoryDocument | null {
      if (!syncEngine) return null;
      return syncEngine.getMemoryDocument();
    },

    getProfile(key: string): unknown {
      const doc = this.getDocument();
      return doc?.profile?.[key.toLowerCase()];
    },

    getFacts(): FactItem[] {
      const doc = this.getDocument();
      return doc?.facts ?? [];
    },

    getTodos(): TodoItem[] {
      const doc = this.getDocument();
      return doc?.todos ?? [];
    },

    async addFact(content: string): Promise<FactItem> {
      const fact = addFact(memoryFile, content);
      if (index) {
        await index.indexFact(fact, memoryFile);
      }
      return fact;
    },

    async removeFact(factId: string): Promise<boolean> {
      return removeFact(memoryFile, factId);
    },

    async addTodo(content: string, priority?: 'high' | 'medium' | 'low'): Promise<TodoItem> {
      const todo = addTodo(memoryFile, content, priority);
      if (index) {
        await index.indexTodo(todo, memoryFile);
      }
      return todo;
    },

    async updateTodo(todoId: string, update: Partial<TodoItem>): Promise<boolean> {
      return updateTodo(memoryFile, todoId, update);
    },

    async completeTodo(todoId: string): Promise<boolean> {
      return updateTodo(memoryFile, todoId, { completed: true });
    },

    async removeTodo(todoId: string): Promise<boolean> {
      return removeTodo(memoryFile, todoId);
    },

    async setProfile(key: string, value: unknown): Promise<void> {
      updateProfile(memoryFile, key, value);
      // Trigger sync to update index
      if (syncEngine) {
        await syncEngine.sync();
      }
    },

    async addNotes(notes: string): Promise<void> {
      appendNotes(memoryFile, notes);
      if (index) {
        await index.indexNote(notes, memoryFile);
      }
    },

    async logUserMessage(content: string): Promise<void> {
      if (!syncEngine) return;

      const entry: DailyLogEntry = {
        timestamp: new Date(),
        type: 'user',
        content,
      };

      await syncEngine.logEntry(entry);
    },

    async logAssistantMessage(content: string): Promise<void> {
      if (!syncEngine) return;

      const entry: DailyLogEntry = {
        timestamp: new Date(),
        type: 'assistant',
        content,
      };

      await syncEngine.logEntry(entry);
    },

    async logToolCall(toolName: string, result: string): Promise<void> {
      if (!syncEngine) return;

      const entry: DailyLogEntry = {
        timestamp: new Date(),
        type: 'tool',
        content: `**${toolName}**: ${result}`,
        metadata: { toolName },
      };

      await syncEngine.logEntry(entry);
    },

    getMemoryContext(): string {
      const doc = this.getDocument();
      if (!doc) return '';

      const sections: string[] = [];

      // Profile
      if (Object.keys(doc.profile).length > 0) {
        sections.push('## User Profile');
        for (const [key, value] of Object.entries(doc.profile)) {
          sections.push(`- **${key}**: ${value}`);
        }
        sections.push('');
      }

      // Active todos
      const activeTodos = doc.todos.filter((t) => !t.completed);
      if (activeTodos.length > 0) {
        sections.push('## Active Todos');
        for (const todo of activeTodos) {
          sections.push(`- ${todo.content}`);
        }
        sections.push('');
      }

      // Recent facts (last 5)
      const recentFacts = doc.facts.slice(-5);
      if (recentFacts.length > 0) {
        sections.push('## Known Facts');
        for (const fact of recentFacts) {
          sections.push(`- ${fact.content}`);
        }
        sections.push('');
      }

      return sections.join('\n');
    },

    getSemanticStore(): SemanticStoreInstance | null {
      return semanticStore;
    },
  };
}
