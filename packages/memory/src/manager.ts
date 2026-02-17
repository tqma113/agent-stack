/**
 * @agent-stack/memory - Memory Manager
 *
 * Main entry point for the memory system.
 */

import Database from 'better-sqlite3';
import type {
  IMemoryManager,
  MemoryConfig,
  MemoryBundle,
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
  ObserverCallback,
  UUID,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import {
  EventStore,
  TaskStateStore,
  SummaryStore,
  ProfileStore,
  SemanticStore,
  type EmbedFunction,
} from './stores/index.js';
import { MemoryObserver } from './observer.js';
import { MemoryRetriever } from './retriever.js';
import { MemoryInjector } from './injector.js';
import { MemoryBudgeter } from './budgeter.js';
import { WritePolicyEngine } from './write-policy.js';
import { MemorySummarizer } from './summarizer.js';
import { MemoryError, StoreInitializationError } from './errors.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Memory Manager - orchestrates all memory components
 */
export class MemoryManager implements IMemoryManager {
  private db: Database.Database | null = null;
  private config: MemoryConfig;
  private initialized = false;

  // Stores
  private eventStore: EventStore;
  private taskStateStore: TaskStateStore;
  private summaryStore: SummaryStore;
  private profileStore: ProfileStore;
  private semanticStore: SemanticStore;

  // Components
  private observer: MemoryObserver;
  private retriever!: MemoryRetriever;
  private injector: MemoryInjector;
  private budgeter: MemoryBudgeter;
  private writePolicy: WritePolicyEngine;
  private summarizer: MemorySummarizer;

  // Event tracking for auto-summarization
  private unsummarizedEventCount = 0;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };

    // Initialize stores
    this.eventStore = new EventStore();
    this.taskStateStore = new TaskStateStore();
    this.summaryStore = new SummaryStore();
    this.profileStore = new ProfileStore();
    this.semanticStore = new SemanticStore();

    // Initialize components
    this.observer = new MemoryObserver();
    this.injector = new MemoryInjector();
    this.budgeter = new MemoryBudgeter(this.config.tokenBudget);
    this.writePolicy = new WritePolicyEngine(this.config.writePolicy);
    this.summarizer = new MemorySummarizer();
  }

  /**
   * Initialize the memory manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.config.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Open database
      this.db = new Database(this.config.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // Initialize stores with database
      const stores = [
        this.eventStore,
        this.taskStateStore,
        this.summaryStore,
        this.profileStore,
        this.semanticStore,
      ];

      for (const store of stores) {
        store.setDatabase(this.db);
        await store.initialize();
      }

      // Initialize retriever with stores
      this.retriever = new MemoryRetriever(
        {
          eventStore: this.eventStore,
          taskStateStore: this.taskStateStore,
          summaryStore: this.summaryStore,
          profileStore: this.profileStore,
          semanticStore: this.semanticStore,
        },
        this.config.retrieval,
        this.config.tokenBudget
      );

      this.initialized = true;

      if (this.config.debug) {
        console.log(`[MemoryManager] Initialized with database: ${this.config.dbPath}`);
      }
    } catch (error) {
      throw new StoreInitializationError(
        'MemoryManager',
        (error as Error).message,
        error as Error
      );
    }
  }

  /**
   * Close the memory manager
   */
  async close(): Promise<void> {
    if (!this.initialized) return;

    // Close all stores
    await this.eventStore.close();
    await this.taskStateStore.close();
    await this.summaryStore.close();
    await this.profileStore.close();
    await this.semanticStore.close();

    // Close database
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.initialized = false;

    if (this.config.debug) {
      console.log('[MemoryManager] Closed');
    }
  }

  /**
   * Ensure manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new MemoryError('MemoryManager not initialized. Call initialize() first.', 'NOT_INITIALIZED');
    }
  }

  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.observer.getSessionId();
  }

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    this.observer.setSessionId(sessionId);
    this.unsummarizedEventCount = 0;
  }

  /**
   * Start a new session
   */
  newSession(): string {
    const sessionId = crypto.randomUUID();
    this.setSessionId(sessionId);
    return sessionId;
  }

  // ==========================================================================
  // Event Operations
  // ==========================================================================

  /**
   * Record an event
   */
  async recordEvent(input: EventInput): Promise<MemoryEvent> {
    this.ensureInitialized();

    const event = await this.eventStore.add(input);

    // Notify subscribers
    await this.observer.notify(event);

    // Check if should write to long-term memory
    const writeDecision = this.writePolicy.decideWrite(event);
    if (writeDecision.shouldWrite) {
      await this.processWriteDecision(event, writeDecision);
    }

    // Check if should auto-summarize
    this.unsummarizedEventCount++;
    const summarizeCheck = this.writePolicy.shouldSummarize(
      this.unsummarizedEventCount,
      0 // TODO: track token count
    );
    if (summarizeCheck.should && event.sessionId) {
      await this.summarize(event.sessionId);
      this.unsummarizedEventCount = 0;
    }

    if (this.config.debug) {
      console.log(`[MemoryManager] Recorded event: ${event.type} - ${event.summary}`);
    }

    return event;
  }

  /**
   * Subscribe to events
   */
  onEvent(callback: ObserverCallback): () => void {
    return this.observer.subscribe(callback);
  }

  /**
   * Get observer for creating events
   */
  getObserver(): MemoryObserver {
    return this.observer;
  }

  // ==========================================================================
  // Task Operations
  // ==========================================================================

  /**
   * Create a task
   */
  async createTask(
    task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>
  ): Promise<TaskState> {
    this.ensureInitialized();

    const created = await this.taskStateStore.create({
      ...task,
      sessionId: task.sessionId || this.observer.getSessionId(),
    });

    // Record state change event
    await this.recordEvent(
      this.observer.createStateChangeEvent('none', created.status, 'Task created')
    );

    if (this.config.debug) {
      console.log(`[MemoryManager] Created task: ${created.id} - ${created.goal}`);
    }

    return created;
  }

  /**
   * Update task state
   */
  async updateTask(id: UUID, update: TaskStateUpdate): Promise<TaskState> {
    this.ensureInitialized();

    const before = await this.taskStateStore.get(id);
    const updated = await this.taskStateStore.update(id, update);

    // Record state change if status changed
    if (before && before.status !== updated.status) {
      await this.recordEvent(
        this.observer.createStateChangeEvent(before.status, updated.status)
      );
    }

    if (this.config.debug) {
      console.log(`[MemoryManager] Updated task: ${id} - v${updated.version}`);
    }

    return updated;
  }

  /**
   * Get current task
   */
  async getCurrentTask(sessionId?: string): Promise<TaskState | null> {
    this.ensureInitialized();
    return this.taskStateStore.getCurrent(sessionId || this.observer.getSessionId());
  }

  // ==========================================================================
  // Profile Operations
  // ==========================================================================

  /**
   * Set profile item
   */
  async setProfile(input: ProfileItemInput): Promise<ProfileItem> {
    this.ensureInitialized();

    // Validate key
    this.writePolicy.validateProfileKey(input.key);

    // Check for conflicts
    const existing = await this.profileStore.get(input.key);
    if (existing) {
      const resolution = this.writePolicy.resolveConflict(input.key, existing, input as ProfileItem);
      if (resolution.needsReview) {
        // TODO: Handle conflict review
        console.warn(`[MemoryManager] Profile conflict needs review: ${input.key}`);
      }
    }

    const item = await this.profileStore.set(input);

    if (this.config.debug) {
      console.log(`[MemoryManager] Set profile: ${input.key} = ${JSON.stringify(input.value)}`);
    }

    return item;
  }

  /**
   * Get profile item
   */
  async getProfile(key: string): Promise<ProfileItem | null> {
    this.ensureInitialized();
    return this.profileStore.get(key);
  }

  /**
   * Get all profile items
   */
  async getAllProfiles(): Promise<ProfileItem[]> {
    this.ensureInitialized();
    return this.profileStore.getAll();
  }

  // ==========================================================================
  // Retrieval
  // ==========================================================================

  /**
   * Retrieve memory bundle
   */
  async retrieve(options?: {
    sessionId?: string;
    query?: string;
    taskId?: UUID;
  }): Promise<MemoryBundle> {
    this.ensureInitialized();

    const bundle = await this.retriever.retrieve({
      sessionId: options?.sessionId || this.observer.getSessionId(),
      query: options?.query,
      taskId: options?.taskId,
    });

    if (this.config.debug) {
      console.log(
        `[MemoryManager] Retrieved bundle: ${bundle.profile.length} profile, ` +
          `${bundle.recentEvents.length} events, ${bundle.retrievedChunks.length} chunks`
      );
    }

    return bundle;
  }

  /**
   * Inject memory bundle into prompt format
   */
  inject(bundle: MemoryBundle): string {
    return this.injector.inject(bundle);
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  /**
   * Generate summary
   */
  async summarize(sessionId: string): Promise<Summary> {
    this.ensureInitialized();

    // Get events since last summary
    const lastSummary = await this.summaryStore.getLatest(sessionId);
    const since = lastSummary?.timestamp || 0;

    const events = await this.eventStore.query({
      sessionId,
      since,
    });

    // Generate summary
    const summaryInput = await this.summarizer.summarize(events, sessionId, lastSummary || undefined);
    const summary = await this.summaryStore.add(summaryInput);

    if (this.config.debug) {
      console.log(`[MemoryManager] Generated summary: ${summary.short}`);
    }

    return summary;
  }

  // ==========================================================================
  // Semantic
  // ==========================================================================

  /**
   * Add semantic chunk
   */
  async addChunk(input: SemanticChunkInput): Promise<SemanticChunk> {
    this.ensureInitialized();

    const chunk = await this.semanticStore.add({
      ...input,
      sessionId: input.sessionId || this.observer.getSessionId(),
    });

    if (this.config.debug) {
      console.log(`[MemoryManager] Added chunk: ${chunk.id} (${chunk.text.length} chars)`);
    }

    return chunk;
  }

  /**
   * Search semantic memory
   */
  async searchChunks(
    query: string,
    options?: {
      tags?: string[];
      sessionId?: string;
      limit?: number;
    }
  ): Promise<SemanticSearchResult[]> {
    this.ensureInitialized();
    return this.semanticStore.search(query, options);
  }

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  /**
   * Process write decision
   */
  private async processWriteDecision(
    event: MemoryEvent,
    decision: { targetLayers: Array<'profile' | 'semantic' | 'summary'> }
  ): Promise<void> {
    for (const layer of decision.targetLayers) {
      switch (layer) {
        case 'semantic':
          await this.semanticStore.add({
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

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }

  /**
   * Get budget utilization
   */
  async getBudgetUtilization(): Promise<ReturnType<MemoryBudgeter['getUtilization']>> {
    this.ensureInitialized();
    const bundle = await this.retrieve();
    return this.budgeter.getUtilization(bundle);
  }

  /**
   * Clear all memory data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    await this.eventStore.clear();
    await this.taskStateStore.clear();
    await this.summaryStore.clear();
    await this.profileStore.clear();
    await this.semanticStore.clear();

    this.unsummarizedEventCount = 0;

    if (this.config.debug) {
      console.log('[MemoryManager] Cleared all memory data');
    }
  }

  // ==========================================================================
  // Embedding Configuration
  // ==========================================================================

  /**
   * Set the embedding function for automatic vector generation
   *
   * This enables automatic hybrid search (FTS + Vector) without manually providing embeddings.
   * When set, chunks added via addChunk() will automatically generate embeddings,
   * and searchChunks() will automatically use vector search.
   *
   * @example
   * ```typescript
   * // Using OpenAI embeddings
   * const openai = new OpenAI();
   * memory.setEmbedFunction(async (text) => {
   *   const response = await openai.embeddings.create({
   *     model: 'text-embedding-3-small',
   *     input: text,
   *   });
   *   return response.data[0].embedding;
   * });
   *
   * // Or using @agent-stack/provider
   * const client = new OpenAIClient();
   * memory.setEmbedFunction(async (text) => {
   *   const result = await client.embed(text);
   *   return result[0].embedding;
   * });
   * ```
   */
  setEmbedFunction(fn: EmbedFunction): void {
    this.semanticStore.setEmbedFunction(fn);

    if (this.config.debug) {
      console.log('[MemoryManager] Embed function set - hybrid search enabled');
    }
  }

  /**
   * Check if automatic embedding is available
   */
  hasEmbedFunction(): boolean {
    return this.semanticStore.hasEmbedFunction();
  }

  /**
   * Check if vector search is enabled
   */
  isVectorSearchEnabled(): boolean {
    return this.semanticStore.isVectorEnabled();
  }

  /**
   * Get the semantic store for advanced operations
   */
  getSemanticStore(): SemanticStore {
    return this.semanticStore;
  }
}
