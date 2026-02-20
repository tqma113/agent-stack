/**
 * @ai-stack/agent - Model Router Types
 *
 * Defines types for intelligent model routing based on
 * task complexity, cost optimization, and performance.
 */

// =============================================================================
// Task Classification
// =============================================================================

/**
 * Task complexity level
 */
export type TaskComplexity = 'simple' | 'medium' | 'complex';

/**
 * Task type for routing decisions
 */
export type TaskType =
  | 'tool_selection'    // Choosing which tool to use
  | 'planning'          // Creating execution plans
  | 'reasoning'         // Complex reasoning tasks
  | 'code_generation'   // Writing code
  | 'code_review'       // Reviewing code
  | 'summarization'     // Summarizing content
  | 'formatting'        // Formatting output
  | 'classification'    // Categorizing items
  | 'extraction'        // Extracting information
  | 'conversation'      // General conversation
  | 'translation'       // Language translation
  | 'analysis';         // Data/text analysis

// =============================================================================
// Model Tiers
// =============================================================================

/**
 * Model tier name
 */
export type ModelTierName = 'fast' | 'standard' | 'strong';

/**
 * Model tier configuration
 */
export interface ModelTier {
  /** Model identifier */
  model: string;

  /** Provider (for multi-provider setups) */
  provider?: 'openai' | 'anthropic' | 'google' | 'openai-compatible';

  /** Cost per 1K input tokens (USD) */
  inputCostPer1K: number;

  /** Cost per 1K output tokens (USD) */
  outputCostPer1K: number;

  /** Maximum context length (tokens) */
  maxContext: number;

  /** Maximum output tokens */
  maxOutput?: number;

  /** Supported task types */
  supportedTasks: TaskType[];

  /** Latency tier (1-10, 1 = fastest) */
  latencyTier: number;

  /** Quality tier (1-10, 10 = best quality) */
  qualityTier: number;

  /** Whether model supports streaming */
  supportsStreaming?: boolean;

  /** Whether model supports tool/function calling */
  supportsTools?: boolean;

  /** Whether model supports vision */
  supportsVision?: boolean;
}

// =============================================================================
// Routing Decision
// =============================================================================

/**
 * Routing context
 */
export interface RoutingContext {
  /** Estimated input tokens */
  estimatedTokens?: number;

  /** Whether task can be handled by a cheaper model */
  canDowngrade?: boolean;

  /** Whether task requires highest quality */
  requiresHighQuality?: boolean;

  /** Whether task requires tool support */
  requiresTools?: boolean;

  /** Whether task requires vision */
  requiresVision?: boolean;

  /** Maximum acceptable latency (ms) */
  maxLatencyMs?: number;

  /** Maximum acceptable cost (USD) */
  maxCost?: number;

  /** Previous routing decision (for consistency) */
  previousDecision?: RoutingDecision;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  /** Selected tier */
  tier: ModelTierName;

  /** Selected model */
  model: string;

  /** Reason for selection */
  reason: string;

  /** Estimated cost for this request */
  estimatedCost?: number;

  /** Estimated latency (ms) */
  estimatedLatencyMs?: number;

  /** Alternative options considered */
  alternatives?: Array<{
    tier: ModelTierName;
    model: string;
    reason: string;
  }>;
}

// =============================================================================
// Cost Tracking
// =============================================================================

/**
 * Token usage for a request
 */
export interface TokenUsage {
  /** Input tokens used */
  input: number;
  /** Output tokens generated */
  output: number;
}

/**
 * Cost statistics for a tier
 */
export interface TierCostStats {
  /** Total input tokens */
  inputTokens: number;
  /** Total output tokens */
  outputTokens: number;
  /** Total cost (USD) */
  cost: number;
  /** Number of requests */
  requestCount: number;
}

/**
 * Overall cost statistics
 */
export interface CostStats {
  /** Stats by tier */
  byTier: Record<ModelTierName, TierCostStats>;
  /** Total cost across all tiers */
  totalCost: number;
  /** Total requests */
  totalRequests: number;
  /** Stats start time */
  startTime: number;
  /** Time period (ms) */
  periodMs: number;
}

// =============================================================================
// Router Configuration
// =============================================================================

/**
 * Model router configuration
 */
export interface ModelRouterConfig {
  /** Fast tier model configuration */
  fast: ModelTier;

  /** Standard tier model configuration */
  standard: ModelTier;

  /** Strong tier model configuration */
  strong: ModelTier;

  /** Default tier to use */
  defaultTier?: ModelTierName;

  /** Task type to tier mapping */
  taskTierMap?: Partial<Record<TaskType, ModelTierName>>;

  /** Enable cost optimization */
  costOptimization?: boolean;

  /** Daily cost limit (USD) */
  dailyCostLimit?: number;

  /** Per-request cost limit (USD) */
  requestCostLimit?: number;

  /** Cost callback when limit approached */
  onCostWarning?: (stats: CostStats, threshold: number) => void;

  /** Cost callback when limit reached */
  onCostLimitReached?: (stats: CostStats) => void;

  /** Fallback tier when preferred is unavailable */
  fallbackTier?: ModelTierName;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default task type to tier mapping
 */
export const DEFAULT_TASK_TIER_MAP: Record<TaskType, ModelTierName> = {
  tool_selection: 'fast',
  classification: 'fast',
  extraction: 'fast',
  formatting: 'fast',
  summarization: 'standard',
  conversation: 'standard',
  translation: 'standard',
  analysis: 'standard',
  code_review: 'strong',
  code_generation: 'strong',
  reasoning: 'strong',
  planning: 'strong',
};

/**
 * Default model tiers (OpenAI)
 */
export const DEFAULT_MODEL_TIERS: Record<ModelTierName, ModelTier> = {
  fast: {
    model: 'gpt-4o-mini',
    provider: 'openai',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    maxContext: 128000,
    maxOutput: 16384,
    supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation'],
    latencyTier: 2,
    qualityTier: 6,
    supportsStreaming: true,
    supportsTools: true,
  },
  standard: {
    model: 'gpt-4o',
    provider: 'openai',
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.01,
    maxContext: 128000,
    maxOutput: 16384,
    supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation'],
    latencyTier: 4,
    qualityTier: 8,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
  strong: {
    model: 'gpt-4o',
    provider: 'openai',
    inputCostPer1K: 0.0025,
    outputCostPer1K: 0.01,
    maxContext: 128000,
    maxOutput: 16384,
    supportedTasks: ['tool_selection', 'classification', 'extraction', 'formatting', 'summarization', 'conversation', 'translation', 'analysis', 'code_generation', 'code_review', 'reasoning', 'planning'],
    latencyTier: 4,
    qualityTier: 9,
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
  },
};
