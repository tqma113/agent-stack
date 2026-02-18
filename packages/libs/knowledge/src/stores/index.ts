/**
 * @ai-stack/knowledge - Stores
 *
 * Persistent stores for knowledge indexing.
 */

export {
  createCodeIndexStore,
  type CodeIndexStoreInstance,
  type CodeIndexStatusRow,
} from './code-index-store.js';

export {
  createDocRegistryStore,
  type DocRegistryStoreInstance,
  type DocRegistrySummary,
} from './doc-registry-store.js';
