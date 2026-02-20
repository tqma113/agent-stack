/**
 * @ai-stack/agent - Metrics Aggregator Implementation
 *
 * Collects, aggregates, and exports metrics for
 * observability and monitoring.
 */

import type {
  MetricsConfig,
  MetricPoint,
  LatencyPoint,
  CostPoint,
  ErrorPoint,
  ToolCallPoint,
  TokenPoint,
  AggregatedMetrics,
  LatencyStats,
  Alert,
  AlertCondition,
} from './types.js';
import { DEFAULT_METRICS_CONFIG } from './types.js';

// =============================================================================
// Metrics Aggregator Instance Interface
// =============================================================================

/**
 * Metrics aggregator instance interface
 */
export interface MetricsAggregatorInstance {
  /** Record latency metric */
  recordLatency(operation: string, durationMs: number, labels?: Record<string, string>): void;

  /** Record cost metric */
  recordCost(model: string, operation: string, cost: number, inputTokens: number, outputTokens: number): void;

  /** Record error metric */
  recordError(operation: string, errorType: string, message?: string): void;

  /** Record tool call metric */
  recordToolCall(toolName: string, durationMs: number, success: boolean, error?: string): void;

  /** Record token usage */
  recordTokens(model: string, input: number, output: number): void;

  /** Get aggregated metrics */
  getMetrics(): AggregatedMetrics;

  /** Get metrics for time range */
  getMetricsInRange(startMs: number, endMs: number): AggregatedMetrics;

  /** Get raw metric points */
  getRawMetrics(): {
    latency: LatencyPoint[];
    cost: CostPoint[];
    errors: ErrorPoint[];
    toolCalls: ToolCallPoint[];
    tokens: TokenPoint[];
  };

  /** Reset all metrics */
  reset(): void;

  /** Export metrics (triggers callback) */
  export(): AggregatedMetrics;

  /** Start auto-export */
  startAutoExport(): void;

  /** Stop auto-export */
  stopAutoExport(): void;

  /** Check alerts */
  checkAlerts(): Alert[];

  /** Add alert condition */
  addAlert(condition: AlertCondition): void;

  /** Remove alert condition */
  removeAlert(name: string): void;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = Math.ceil(sortedArr.length * p) - 1;
  return sortedArr[Math.max(0, index)];
}

/**
 * Calculate latency stats from array of durations
 */
function calculateLatencyStats(durations: number[]): LatencyStats {
  if (durations.length === 0) {
    return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, min: 0, max: 0, count: 0 };
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    avg: sum / sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: sorted.length,
  };
}

// =============================================================================
// Metrics Aggregator Factory
// =============================================================================

/**
 * Create metrics aggregator instance
 */
export function createMetricsAggregator(
  config: MetricsConfig = {}
): MetricsAggregatorInstance {
  const mergedConfig = { ...DEFAULT_METRICS_CONFIG, ...config };

  // Metric storage
  const latencyPoints: LatencyPoint[] = [];
  const costPoints: CostPoint[] = [];
  const errorPoints: ErrorPoint[] = [];
  const toolCallPoints: ToolCallPoint[] = [];
  const tokenPoints: TokenPoint[] = [];

  // Alert conditions
  const alertConditions: AlertCondition[] = [...(config.alerts ?? [])];

  // Auto-export timer
  let exportTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Clean up old data points
   */
  function cleanup(): void {
    const cutoff = Date.now() - mergedConfig.retentionPeriodMs;

    // Remove old points
    while (latencyPoints.length > 0 && latencyPoints[0].timestamp < cutoff) {
      latencyPoints.shift();
    }
    while (costPoints.length > 0 && costPoints[0].timestamp < cutoff) {
      costPoints.shift();
    }
    while (errorPoints.length > 0 && errorPoints[0].timestamp < cutoff) {
      errorPoints.shift();
    }
    while (toolCallPoints.length > 0 && toolCallPoints[0].timestamp < cutoff) {
      toolCallPoints.shift();
    }
    while (tokenPoints.length > 0 && tokenPoints[0].timestamp < cutoff) {
      tokenPoints.shift();
    }

    // Enforce max points limit
    const maxPoints = mergedConfig.maxPoints;
    if (latencyPoints.length > maxPoints) {
      latencyPoints.splice(0, latencyPoints.length - maxPoints);
    }
    if (costPoints.length > maxPoints) {
      costPoints.splice(0, costPoints.length - maxPoints);
    }
    if (errorPoints.length > maxPoints) {
      errorPoints.splice(0, errorPoints.length - maxPoints);
    }
    if (toolCallPoints.length > maxPoints) {
      toolCallPoints.splice(0, toolCallPoints.length - maxPoints);
    }
    if (tokenPoints.length > maxPoints) {
      tokenPoints.splice(0, tokenPoints.length - maxPoints);
    }
  }

  /**
   * Aggregate metrics
   */
  function aggregate(startMs?: number, endMs?: number): AggregatedMetrics {
    cleanup();

    const now = Date.now();
    const start = startMs ?? now - mergedConfig.retentionPeriodMs;
    const end = endMs ?? now;
    const oneMinuteAgo = now - 60000;

    // Filter by time range
    const filteredLatency = startMs || endMs
      ? latencyPoints.filter(p => p.timestamp >= start && p.timestamp <= end)
      : latencyPoints;
    const filteredCost = startMs || endMs
      ? costPoints.filter(p => p.timestamp >= start && p.timestamp <= end)
      : costPoints;
    const filteredErrors = startMs || endMs
      ? errorPoints.filter(p => p.timestamp >= start && p.timestamp <= end)
      : errorPoints;
    const filteredToolCalls = startMs || endMs
      ? toolCallPoints.filter(p => p.timestamp >= start && p.timestamp <= end)
      : toolCallPoints;
    const filteredTokens = startMs || endMs
      ? tokenPoints.filter(p => p.timestamp >= start && p.timestamp <= end)
      : tokenPoints;

    // Latency stats
    const latencyDurations = filteredLatency.map(p => p.value);
    const latencyStats = calculateLatencyStats(latencyDurations);

    // Latency by operation
    const latencyByOp = new Map<string, number[]>();
    for (const point of filteredLatency) {
      const durations = latencyByOp.get(point.operation) ?? [];
      durations.push(point.value);
      latencyByOp.set(point.operation, durations);
    }
    const latencyByOperation: Record<string, LatencyStats> = {};
    latencyByOp.forEach((durations, operation) => {
      latencyByOperation[operation] = calculateLatencyStats(durations);
    });

    // Cost stats
    let totalCost = 0;
    const costByModel: Record<string, number> = {};
    const costByOperation: Record<string, number> = {};
    for (const point of filteredCost) {
      totalCost += point.cost;
      costByModel[point.model] = (costByModel[point.model] ?? 0) + point.cost;
      costByOperation[point.operation] = (costByOperation[point.operation] ?? 0) + point.cost;
    }

    // Throughput (last minute)
    const recentLatency = latencyPoints.filter(p => p.timestamp >= oneMinuteAgo);
    const recentTokens = tokenPoints.filter(p => p.timestamp >= oneMinuteAgo);
    const recentToolCalls = toolCallPoints.filter(p => p.timestamp >= oneMinuteAgo);
    const totalRecentTokens = recentTokens.reduce((sum, p) => sum + p.input + p.output, 0);

    // Error stats
    const errorByType: Record<string, number> = {};
    const errorByOperation: Record<string, number> = {};
    for (const point of filteredErrors) {
      errorByType[point.errorType] = (errorByType[point.errorType] ?? 0) + 1;
      errorByOperation[point.operation] = (errorByOperation[point.operation] ?? 0) + 1;
    }
    const totalErrors = filteredErrors.length;
    const totalRequests = filteredLatency.length;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    // Tool stats
    const toolCallCount: Record<string, number> = {};
    const toolDurations: Record<string, number[]> = {};
    const toolSuccesses: Record<string, number> = {};
    const toolTotals: Record<string, number> = {};

    for (const point of filteredToolCalls) {
      toolCallCount[point.tool] = (toolCallCount[point.tool] ?? 0) + 1;
      toolDurations[point.tool] = toolDurations[point.tool] ?? [];
      toolDurations[point.tool].push(point.durationMs);
      toolTotals[point.tool] = (toolTotals[point.tool] ?? 0) + 1;
      if (point.success) {
        toolSuccesses[point.tool] = (toolSuccesses[point.tool] ?? 0) + 1;
      }
    }

    const toolAvgDuration: Record<string, number> = {};
    const toolSuccessRate: Record<string, number> = {};
    for (const tool of Object.keys(toolCallCount)) {
      const durations = toolDurations[tool] ?? [];
      toolAvgDuration[tool] = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
      toolSuccessRate[tool] = toolTotals[tool] > 0
        ? (toolSuccesses[tool] ?? 0) / toolTotals[tool]
        : 0;
    }

    // Top tools
    const topTools = Object.entries(toolCallCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      latency: latencyStats,
      latencyByOperation,
      cost: {
        total: totalCost,
        byModel: costByModel,
        byOperation: costByOperation,
        avgPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      },
      throughput: {
        requestsPerMinute: recentLatency.length,
        tokensPerMinute: totalRecentTokens,
        toolCallsPerMinute: recentToolCalls.length,
      },
      errors: {
        total: totalErrors,
        byType: errorByType,
        byOperation: errorByOperation,
        rate: errorRate,
      },
      tools: {
        callCount: toolCallCount,
        avgDurationMs: toolAvgDuration,
        successRate: toolSuccessRate,
        topTools,
      },
      timeRange: {
        start,
        end,
        durationMs: end - start,
      },
    };
  }

  /**
   * Check alert conditions
   */
  function checkAlerts(): Alert[] {
    const metrics = aggregate();
    const alerts: Alert[] = [];

    for (const condition of alertConditions) {
      let value: number;
      let triggered = false;

      switch (condition.metric) {
        case 'error_rate':
          value = metrics.errors.rate;
          break;
        case 'latency_p95':
          value = metrics.latency.p95;
          break;
        case 'cost_total':
          value = metrics.cost.total;
          break;
        case 'custom':
          if (condition.check) {
            triggered = condition.check(metrics);
            value = triggered ? 1 : 0;
          } else {
            continue;
          }
          break;
        default:
          continue;
      }

      if (condition.metric !== 'custom') {
        switch (condition.operator) {
          case 'gt':
            triggered = value > condition.threshold;
            break;
          case 'lt':
            triggered = value < condition.threshold;
            break;
          case 'eq':
            triggered = value === condition.threshold;
            break;
          case 'gte':
            triggered = value >= condition.threshold;
            break;
          case 'lte':
            triggered = value <= condition.threshold;
            break;
        }
      }

      if (triggered) {
        const alert: Alert = {
          condition,
          currentValue: value,
          triggeredAt: Date.now(),
          message: `Alert: ${condition.name} - ${condition.metric} ${condition.operator} ${condition.threshold} (current: ${value.toFixed(4)})`,
        };
        alerts.push(alert);
        config.onAlert?.(alert);
      }
    }

    return alerts;
  }

  return {
    recordLatency(operation, durationMs, labels): void {
      if (!mergedConfig.enabled) return;
      latencyPoints.push({
        timestamp: Date.now(),
        value: durationMs,
        operation,
        labels,
      });
    },

    recordCost(model, operation, cost, inputTokens, outputTokens): void {
      if (!mergedConfig.enabled) return;
      costPoints.push({
        timestamp: Date.now(),
        model,
        operation,
        cost,
        inputTokens,
        outputTokens,
      });
    },

    recordError(operation, errorType, message): void {
      if (!mergedConfig.enabled) return;
      errorPoints.push({
        timestamp: Date.now(),
        operation,
        errorType,
        message,
      });
    },

    recordToolCall(toolName, durationMs, success, error): void {
      if (!mergedConfig.enabled) return;
      toolCallPoints.push({
        timestamp: Date.now(),
        tool: toolName,
        durationMs,
        success,
        error,
      });
    },

    recordTokens(model, input, output): void {
      if (!mergedConfig.enabled) return;
      tokenPoints.push({
        timestamp: Date.now(),
        model,
        input,
        output,
      });
    },

    getMetrics(): AggregatedMetrics {
      return aggregate();
    },

    getMetricsInRange(startMs, endMs): AggregatedMetrics {
      return aggregate(startMs, endMs);
    },

    getRawMetrics() {
      return {
        latency: [...latencyPoints],
        cost: [...costPoints],
        errors: [...errorPoints],
        toolCalls: [...toolCallPoints],
        tokens: [...tokenPoints],
      };
    },

    reset(): void {
      latencyPoints.length = 0;
      costPoints.length = 0;
      errorPoints.length = 0;
      toolCallPoints.length = 0;
      tokenPoints.length = 0;
    },

    export(): AggregatedMetrics {
      const metrics = aggregate();
      config.onExport?.(metrics);
      return metrics;
    },

    startAutoExport(): void {
      if (exportTimer) return;
      if (!config.autoExportIntervalMs) return;

      exportTimer = setInterval(() => {
        this.export();
        checkAlerts();
      }, config.autoExportIntervalMs);
    },

    stopAutoExport(): void {
      if (exportTimer) {
        clearInterval(exportTimer);
        exportTimer = null;
      }
    },

    checkAlerts,

    addAlert(condition): void {
      alertConditions.push(condition);
    },

    removeAlert(name): void {
      const index = alertConditions.findIndex(c => c.name === name);
      if (index !== -1) {
        alertConditions.splice(index, 1);
      }
    },
  };
}
