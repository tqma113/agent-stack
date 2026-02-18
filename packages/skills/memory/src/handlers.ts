/**
 * @ai-stack/skill-memory - Handler Implementations
 *
 * Implements the search, upsert, and delete handlers for the memory skill.
 */

import { getStoreContext } from './store-context.js';
import {
  validateSearchParams,
  validateUpsertParams,
  validateDeleteParams,
  type SearchParams,
  type SearchResult,
  type UpsertParams,
  type UpsertResult,
  type DeleteParams,
  type DeleteResult,
} from './schema.js';
import type {
  EventInput,
  ProfileItemInput,
  SemanticChunkInput,
  SummaryInput,
  TaskState,
  TaskStateUpdate,
} from '@ai-stack/memory-store-sqlite';

/**
 * Search memory across multiple layers
 */
export async function search(args: Record<string, unknown>): Promise<string> {
  const params = validateSearchParams(args);
  const ctx = await getStoreContext();

  const layers = params.layers || ['events', 'profiles', 'semantic', 'summaries', 'tasks'];
  const limit = params.limit || 10;
  const result: SearchResult = {
    results: [],
    totalCount: 0,
    query: params.query,
  };

  // Search each layer
  for (const layer of layers) {
    try {
      const layerResult = await searchLayer(ctx, layer, params, limit);
      result.results.push(layerResult);
      result.totalCount += layerResult.count;
    } catch (error) {
      // Log error but continue with other layers
      console.warn(`[MemorySkill] Error searching ${layer}:`, (error as Error).message);
    }
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Search a single layer
 */
async function searchLayer(
  ctx: Awaited<ReturnType<typeof getStoreContext>>,
  layer: string,
  params: SearchParams,
  limit: number
): Promise<{ layer: string; count: number; items: unknown[] }> {
  let items: unknown[] = [];

  switch (layer) {
    case 'events': {
      const events = await ctx.events.query({
        sessionId: params.sessionId,
        tags: params.tags,
        limit,
      });
      items = events;
      break;
    }

    case 'profiles': {
      const profiles = await ctx.profiles.getAll();
      // Filter by query if provided
      if (params.query) {
        const query = params.query.toLowerCase();
        items = profiles.filter(
          (p) =>
            p.key.toLowerCase().includes(query) ||
            JSON.stringify(p.value).toLowerCase().includes(query)
        );
      } else {
        items = profiles;
      }
      items = items.slice(0, limit);
      break;
    }

    case 'semantic': {
      if (params.query) {
        const results = await ctx.semantic.search(params.query, {
          sessionId: params.sessionId,
          tags: params.tags,
          limit,
        });
        items = results;
      } else {
        // Return recent chunks if no query
        // Note: We need to query without search - just get recent
        items = [];
      }
      break;
    }

    case 'summaries': {
      const summaries = await ctx.summaries.list({
        sessionId: params.sessionId,
        limit,
      });
      items = summaries;
      break;
    }

    case 'tasks': {
      const tasks = await ctx.tasks.list({
        sessionId: params.sessionId,
        limit,
      });
      items = tasks;
      break;
    }
  }

  return {
    layer,
    count: items.length,
    items,
  };
}

/**
 * Create or update memory entries
 */
export async function upsert(args: Record<string, unknown>): Promise<string> {
  const params = validateUpsertParams(args);
  const ctx = await getStoreContext();

  let result: UpsertResult;

  switch (params.layer) {
    case 'event': {
      const eventData = params.data as Partial<EventInput>;
      const event = await ctx.events.add({
        type: eventData.type || 'SYSTEM',
        summary: eventData.summary || '',
        payload: eventData.payload || {},
        sessionId: params.sessionId || eventData.sessionId,
        intent: eventData.intent,
        entities: eventData.entities || [],
        links: eventData.links || [],
        tags: eventData.tags || [],
        parentId: eventData.parentId,
      });
      result = {
        success: true,
        layer: 'event',
        id: event.id,
        action: 'created',
      };
      break;
    }

    case 'profile': {
      const profileData = params.data as Partial<ProfileItemInput>;
      if (!profileData.key) {
        throw new Error('Profile key is required');
      }
      const existing = await ctx.profiles.get(profileData.key);
      const profile = await ctx.profiles.set({
        key: profileData.key,
        value: profileData.value,
        confidence: profileData.confidence ?? 0.8,
        explicit: profileData.explicit ?? true,
        sourceEventId: profileData.sourceEventId,
        expiresAt: profileData.expiresAt,
      });
      result = {
        success: true,
        layer: 'profile',
        id: profile.key,
        action: existing ? 'updated' : 'created',
      };
      break;
    }

    case 'semantic': {
      const chunkData = params.data as Partial<SemanticChunkInput>;
      if (!chunkData.text) {
        throw new Error('Semantic chunk text is required');
      }
      const chunk = await ctx.semantic.add({
        text: chunkData.text,
        tags: chunkData.tags || [],
        sessionId: params.sessionId || chunkData.sessionId,
        sourceEventId: chunkData.sourceEventId,
        sourceType: chunkData.sourceType,
        metadata: chunkData.metadata,
        embedding: chunkData.embedding,
      });
      result = {
        success: true,
        layer: 'semantic',
        id: chunk.id,
        action: 'created',
      };
      break;
    }

    case 'summary': {
      const summaryData = params.data as Partial<SummaryInput>;
      if (!summaryData.short || !summaryData.sessionId) {
        throw new Error('Summary short text and sessionId are required');
      }
      const summary = await ctx.summaries.add({
        sessionId: params.sessionId || summaryData.sessionId,
        short: summaryData.short,
        bullets: summaryData.bullets || [],
        decisions: summaryData.decisions || [],
        todos: summaryData.todos || [],
        coveredEventIds: summaryData.coveredEventIds || [],
        tokenCount: summaryData.tokenCount,
      });
      result = {
        success: true,
        layer: 'summary',
        id: summary.id,
        action: 'created',
      };
      break;
    }

    case 'task': {
      const taskData = params.data as Partial<TaskState & TaskStateUpdate>;

      // Check if updating existing task
      if (taskData.id) {
        const existing = await ctx.tasks.get(taskData.id);
        if (existing) {
          const updated = await ctx.tasks.update(taskData.id, {
            goal: taskData.goal,
            status: taskData.status,
            constraints: taskData.constraints,
            plan: taskData.plan,
            done: taskData.done,
            blocked: taskData.blocked,
            nextAction: taskData.nextAction,
            metadata: taskData.metadata,
            actionId: taskData.actionId,
          });
          result = {
            success: true,
            layer: 'task',
            id: updated.id,
            action: 'updated',
          };
          break;
        }
      }

      // Create new task
      if (!taskData.goal) {
        throw new Error('Task goal is required');
      }
      const task = await ctx.tasks.create({
        goal: taskData.goal,
        status: taskData.status || 'pending',
        constraints: taskData.constraints || [],
        plan: taskData.plan || [],
        done: taskData.done || [],
        blocked: taskData.blocked || [],
        nextAction: taskData.nextAction,
        sessionId: params.sessionId || taskData.sessionId,
        metadata: taskData.metadata,
      });
      result = {
        success: true,
        layer: 'task',
        id: task.id,
        action: 'created',
      };
      break;
    }

    default:
      throw new Error(`Unknown layer: ${params.layer}`);
  }

  return JSON.stringify(result, null, 2);
}

/**
 * Delete memory entries
 */
async function deleteEntries(args: Record<string, unknown>): Promise<string> {
  const params = validateDeleteParams(args);
  const ctx = await getStoreContext();

  let deletedCount = 0;

  switch (params.layer) {
    case 'events': {
      if (params.filter.id) {
        const deleted = await ctx.events.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.ids && params.filter.ids.length > 0) {
        deletedCount = await ctx.events.deleteBatch(params.filter.ids);
      } else if (params.filter.sessionId) {
        deletedCount = await ctx.events.deleteBySession(params.filter.sessionId);
      } else if (params.filter.beforeTimestamp) {
        deletedCount = await ctx.events.deleteBeforeTimestamp(params.filter.beforeTimestamp);
      }
      break;
    }

    case 'profiles': {
      if (params.filter.key) {
        const deleted = await ctx.profiles.delete(params.filter.key);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.id) {
        const deleted = await ctx.profiles.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      }
      break;
    }

    case 'semantic': {
      if (params.filter.id) {
        const deleted = await ctx.semantic.delete(params.filter.id);
        deletedCount = deleted ? 1 : 0;
      } else if (params.filter.sessionId) {
        deletedCount = await ctx.semantic.deleteBySession(params.filter.sessionId);
      }
      break;
    }

    case 'summaries':
    case 'tasks': {
      // These stores don't have delete methods exposed yet
      // Could add them if needed
      console.warn(`[MemorySkill] Delete not implemented for ${params.layer} layer`);
      break;
    }
  }

  const result: DeleteResult = {
    success: deletedCount > 0,
    layer: params.layer,
    deletedCount,
  };

  return JSON.stringify(result, null, 2);
}

// Export delete with proper name (delete is a reserved word)
export { deleteEntries as delete };
