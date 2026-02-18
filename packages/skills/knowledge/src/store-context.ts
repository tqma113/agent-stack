/**
 * Store Context Management
 *
 * Manages the singleton knowledge manager instance for the skill.
 */

import {
  createKnowledgeManager,
  type KnowledgeManagerInstance,
} from '@ai-stack/knowledge';
import { createSqliteStores, type SemanticStoreInstance } from '@ai-stack/memory-store-sqlite';

let knowledgeManager: KnowledgeManagerInstance | null = null;
let semanticStore: SemanticStoreInstance | null = null;

/**
 * Get or create the knowledge manager
 */
export async function getKnowledgeContext(): Promise<{
  manager: KnowledgeManagerInstance;
  store: SemanticStoreInstance;
}> {
  if (!knowledgeManager || !semanticStore) {
    // Get database path from environment or use default
    const dbPath = process.env.KNOWLEDGE_DB_PATH || process.env.MEMORY_DB_PATH || '.ai-stack/memory.db';
    const rootDir = process.env.KNOWLEDGE_ROOT_DIR || '.';

    // Create SQLite stores and initialize
    const stores = await createSqliteStores({ dbPath });
    await stores.initialize();
    semanticStore = stores.semanticStore;

    // Create knowledge manager
    knowledgeManager = createKnowledgeManager({
      code: {
        enabled: true,
        rootDir,
        include: ['**/*.{ts,tsx,js,jsx,py,java,go,rs,c,cpp,h,hpp,md,json}'],
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
        ],
      },
      doc: {
        enabled: true,
      },
      search: {
        defaultWeights: { fts: 0.3, vector: 0.7 },
        defaultLimit: 10,
      },
    });

    // Initialize first (creates indexers), then set store
    await knowledgeManager.initialize();
    knowledgeManager.setStore(semanticStore);
  }

  return {
    manager: knowledgeManager,
    store: semanticStore,
  };
}

/**
 * Close the knowledge context
 */
export async function closeKnowledgeContext(): Promise<void> {
  if (knowledgeManager) {
    await knowledgeManager.close();
    knowledgeManager = null;
    semanticStore = null;
  }
}
