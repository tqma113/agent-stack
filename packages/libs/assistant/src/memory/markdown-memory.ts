/**
 * @ai-stack/assistant - Markdown Memory
 *
 * Main memory system that combines Markdown files with SQLite index.
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
import type {
  MarkdownMemoryConfig,
  MemoryDocument,
  FactItem,
  TodoItem,
  DailyLogEntry,
  MemorySearchResult,
  MemoryQueryOptions,
  SyncStatus,
} from './types.js';

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
  /** Search memory */
  search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]>;

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
  } = config;

  let index: SqliteIndexInstance | null = null;
  let syncEngine: SyncEngineInstance | null = null;
  let initialized = false;

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

  return {
    async initialize(): Promise<void> {
      if (initialized) return;

      ensureDirectories();

      // Create SQLite index
      index = createSqliteIndex(dbPath);

      // Create sync engine
      syncEngine = createSyncEngine({
        memoryFile,
        logsDir,
        index,
        syncOnStartup,
        watchFiles,
      });

      await syncEngine.initialize();
      initialized = true;
    },

    async close(): Promise<void> {
      if (syncEngine) {
        await syncEngine.close();
        syncEngine = null;
      }
      index = null;
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
  };
}
