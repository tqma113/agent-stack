/**
 * @ai-stack/agent - Metrics Types
 *
 * Defines types for metrics collection, aggregation,
 * and observability.
 */

// =============================================================================
// Metric Points
// =============================================================================

/**
 * Base metric point
 */
export interface MetricPoint {
  /** Timestamp when metric was recorded */
  timestamp: number;
  /** Metric value */
  value: number;
  /** Labels for filtering/grouping */
  labels?: Record<string, string>;
}

/**
 * Latency metric point
 */
export interface LatencyPoint extends MetricPoint {
  /** Operation name */
  operation: string;
}

/**
 * Cost metric point
 */
export interface CostPoint {
  /** Timestamp */
  timestamp: number;
  /** Model used */
  model: string;
  /** Operation type */
  operation: string;
  /** Cost in USD */
  cost: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
}

/**
 * Error metric point
 */
export interface ErrorPoint {
  /** Timestamp */
  timestamp: number;
  /** Operation where error occurred */
  operation: string;
  /** Error type/category */
  errorType: string;
  /** Error message */
  message?: string;
}

/**
 * Tool call metric point
 */
export interface ToolCallPoint {
  /** Timestamp */
  timestamp: number;
  /** Tool name */
  tool: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether call succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Token usage metric point
 */
export interface TokenPoint {
  /** Timestamp */
  timestamp: number;
  /** Model used */
  model: string;
  /** Input tokens */
  input: number;
  /** Output tokens */
  output: number;
}

// =============================================================================
// Aggregated Metrics
// =============================================================================

/**
 * Latency statistics
 */
export interface LatencyStats {
  /** 50th percentile */
  p50: number;
  /** 90th percentile */
  p90: number;
  /** 95th percentile */
  p95: number;
  /** 99th percentile */
  p99: number;
  /** Average */
  avg: number;
  /** Minimum */
  min: number;
  /** Maximum */
  max: number;
  /** Sample count */
  count: number;
}

/**
 * Cost statistics
 */
export interface CostMetrics {
  /** Total cost (USD) */
  total: number;
  /** Cost by model */
  byModel: Record<string, number>;
  /** Cost by operation */
  byOperation: Record<string, number>;
  /** Average cost per request */
  avgPerRequest: number;
}

/**
 * Throughput statistics
 */
export interface ThroughputMetrics {
  /** Requests per minute */
  requestsPerMinute: number;
  /** Tokens per minute */
  tokensPerMinute: number;
  /** Tool calls per minute */
  toolCallsPerMinute: number;
}

/**
 * Error statistics
 */
export interface ErrorMetrics {
  /** Total error count */
  total: number;
  /** Errors by type */
  byType: Record<string, number>;
  /** Errors by operation */
  byOperation: Record<string, number>;
  /** Error rate (errors / total requests) */
  rate: number;
}

/**
 * Tool usage statistics
 */
export interface ToolMetrics {
  /** Call count per tool */
  callCount: Record<string, number>;
  /** Average duration per tool (ms) */
  avgDurationMs: Record<string, number>;
  /** Success rate per tool */
  successRate: Record<string, number>;
  /** Most used tools (ordered) */
  topTools: Array<{ name: string; count: number }>;
}

/**
 * Complete aggregated metrics
 */
export interface AggregatedMetrics {
  /** Latency statistics */
  latency: LatencyStats;
  /** Latency by operation */
  latencyByOperation: Record<string, LatencyStats>;
  /** Cost statistics */
  cost: CostMetrics;
  /** Throughput statistics */
  throughput: ThroughputMetrics;
  /** Error statistics */
  errors: ErrorMetrics;
  /** Tool usage statistics */
  tools: ToolMetrics;
  /** Time range for these metrics */
  timeRange: {
    start: number;
    end: number;
    durationMs: number;
  };
}

// =============================================================================
// Alert Types
// =============================================================================

/**
 * Alert severity
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert condition
 */
export interface AlertCondition {
  /** Alert name */
  name: string;
  /** Metric to check */
  metric: 'error_rate' | 'latency_p95' | 'cost_total' | 'custom';
  /** Comparison operator */
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  /** Threshold value */
  threshold: number;
  /** Severity */
  severity: AlertSeverity;
  /** Custom check function (for 'custom' metric) */
  check?: (metrics: AggregatedMetrics) => boolean;
}

/**
 * Triggered alert
 */
export interface Alert {
  /** Condition that triggered */
  condition: AlertCondition;
  /** Current metric value */
  currentValue: number;
  /** Timestamp when triggered */
  triggeredAt: number;
  /** Message */
  message: string;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Enable metrics collection */
  enabled?: boolean;

  /** Aggregation interval (ms) */
  aggregationIntervalMs?: number;

  /** Retention period for raw metrics (ms) */
  retentionPeriodMs?: number;

  /** Export callback */
  onExport?: (metrics: AggregatedMetrics) => void;

  /** Auto-export interval (ms) */
  autoExportIntervalMs?: number;

  /** Alert conditions */
  alerts?: AlertCondition[];

  /** Alert callback */
  onAlert?: (alert: Alert) => void;

  /** Maximum metric points to keep in memory */
  maxPoints?: number;
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: Required<
  Pick<MetricsConfig, 'enabled' | 'aggregationIntervalMs' | 'retentionPeriodMs' | 'maxPoints'>
> = {
  enabled: true,
  aggregationIntervalMs: 60000, // 1 minute
  retentionPeriodMs: 3600000,  // 1 hour
  maxPoints: 10000,
};
