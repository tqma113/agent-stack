/**
 * @ai-stack/memory - Memory Manager
 *
 * Main entry point for the memory system.
 * Accepts externally injected stores for flexibility.
 */

import type {
  ISemanticStore,
  EmbedFunction,
  MemoryEvent,
  EventInput,
  TaskState,
  TaskStateUpdate,
  ProfileItem,
  ProfileItemInput,
  Summary,
  SemanticChunk,
  SemanticChunkInput,
  SemanticSearchResult,
  UUID,
} from '@ai-stack/memory-store-sqlite';
import type {
  IMemoryManager,
  MemoryConfig,
  MemoryBundle,
  ObserverCallback,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import { createMemoryObserver, type IMemoryObserver } from './observer.js';
import { createMemoryRetriever, type IMemoryRetriever } from './retriever.js';
import { createMemoryInjector, type IMemoryInjector } from './injector.js';
import { createMemoryBudgeter, type IMemoryBudgeter } from './budgeter.js';
import { createWritePolicyEngine, type IWritePolicyEngine } from './write-policy.js';
import { createMemorySummarizer, type IMemorySummarizer } from './summarizer.js';
import { MemoryStoreError } from '@ai-stack/memory-store-sqlite';
import type { MemoryStores } from './stores-interface.js';

/**
 * Extended semantic store interface with optional embed function
 */
interface ExtendedSemanticStore extends ISemanticStore {
  setEmbedFunction?(fn: EmbedFunction): void;
  hasEmbedFunction?(): boolean;
  isVectorEnabled?(): boolean;
}

/**
 * Memory Manager instance type (returned by factory)
 */
export interface MemoryManagerInstance extends IMemoryManager {
  // Session Management
  getSessionId(): string;
  setSessionId(sessionId: string): void;
  newSession(): string;

  // Event Operations
  recordEvent(input: EventInput): Promise<MemoryEvent>;
  onEvent(callback: ObserverCallback): () => void;
  getObserver(): IMemoryObserver;

  // Task Operations
  createTask(task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState>;
  updateTask(id: UUID, update: TaskStateUpdate): Promise<TaskState>;
  getCurrentTask(sessionId?: string): Promise<TaskState | null>;

  // Profile Operations
  setProfile(input: ProfileItemInput): Promise<ProfileItem>;
  getProfile(key: string): Promise<ProfileItem | null>;
  getAllProfiles(): Promise<ProfileItem[]>;

  // Retrieval
  retrieve(options?: {
    sessionId?: string;
    query?: string;
    taskId?: UUID;
  }): Promise<MemoryBundle>;
  inject(bundle: MemoryBundle): string;

  // Summary
  summarize(sessionId: string): Promise<Summary>;

  // Semantic
  addChunk(input: SemanticChunkInput): Promise<SemanticChunk>;
  searchChunks(
    query: string,
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]>;

  // Utility
  getConfig(): MemoryConfig;
  getBudgetUtilization(): Promise<ReturnType<IMemoryBudgeter['getUtilization']>>;
  clear(): Promise<void>;

  // Embedding Configuration
  setEmbedFunction(fn: EmbedFunction): void;
  hasEmbedFunction(): boolean;
  isVectorSearchEnabled(): boolean;
  getSemanticStore(): ISemanticStore;
}

/**
 * Memory manager configuration (without dbPath since stores are injected)
 */
export type MemoryManagerConfig = Omit<MemoryConfig, 'dbPath'>;

/**
 * Create a Memory Manager instance
 *
 * @param stores - Externally created stores (from createSqliteStores or createJsonStores)
 * @param config - Optional configuration overrides
 *
 * @example
 * ```typescript
 * // Using SQLite stores (high performance)
 * import { createSqliteStores } from '@ai-stack/memory-store-sqlite';  
 * const stores = await createSqliteStores({ dbPath: './memory/sqlite.db' });
 * const memory = createMemoryManager(stores);
 * await memory.initialize();
 *
 * // Using JSON stores (zero native deps)
 * import { createJsonStores } from '@ai-stack/memory-store-json';
 * const stores = await createJsonStores({ basePath: './.agent-memory' });
 * const memory = createMemoryManager(stores);
 * await memory.initialize();
 * ```
 */
export function createMemoryManager(
  stores: MemoryStores,
  config: Partial<MemoryManagerConfig> = {}
): MemoryManagerInstance {
  // Merge config (excluding dbPath which is no longer used)
  const { dbPath: _, ...defaultConfigWithoutDb } = DEFAULT_MEMORY_CONFIG;
  const mergedConfig: MemoryManagerConfig = { ...defaultConfigWithoutDb, ...config };
  let initialized = false;

  // Extract stores
  const {
    eventStore,
    taskStateStore,
    summaryStore,
    profileStore,
    semanticStore,
  } = stores;

  // Cast to extended type for optional methods
  const extendedSemanticStore = semanticStore as ExtendedSemanticStore;

  // Components
  const observer: IMemoryObserver = createMemoryObserver();
  let retriever: IMemoryRetriever | null = null;
  const injector: IMemoryInjector = createMemoryInjector();
  const budgeter: IMemoryBudgeter = createMemoryBudgeter(mergedConfig.tokenBudget);
  const writePolicy: IWritePolicyEngine = createWritePolicyEngine(mergedConfig.writePolicy);
  const summarizer: IMemorySummarizer = createMemorySummarizer();

  // Event tracking for auto-summarization
  let unsummarizedEventCount = 0;

  /**
   * Ensure manager is initialized
   */
  function ensureInitialized(): void {
    if (!initialized) {
      throw new MemoryStoreError('MemoryManager not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }
  }

  /**
   * Process write decision
   */
  async function processWriteDecision(
    event: MemoryEvent,
    decision: { targetLayers: Array<'profile' | 'semantic' | 'summary'> }
  ): Promise<void> {
    for (const layer of decision.targetLayers) {
      switch (layer) {
        case 'semantic':
          await semanticStore.add({
            text: event.summary,
            tags: event.tags,
            sourceEventId: event.id,
            sourceType: event.type,
            sessionId: event.sessionId,
          });
          break;

        // Profile and summary are handled elsewhere
        case 'profile':
        case 'summary':
          break;
      }
    }
  }

  // Return the instance object
  const instance: MemoryManagerInstance = {
    // ==========================================================================
    // Initialization
    // ==========================================================================

    async initialize(): Promise<void> {
      if (initialized) return;

      // Initialize stores (they may already be initialized, but this is idempotent)
      await stores.initialize();

      // Initialize retriever with stores
      retriever = createMemoryRetriever(
        {
          eventStore,
          taskStateStore,
          summaryStore,
          profileStore,
          semanticStore,
        },
        mergedConfig.retrieval,
        mergedConfig.tokenBudget
      );

      initialized = true;

      if (mergedConfig.debug) {
        console.log('[MemoryManager] Initialized with injected stores');
      }
    },

    async close(): Promise<void> {
      if (!initialized) return;

      // Close stores
      await stores.close();

      initialized = false;

      if (mergedConfig.debug) {
        console.log('[MemoryManager] Closed');
      }
    },

    // ==========================================================================
    // Session Management
    // ==========================================================================

    getSessionId(): string {
      return observer.getSessionId();
    },

    setSessionId(sessionId: string): void {
      observer.setSessionId(sessionId);
      unsummarizedEventCount = 0;
    },

    newSession(): string {
      const sessionId = crypto.randomUUID();
      instance.setSessionId(sessionId);
      return sessionId;
    },

    // ==========================================================================
    // Event Operations
    // ==========================================================================

    async recordEvent(input: EventInput): Promise<MemoryEvent> {
      ensureInitialized();

      const event = await eventStore.add(input);

      // Notify subscribers
      await observer.notify(event);

      // Check if should write to long-term memory
      const writeDecision = writePolicy.decideWrite(event);
      if (writeDecision.shouldWrite) {
        await processWriteDecision(event, writeDecision);
      }

      // Check if should auto-summarize
      unsummarizedEventCount++;
      const summarizeCheck = writePolicy.shouldSummarize(
        unsummarizedEventCount,
        0 // TODO: track token count
      );
      if (summarizeCheck.should && event.sessionId) {
        await instance.summarize(event.sessionId);
        unsummarizedEventCount = 0;
      }

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Recorded event: ${event.type} - ${event.summary}`);
      }

      return event;
    },

    onEvent(callback: ObserverCallback): () => void {
      return observer.subscribe(callback);
    },

    getObserver(): IMemoryObserver {
      return observer;
    },

    // ==========================================================================
    // Task Operations
    // ==========================================================================

    async createTask(
      task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>
    ): Promise<TaskState> {
      ensureInitialized();

      const created = await taskStateStore.create({
        ...task,
        sessionId: task.sessionId || observer.getSessionId(),
      });

      // Record state change event
      await instance.recordEvent(
        observer.createStateChangeEvent('none', created.status, 'Task created')
      );

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Created task: ${created.id} - ${created.goal}`);
      }

      return created;
    },

    async updateTask(id: UUID, update: TaskStateUpdate): Promise<TaskState> {
      ensureInitialized();

      const before = await taskStateStore.get(id);
      const updated = await taskStateStore.update(id, update);

      // Record state change if status changed
      if (before && before.status !== updated.status) {
        await instance.recordEvent(
          observer.createStateChangeEvent(before.status, updated.status)
        );
      }

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Updated task: ${id} - v${updated.version}`);
      }

      return updated;
    },

    async getCurrentTask(sessionId?: string): Promise<TaskState | null> {
      ensureInitialized();
      return taskStateStore.getCurrent(sessionId || observer.getSessionId());
    },

    // ==========================================================================
    // Profile Operations
    // ==========================================================================

    async setProfile(input: ProfileItemInput): Promise<ProfileItem> {
      ensureInitialized();

      // Validate key
      writePolicy.validateProfileKey(input.key);

      // Check for conflicts
      const existing = await profileStore.get(input.key);
      if (existing) {
        const resolution = writePolicy.resolveConflict(input.key, existing, input as ProfileItem);
        if (resolution.needsReview) {
          // TODO: Handle conflict review
          console.warn(`[MemoryManager] Profile conflict needs review: ${input.key}`);
        }
      }

      const item = await profileStore.set(input);

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Set profile: ${input.key} = ${JSON.stringify(input.value)}`);
      }

      return item;
    },

    async getProfile(key: string): Promise<ProfileItem | null> {
      ensureInitialized();
      return profileStore.get(key);
    },

    async getAllProfiles(): Promise<ProfileItem[]> {
      ensureInitialized();
      return profileStore.getAll();
    },

    // ==========================================================================
    // Retrieval
    // ==========================================================================

    async retrieve(options?: {
      sessionId?: string;
      query?: string;
      taskId?: UUID;
    }): Promise<MemoryBundle> {
      ensureInitialized();

      if (!retriever) {
        throw new MemoryStoreError('Retriever not initialized', 'NOT_INITIALIZED');
      }

      const bundle = await retriever.retrieve({
        sessionId: options?.sessionId || observer.getSessionId(),
        query: options?.query,
        taskId: options?.taskId,
      });

      if (mergedConfig.debug) {
        console.log(
          `[MemoryManager] Retrieved bundle: ${bundle.profile.length} profile, ` +
            `${bundle.recentEvents.length} events, ${bundle.retrievedChunks.length} chunks`
        );
      }

      return bundle;
    },

    inject(bundle: MemoryBundle): string {
      return injector.inject(bundle);
    },

    // ==========================================================================
    // Summary
    // ==========================================================================

    async summarize(sessionId: string): Promise<Summary> {
      ensureInitialized();

      // Get events since last summary
      const lastSummary = await summaryStore.getLatest(sessionId);
      const since = lastSummary?.timestamp || 0;

      const events = await eventStore.query({
        sessionId,
        since,
      });

      // Generate summary
      const summaryInput = await summarizer.summarize(events, sessionId, lastSummary || undefined);
      const summary = await summaryStore.add(summaryInput);

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Generated summary: ${summary.short}`);
      }

      return summary;
    },

    // ==========================================================================
    // Semantic
    // ==========================================================================

    async addChunk(input: SemanticChunkInput): Promise<SemanticChunk> {
      ensureInitialized();

      const chunk = await semanticStore.add({
        ...input,
        sessionId: input.sessionId || observer.getSessionId(),
      });

      if (mergedConfig.debug) {
        console.log(`[MemoryManager] Added chunk: ${chunk.id} (${chunk.text.length} chars)`);
      }

      return chunk;
    },

    async searchChunks(
      query: string,
      options?: {
        tags?: string[];
        sessionId?: string;
        limit?: number;
      }
    ): Promise<SemanticSearchResult[]> {
      ensureInitialized();
      return semanticStore.search(query, options);
    },

    // ==========================================================================
    // Utility Methods
    // ==========================================================================

    getConfig(): MemoryConfig {
      // Return config with a placeholder dbPath since it's no longer used
      return { ...mergedConfig, dbPath: '(injected stores)' };
    },

    async getBudgetUtilization(): Promise<ReturnType<IMemoryBudgeter['getUtilization']>> {
      ensureInitialized();
      const bundle = await instance.retrieve();
      return budgeter.getUtilization(bundle);
    },

    async clear(): Promise<void> {
      ensureInitialized();
      await stores.clear();
      unsummarizedEventCount = 0;

      if (mergedConfig.debug) {
        console.log('[MemoryManager] Cleared all memory data');
      }
    },

    // ==========================================================================
    // Embedding Configuration
    // ==========================================================================

    setEmbedFunction(fn: EmbedFunction): void {
      if (extendedSemanticStore.setEmbedFunction) {
        extendedSemanticStore.setEmbedFunction(fn);

        if (mergedConfig.debug) {
          console.log('[MemoryManager] Embed function set - hybrid search enabled');
        }
      }
    },

    hasEmbedFunction(): boolean {
      return extendedSemanticStore.hasEmbedFunction?.() ?? false;
    },

    isVectorSearchEnabled(): boolean {
      return extendedSemanticStore.isVectorEnabled?.() ?? false;
    },

    getSemanticStore(): ISemanticStore {
      return semanticStore;
    },
  };

  return instance;
}
