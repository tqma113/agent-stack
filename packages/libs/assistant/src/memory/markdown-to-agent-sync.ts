/**
 * @ai-stack/assistant - Markdown to Agent Memory Sync
 *
 * Synchronizes content from Markdown memory (MEMORY.md) to Agent memory system.
 * Uses content hashing for incremental sync - only changed content is synced.
 */

import { createHash } from 'crypto';
import type { MemoryDocument, FactItem, TodoItem, ProfileSection } from '../types.js';
import type { MemoryManagerInstance, EventInput, ProfileItemInput } from '@ai-stack/memory';

/**
 * Sync result
 */
export interface SyncResult {
  /** Number of facts added */
  factsAdded: number;
  /** Number of facts skipped (unchanged) */
  factsSkipped: number;
  /** Number of todos added */
  todosAdded: number;
  /** Number of todos skipped (unchanged) */
  todosSkipped: number;
  /** Number of profile items updated */
  profileUpdated: number;
  /** Whether notes were synced */
  notesAdded: boolean;
  /** Total duration in ms */
  durationMs: number;
}

/**
 * Sync state for tracking previously synced content
 */
export interface SyncState {
  /** Map of ID -> content hash for facts */
  factHashes: Map<string, string>;
  /** Map of ID -> content hash for todos */
  todoHashes: Map<string, string>;
  /** Map of profile key -> content hash */
  profileHashes: Map<string, string>;
  /** Hash of notes content */
  notesHash?: string;
  /** Last sync timestamp */
  lastSyncAt?: number;
}

/**
 * Create initial empty sync state
 */
export function createSyncState(): SyncState {
  return {
    factHashes: new Map(),
    todoHashes: new Map(),
    profileHashes: new Map(),
    notesHash: undefined,
    lastSyncAt: undefined,
  };
}

/**
 * Calculate hash of content
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Serialize a fact item for hashing
 */
function serializeFact(fact: FactItem): string {
  return JSON.stringify({
    content: fact.content,
    confidence: fact.confidence,
    source: fact.source,
  });
}

/**
 * Serialize a todo item for hashing
 */
function serializeTodo(todo: TodoItem): string {
  return JSON.stringify({
    content: todo.content,
    completed: todo.completed,
    priority: todo.priority,
    dueDate: todo.dueDate?.toISOString(),
  });
}

/**
 * Serialize profile section for hashing
 */
function serializeProfile(profile: ProfileSection): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(profile)) {
    if (value !== undefined) {
      result.set(key, JSON.stringify(value));
    }
  }
  return result;
}

/**
 * Sync Markdown memory document to Agent memory
 *
 * @param doc - Parsed markdown memory document
 * @param memoryManager - Agent memory manager instance
 * @param state - Sync state for tracking changes (will be modified)
 * @param debug - Enable debug logging
 * @returns Sync result
 */
export async function syncMarkdownToAgentMemory(
  doc: MemoryDocument,
  memoryManager: MemoryManagerInstance,
  state: SyncState,
  debug = false
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    factsAdded: 0,
    factsSkipped: 0,
    todosAdded: 0,
    todosSkipped: 0,
    profileUpdated: 0,
    notesAdded: false,
    durationMs: 0,
  };

  // Sync profile items
  const profileSerialized = serializeProfile(doc.profile);
  for (const [key, serialized] of profileSerialized) {
    const hash = hashContent(serialized);
    const existingHash = state.profileHashes.get(key);

    if (existingHash !== hash) {
      if (debug) {
        console.log(`[sync] Updating profile: ${key}`);
      }
      try {
        const profileItem: ProfileItemInput = {
          key,
          value: doc.profile[key],
          confidence: 1.0,
          explicit: true,
        };
        await memoryManager.setProfile(profileItem);
        state.profileHashes.set(key, hash);
        result.profileUpdated++;
      } catch (error) {
        if (debug) {
          console.error(`[sync] Failed to set profile ${key}:`, error);
        }
      }
    }
  }

  // Sync facts
  for (const fact of doc.facts) {
    const serialized = serializeFact(fact);
    const hash = hashContent(serialized);
    const existingHash = state.factHashes.get(fact.id);

    if (existingHash !== hash) {
      if (debug) {
        console.log(`[sync] Adding fact: ${fact.id}`);
      }
      try {
        const event: EventInput = {
          type: 'MEMORY_WRITE',
          sessionId: 'markdown-sync',
          intent: 'sync-fact',
          summary: fact.content,
          entities: [],
          payload: {
            factId: fact.id,
            content: fact.content,
            confidence: fact.confidence,
            source: fact.source || 'markdown',
          },
          links: [],
          tags: ['fact', 'markdown-sync'],
        };
        await memoryManager.recordEvent(event);
        state.factHashes.set(fact.id, hash);
        result.factsAdded++;
      } catch (error) {
        if (debug) {
          console.error(`[sync] Failed to record fact ${fact.id}:`, error);
        }
      }
    } else {
      result.factsSkipped++;
    }
  }

  // Sync todos
  for (const todo of doc.todos) {
    const serialized = serializeTodo(todo);
    const hash = hashContent(serialized);
    const existingHash = state.todoHashes.get(todo.id);

    if (existingHash !== hash) {
      if (debug) {
        console.log(`[sync] Adding todo: ${todo.id}`);
      }
      try {
        const event: EventInput = {
          type: 'MEMORY_WRITE',
          sessionId: 'markdown-sync',
          intent: 'sync-todo',
          summary: `Todo: ${todo.content}`,
          entities: [],
          payload: {
            todoId: todo.id,
            content: todo.content,
            completed: todo.completed,
            priority: todo.priority,
            dueDate: todo.dueDate?.toISOString(),
          },
          links: [],
          tags: ['todo', 'markdown-sync', todo.completed ? 'completed' : 'pending'],
        };
        await memoryManager.recordEvent(event);
        state.todoHashes.set(todo.id, hash);
        result.todosAdded++;
      } catch (error) {
        if (debug) {
          console.error(`[sync] Failed to record todo ${todo.id}:`, error);
        }
      }
    } else {
      result.todosSkipped++;
    }
  }

  // Sync notes as semantic chunks (if notes exist and changed)
  if (doc.notes && doc.notes.trim()) {
    const notesHash = hashContent(doc.notes);
    if (state.notesHash !== notesHash) {
      if (debug) {
        console.log('[sync] Adding notes as semantic chunk');
      }
      try {
        await memoryManager.addChunk({
          text: doc.notes,
          tags: ['notes', 'markdown-sync'],
          sourceType: 'markdown',
          sessionId: 'markdown-sync',
        });
        state.notesHash = notesHash;
        result.notesAdded = true;
      } catch (error) {
        if (debug) {
          console.error('[sync] Failed to add notes chunk:', error);
        }
      }
    }
  }

  state.lastSyncAt = Date.now();
  result.durationMs = Date.now() - startTime;

  if (debug) {
    console.log(`[sync] Complete: ${result.factsAdded} facts, ${result.todosAdded} todos, ${result.profileUpdated} profile items in ${result.durationMs}ms`);
  }

  return result;
}

/**
 * Check if a full sync is needed (for initial sync or state recovery)
 */
export function needsFullSync(state: SyncState): boolean {
  return state.lastSyncAt === undefined ||
    (state.factHashes.size === 0 && state.todoHashes.size === 0 && state.profileHashes.size === 0);
}

/**
 * Reset sync state (for forcing a full re-sync)
 */
export function resetSyncState(state: SyncState): void {
  state.factHashes.clear();
  state.todoHashes.clear();
  state.profileHashes.clear();
  state.notesHash = undefined;
  state.lastSyncAt = undefined;
}
