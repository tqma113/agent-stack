/**
 * Store Context Management
 *
 * Manages the singleton knowledge manager instance for the skill.
 * Knowledge now manages its own database and SemanticStore independently.
 */

import {
  createKnowledgeManager,
  type KnowledgeManagerInstance,
} from '@ai-stack/knowledge';

let knowledgeManager: KnowledgeManagerInstance | null = null;

/**
 * Get or create the knowledge manager
 */
export async function getKnowledgeContext(): Promise<{
  manager: KnowledgeManagerInstance;
}> {
  if (!knowledgeManager) {
    // Get config from environment or use defaults
    const knowledgeDbPath = process.env.KNOWLEDGE_DB_PATH || 'knowledge/sqlite.db';
    const rootDir = process.env.KNOWLEDGE_ROOT_DIR || '.';

    // Create knowledge manager with dbPath
    // Manager will auto-create database and SemanticStore during initialize()
    // In skill context, we use default 'incremental' action (no user interaction)
    knowledgeManager = createKnowledgeManager({
      dbPath: knowledgeDbPath,
      semantic: {
        vectorDimensions: 1536, // OpenAI text-embedding-3-small
        enableVectorSearch: true,
        enableFtsSearch: true,
      },
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
        defaultAction: 'incremental', // Skip user interaction
      },
      doc: {
        enabled: true,
        defaultAction: 'incremental',
      },
      search: {
        defaultWeights: { fts: 0.3, vector: 0.7 },
        defaultLimit: 10,
      },
    });

    // Initialize (creates database, SemanticStore, and indexers)
    await knowledgeManager.initialize();
  }

  return {
    manager: knowledgeManager,
  };
}

/**
 * Close the knowledge context
 */
export async function closeKnowledgeContext(): Promise<void> {
  if (knowledgeManager) {
    // Manager will close its own database and SemanticStore
    await knowledgeManager.close();
    knowledgeManager = null;
  }
}
