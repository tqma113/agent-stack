/**
 * @ai-stack/skill-memory - Schema Definitions
 *
 * JSON Schema definitions for the memory skill tools.
 */

/**
 * Search tool parameters
 */
export interface SearchParams {
  /** Search query text for semantic/FTS search */
  query?: string;
  /** Memory layers to search */
  layers?: Array<'events' | 'profiles' | 'semantic' | 'summaries' | 'tasks'>;
  /** Filter by session ID */
  sessionId?: string;
  /** Maximum results per layer */
  limit?: number;
  /** Filter by tags */
  tags?: string[];
}

/**
 * Search result for a single layer
 */
export interface LayerSearchResult {
  layer: string;
  count: number;
  items: unknown[];
}

/**
 * Combined search results
 */
export interface SearchResult {
  results: LayerSearchResult[];
  totalCount: number;
  query?: string;
}

/**
 * Upsert tool parameters
 */
export interface UpsertParams {
  /** Target memory layer */
  layer: 'event' | 'profile' | 'semantic' | 'summary' | 'task';
  /** Entry data */
  data: Record<string, unknown>;
  /** Session ID for the entry */
  sessionId?: string;
}

/**
 * Upsert result
 */
export interface UpsertResult {
  success: boolean;
  layer: string;
  id: string;
  action: 'created' | 'updated';
}

/**
 * Delete tool filter
 */
export interface DeleteFilter {
  /** Specific entry ID to delete */
  id?: string;
  /** Multiple entry IDs to delete */
  ids?: string[];
  /** Delete all entries for this session */
  sessionId?: string;
  /** Delete entries older than this timestamp */
  beforeTimestamp?: number;
  /** Profile key to delete (profiles layer only) */
  key?: string;
}

/**
 * Delete tool parameters
 */
export interface DeleteParams {
  /** Target memory layer */
  layer: 'events' | 'profiles' | 'semantic' | 'summaries' | 'tasks';
  /** Filter criteria */
  filter: DeleteFilter;
}

/**
 * Delete result
 */
export interface DeleteResult {
  success: boolean;
  layer: string;
  deletedCount: number;
}

/**
 * Validate search params
 */
export function validateSearchParams(params: unknown): SearchParams {
  if (typeof params !== 'object' || params === null) {
    return {};
  }

  const p = params as Record<string, unknown>;
  const result: SearchParams = {};

  if (typeof p.query === 'string') {
    result.query = p.query;
  }

  if (Array.isArray(p.layers)) {
    const validLayers = ['events', 'profiles', 'semantic', 'summaries', 'tasks'];
    result.layers = p.layers.filter((l): l is SearchParams['layers'][number] =>
      validLayers.includes(l as string)
    );
  }

  if (typeof p.sessionId === 'string') {
    result.sessionId = p.sessionId;
  }

  if (typeof p.limit === 'number' && p.limit > 0) {
    result.limit = Math.min(p.limit, 100); // Cap at 100
  }

  if (Array.isArray(p.tags)) {
    result.tags = p.tags.filter((t): t is string => typeof t === 'string');
  }

  return result;
}

/**
 * Validate upsert params
 */
export function validateUpsertParams(params: unknown): UpsertParams {
  if (typeof params !== 'object' || params === null) {
    throw new Error('Invalid upsert params: expected object');
  }

  const p = params as Record<string, unknown>;

  const validLayers = ['event', 'profile', 'semantic', 'summary', 'task'];
  if (!validLayers.includes(p.layer as string)) {
    throw new Error(`Invalid layer: ${p.layer}. Must be one of: ${validLayers.join(', ')}`);
  }

  if (typeof p.data !== 'object' || p.data === null) {
    throw new Error('Invalid data: expected object');
  }

  return {
    layer: p.layer as UpsertParams['layer'],
    data: p.data as Record<string, unknown>,
    sessionId: typeof p.sessionId === 'string' ? p.sessionId : undefined,
  };
}

/**
 * Validate delete params
 */
export function validateDeleteParams(params: unknown): DeleteParams {
  if (typeof params !== 'object' || params === null) {
    throw new Error('Invalid delete params: expected object');
  }

  const p = params as Record<string, unknown>;

  const validLayers = ['events', 'profiles', 'semantic', 'summaries', 'tasks'];
  if (!validLayers.includes(p.layer as string)) {
    throw new Error(`Invalid layer: ${p.layer}. Must be one of: ${validLayers.join(', ')}`);
  }

  if (typeof p.filter !== 'object' || p.filter === null) {
    throw new Error('Invalid filter: expected object');
  }

  const filter = p.filter as Record<string, unknown>;
  const result: DeleteFilter = {};

  if (typeof filter.id === 'string') {
    result.id = filter.id;
  }

  if (Array.isArray(filter.ids)) {
    result.ids = filter.ids.filter((id): id is string => typeof id === 'string');
  }

  if (typeof filter.sessionId === 'string') {
    result.sessionId = filter.sessionId;
  }

  if (typeof filter.beforeTimestamp === 'number') {
    result.beforeTimestamp = filter.beforeTimestamp;
  }

  if (typeof filter.key === 'string') {
    result.key = filter.key;
  }

  // Validate at least one filter is provided
  if (Object.keys(result).length === 0) {
    throw new Error('At least one filter criterion must be provided');
  }

  return {
    layer: p.layer as DeleteParams['layer'],
    filter: result,
  };
}
