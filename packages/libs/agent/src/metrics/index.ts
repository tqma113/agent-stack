/**
 * @ai-stack/agent - Metrics Module
 *
 * Provides metrics collection and aggregation:
 * - Latency tracking (percentiles, avg, min, max)
 * - Cost tracking (by model, by operation)
 * - Error tracking (by type, error rate)
 * - Tool usage tracking
 * - Alerting on thresholds
 */

export {
  createMetricsAggregator,
  type MetricsAggregatorInstance,
} from './metrics-aggregator.js';

export type {
  MetricPoint,
  LatencyPoint,
  CostPoint,
  ErrorPoint,
  ToolCallPoint,
  TokenPoint,
  LatencyStats,
  CostMetrics,
  ThroughputMetrics,
  ErrorMetrics,
  ToolMetrics,
  AggregatedMetrics,
  AlertSeverity,
  AlertCondition,
  Alert,
  MetricsConfig,
} from './types.js';

export { DEFAULT_METRICS_CONFIG } from './types.js';
