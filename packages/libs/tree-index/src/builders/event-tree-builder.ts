/**
 * @ai-stack/tree-index - Event Tree Builder
 *
 * Builds hierarchical tree structure from memory events (sessions and interactions).
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
import { joinPath } from '../utils/path-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Memory event type
 */
export type EventType = 'user_message' | 'assistant_message' | 'tool_call' | 'tool_result' | 'observation' | 'decision' | 'error';

/**
 * Memory event input
 */
export interface MemoryEventInput {
  /** Event ID */
  id: string;
  /** Event type */
  type: EventType;
  /** Event timestamp */
  timestamp: number;
  /** Event content/summary */
  content: string;
  /** Actor (user, assistant, tool name) */
  actor?: string;
  /** Related event ID (for tool results) */
  relatedEventId?: string;
  /** Semantic chunk ID (if indexed) */
  chunkId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session input
 */
export interface SessionInput {
  /** Session ID */
  sessionId: string;
  /** Session name/title */
  name?: string;
  /** Session start timestamp */
  startedAt: number;
  /** Session end timestamp (if ended) */
  endedAt?: number;
  /** Events in the session */
  events: MemoryEventInput[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Event tree builder configuration
 */
export interface EventTreeBuilderConfig {
  /** Group events by type */
  groupByType?: boolean;
  /** Maximum events per session to include */
  maxEventsPerSession?: number;
  /** Event types to include (empty = all) */
  includeEventTypes?: EventType[];
}

const DEFAULT_CONFIG: EventTreeBuilderConfig = {
  groupByType: false,
  maxEventsPerSession: 1000,
  includeEventTypes: [],
};

/**
 * Event tree builder instance
 */
export interface EventTreeBuilderInstance extends ITreeBuilder<SessionInput, EventTreeBuilderConfig> {
  /** Set the database instance */
  setDatabase(db: Database.Database): void;
  /** Get the tree store instance */
  getTreeStore(): TreeStoreInstance;
  /** Add events to existing session */
  addEvents(rootId: UUID, sessionNodeId: UUID, events: MemoryEventInput[]): Promise<number>;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an event tree builder
 */
export function createEventTreeBuilder(): EventTreeBuilderInstance {
  // Private state
  const treeStore = createTreeStore();

  // ============================================================================
  // Private Helpers
  // ============================================================================

  function eventTypeToNodeType(type: EventType): 'message' | 'action' | 'event' {
    switch (type) {
      case 'user_message':
      case 'assistant_message':
        return 'message';
      case 'tool_call':
      case 'tool_result':
        return 'action';
      default:
        return 'event';
    }
  }

  function formatEventName(event: MemoryEventInput): string {
    const time = new Date(event.timestamp).toLocaleTimeString();
    switch (event.type) {
      case 'user_message':
        return `[${time}] User: ${event.content.slice(0, 50)}...`;
      case 'assistant_message':
        return `[${time}] Assistant: ${event.content.slice(0, 50)}...`;
      case 'tool_call':
        return `[${time}] Tool: ${event.actor ?? 'unknown'}`;
      case 'tool_result':
        return `[${time}] Result: ${event.content.slice(0, 30)}...`;
      default:
        return `[${time}] ${event.type}: ${event.content.slice(0, 40)}...`;
    }
  }

  // ============================================================================
  // Build Implementation
  // ============================================================================

  async function build(
    source: SessionInput,
    config?: EventTreeBuilderConfig
  ): Promise<TreeRoot> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    try {
      // Ensure store is initialized
      await treeStore.initialize();

      // Create tree root
      const root = await treeStore.createRoot({
        treeType: 'event',
        name: source.name ?? `Session ${source.sessionId}`,
        rootPath: `/${source.sessionId}`,
        metadata: {
          sessionId: source.sessionId,
          startedAt: source.startedAt,
          endedAt: source.endedAt,
          ...source.metadata,
        },
      });

      // Create session node
      const sessionNode = await treeStore.createNode({
        treeType: 'event',
        treeRootId: root.id,
        nodeType: 'session',
        name: source.name ?? `Session ${source.sessionId}`,
        path: '/',
        metadata: {
          sessionId: source.sessionId,
          startedAt: source.startedAt,
          endedAt: source.endedAt,
          eventCount: source.events.length,
          ...source.metadata,
        },
      });

      // Filter events
      let events = source.events;
      if (cfg.includeEventTypes && cfg.includeEventTypes.length > 0) {
        events = events.filter((e) => cfg.includeEventTypes!.includes(e.type));
      }
      if (cfg.maxEventsPerSession) {
        events = events.slice(0, cfg.maxEventsPerSession);
      }

      // Sort events by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Build event nodes
      if (cfg.groupByType) {
        // Group by event type
        const typeGroups = new Map<EventType, MemoryEventInput[]>();
        for (const event of events) {
          const group = typeGroups.get(event.type) ?? [];
          group.push(event);
          typeGroups.set(event.type, group);
        }

        // Create type group nodes
        for (const [type, typeEvents] of typeGroups) {
          const groupPath = joinPath('/', type);
          const groupNode = await treeStore.createNode({
            treeType: 'event',
            treeRootId: root.id,
            nodeType: 'event',
            name: type,
            path: groupPath,
            parentId: sessionNode.id,
            metadata: { eventType: type, count: typeEvents.length },
          });

          // Create event nodes under group
          const eventInputs: TreeNodeInput[] = typeEvents.map((event, index) => ({
            treeType: 'event' as const,
            treeRootId: root.id,
            nodeType: eventTypeToNodeType(event.type),
            name: formatEventName(event),
            path: joinPath(groupPath, event.id),
            parentId: groupNode.id,
            sortOrder: index,
            chunkId: event.chunkId,
            metadata: {
              eventId: event.id,
              eventType: event.type,
              timestamp: event.timestamp,
              actor: event.actor,
              relatedEventId: event.relatedEventId,
              ...event.metadata,
            },
          }));

          await treeStore.createNodeBatch(eventInputs);
        }
      } else {
        // Flat list under session
        const eventInputs: TreeNodeInput[] = events.map((event, index) => ({
          treeType: 'event' as const,
          treeRootId: root.id,
          nodeType: eventTypeToNodeType(event.type),
          name: formatEventName(event),
          path: joinPath('/', event.id),
          parentId: sessionNode.id,
          sortOrder: index,
          chunkId: event.chunkId,
          metadata: {
            eventId: event.id,
            eventType: event.type,
            timestamp: event.timestamp,
            actor: event.actor,
            relatedEventId: event.relatedEventId,
            ...event.metadata,
          },
        }));

        await treeStore.createNodeBatch(eventInputs);
      }

      return root;
    } catch (error) {
      throw new TreeBuilderError(
        'EventTreeBuilder',
        `Failed to build event tree: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function addEvents(
    rootId: UUID,
    sessionNodeId: UUID,
    events: MemoryEventInput[]
  ): Promise<number> {
    try {
      const sessionNode = await treeStore.getNode(sessionNodeId);
      if (!sessionNode) {
        throw new Error(`Session node not found: ${sessionNodeId}`);
      }

      // Get current event count for sort order
      const descendants = await treeStore.getDescendants(sessionNodeId);
      let sortOrder = descendants.length;

      const eventInputs: TreeNodeInput[] = events.map((event, index) => ({
        treeType: 'event' as const,
        treeRootId: rootId,
        nodeType: eventTypeToNodeType(event.type),
        name: formatEventName(event),
        path: joinPath(sessionNode.path, event.id),
        parentId: sessionNodeId,
        sortOrder: sortOrder + index,
        chunkId: event.chunkId,
        metadata: {
          eventId: event.id,
          eventType: event.type,
          timestamp: event.timestamp,
          actor: event.actor,
          relatedEventId: event.relatedEventId,
          ...event.metadata,
        },
      }));

      const created = await treeStore.createNodeBatch(eventInputs);
      return created.length;
    } catch (error) {
      throw new TreeBuilderError(
        'EventTreeBuilder',
        `Failed to add events: ${(error as Error).message}`,
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
                error: 'Move operation not supported for events',
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
        'EventTreeBuilder',
        `Sync failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  async function rebuild(
    rootId: UUID,
    source: SessionInput,
    config?: EventTreeBuilderConfig
  ): Promise<TreeRoot> {
    try {
      // Delete existing root
      await treeStore.deleteRoot(rootId);

      // Build fresh
      return build(source, config);
    } catch (error) {
      throw new TreeBuilderError(
        'EventTreeBuilder',
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
    addEvents,
  };
}
