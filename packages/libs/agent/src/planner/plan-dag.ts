/**
 * @ai-stack/agent - Plan DAG Implementation
 *
 * Provides DAG-based task management with dependency
 * tracking, topological sorting, and parallel execution support.
 */

import type {
  PlanNode,
  PlanNodeStatus,
  PlanDAG,
  PlanStatus,
  PlanProgress,
  PlanEvent,
  PlanEventListener,
} from './types.js';

// =============================================================================
// Plan DAG Instance Interface
// =============================================================================

/**
 * Plan DAG instance interface
 */
export interface PlanDAGInstance {
  /** Get the underlying DAG */
  getDAG(): PlanDAG;

  /** Get plan ID */
  getId(): string;

  /** Get plan goal */
  getGoal(): string;

  /** Get plan status */
  getStatus(): PlanStatus;

  /** Add a node to the DAG */
  addNode(node: Omit<PlanNode, 'status' | 'dependents' | 'blockedBy'>): void;

  /** Add dependency edge between nodes */
  addEdge(fromId: string, toId: string): void;

  /** Remove a node from the DAG */
  removeNode(nodeId: string): void;

  /** Get a specific node */
  getNode(nodeId: string): PlanNode | undefined;

  /** Get all nodes */
  getAllNodes(): PlanNode[];

  /** Get nodes ready for execution (all dependencies met) */
  getReadyNodes(): PlanNode[];

  /** Get batch of nodes that can run in parallel */
  getParallelBatch(maxSize?: number): PlanNode[];

  /** Mark node as executing */
  markExecuting(nodeId: string): void;

  /** Mark node as completed */
  markCompleted(nodeId: string, result: string): void;

  /** Mark node as failed */
  markFailed(nodeId: string, error: string): void;

  /** Mark node as skipped */
  markSkipped(nodeId: string, reason: string): void;

  /** Retry a failed node */
  retryNode(nodeId: string): boolean;

  /** Check if DAG has cycles */
  hasCycle(): boolean;

  /** Get execution progress */
  getProgress(): PlanProgress;

  /** Check if plan is complete */
  isComplete(): boolean;

  /** Validate DAG structure */
  validate(): { valid: boolean; errors: string[] };

  /** Reset all nodes to pending */
  reset(): void;

  /** Pause execution */
  pause(): void;

  /** Resume execution */
  resume(): void;

  /** Cancel execution */
  cancel(): void;

  /** Export DAG to JSON */
  toJSON(): string;

  /** Import DAG from JSON */
  fromJSON(json: string): void;

  /** Subscribe to plan events */
  subscribe(listener: PlanEventListener): () => void;

  /** Get critical path (longest path to completion) */
  getCriticalPath(): PlanNode[];

  /** Get estimated completion time */
  getEstimatedCompletionTime(): number;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `plan_${timestamp}_${random}`;
}

// =============================================================================
// Plan DAG Factory
// =============================================================================

/**
 * Create Plan DAG instance
 */
export function createPlanDAG(goal: string, reasoning?: string): PlanDAGInstance {
  const dag: PlanDAG = {
    id: generateId(),
    goal,
    reasoning,
    nodes: new Map(),
    executionOrder: [],
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  };

  const listeners = new Set<PlanEventListener>();

  /**
   * Emit plan event
   */
  function emit(type: PlanEvent['type'], nodeId?: string, data?: Record<string, unknown>): void {
    const event: PlanEvent = {
      type,
      timestamp: Date.now(),
      planId: dag.id,
      nodeId,
      data,
    };
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (e) {
        console.error('Plan event listener error:', e);
      }
    });
  }

  /**
   * Update execution order using Kahn's algorithm (topological sort)
   */
  function updateExecutionOrder(): void {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degree for all nodes
    dag.nodes.forEach((node, id) => {
      inDegree.set(id, node.dependsOn.length);
      if (node.dependsOn.length === 0) {
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      // Sort by priority (lower = higher priority)
      queue.sort((a, b) => {
        const nodeA = dag.nodes.get(a)!;
        const nodeB = dag.nodes.get(b)!;
        return (nodeA.priority ?? 0) - (nodeB.priority ?? 0);
      });

      const nodeId = queue.shift()!;
      result.push(nodeId);

      // Update in-degree for dependent nodes
      dag.nodes.forEach((node, id) => {
        if (node.dependsOn.includes(nodeId)) {
          const newDegree = inDegree.get(id)! - 1;
          inDegree.set(id, newDegree);
          if (newDegree === 0) {
            queue.push(id);
          }
        }
      });
    }

    dag.executionOrder = result;
  }

  /**
   * Update blocked-by lists for all nodes
   */
  function updateBlockedBy(): void {
    dag.nodes.forEach(node => {
      node.blockedBy = [];
      for (const depId of node.dependsOn) {
        const depNode = dag.nodes.get(depId);
        if (depNode && depNode.status !== 'completed' && depNode.status !== 'skipped') {
          node.blockedBy.push(depId);
        }
      }
    });
  }

  /**
   * Update dependents for all nodes
   */
  function updateDependents(): void {
    // Clear all dependents first
    dag.nodes.forEach(node => {
      node.dependents = [];
    });

    // Rebuild dependents
    dag.nodes.forEach((node, nodeId) => {
      for (const depId of node.dependsOn) {
        const depNode = dag.nodes.get(depId);
        if (depNode) {
          depNode.dependents.push(nodeId);
        }
      }
    });
  }

  /**
   * Update node status to ready if all dependencies are met
   */
  function updateReadyNodes(): void {
    updateBlockedBy();
    dag.nodes.forEach(node => {
      if (node.status === 'pending' && node.blockedBy.length === 0) {
        node.status = 'ready';
        emit('node:ready', node.id);
      }
    });
  }

  /**
   * Update overall plan status
   */
  function updatePlanStatus(): void {
    const nodes = Array.from(dag.nodes.values());

    // Check if any node is executing
    const hasExecuting = nodes.some(n => n.status === 'executing');
    if (hasExecuting) {
      dag.status = 'executing';
      return;
    }

    // Check if any node failed
    const hasFailed = nodes.some(n => n.status === 'failed');
    if (hasFailed) {
      // Check if there are still nodes that can be executed
      const hasReady = nodes.some(n => n.status === 'ready' || n.status === 'pending');
      if (!hasReady) {
        dag.status = 'failed';
        emit('plan:failed');
        return;
      }
    }

    // Check if all nodes are completed or skipped
    const allDone = nodes.every(
      n => n.status === 'completed' || n.status === 'skipped' || n.status === 'failed' || n.status === 'cancelled'
    );
    if (allDone) {
      dag.status = hasFailed ? 'failed' : 'completed';
      if (dag.status === 'completed') {
        emit('plan:completed');
      }
    }
  }

  return {
    getDAG(): PlanDAG {
      return dag;
    },

    getId(): string {
      return dag.id;
    },

    getGoal(): string {
      return dag.goal;
    },

    getStatus(): PlanStatus {
      return dag.status;
    },

    addNode(nodeInput: Omit<PlanNode, 'status' | 'dependents' | 'blockedBy'>): void {
      const node: PlanNode = {
        ...nodeInput,
        status: 'pending',
        dependents: [],
        blockedBy: [...nodeInput.dependsOn],
      };

      dag.nodes.set(node.id, node);
      updateDependents();
      updateExecutionOrder();
      updateReadyNodes();
      dag.updatedAt = Date.now();
      dag.version++;
    },

    addEdge(fromId: string, toId: string): void {
      const toNode = dag.nodes.get(toId);
      if (!toNode) {
        throw new Error(`Node ${toId} not found`);
      }

      if (!toNode.dependsOn.includes(fromId)) {
        toNode.dependsOn.push(fromId);
        toNode.blockedBy.push(fromId);
        updateDependents();
        updateExecutionOrder();
        dag.updatedAt = Date.now();
        dag.version++;
      }
    },

    removeNode(nodeId: string): void {
      dag.nodes.delete(nodeId);

      // Clean up references in other nodes
      dag.nodes.forEach(node => {
        node.dependsOn = node.dependsOn.filter(id => id !== nodeId);
        node.dependents = node.dependents.filter(id => id !== nodeId);
        node.blockedBy = node.blockedBy.filter(id => id !== nodeId);
      });

      updateExecutionOrder();
      dag.updatedAt = Date.now();
      dag.version++;
    },

    getNode(nodeId: string): PlanNode | undefined {
      return dag.nodes.get(nodeId);
    },

    getAllNodes(): PlanNode[] {
      return Array.from(dag.nodes.values());
    },

    getReadyNodes(): PlanNode[] {
      updateReadyNodes();
      const ready: PlanNode[] = [];
      dag.nodes.forEach(node => {
        if (node.status === 'ready') {
          ready.push(node);
        }
      });
      return ready.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    },

    getParallelBatch(maxSize = 5): PlanNode[] {
      const ready = this.getReadyNodes();
      return ready
        .filter(node => node.parallel !== false)
        .slice(0, maxSize);
    },

    markExecuting(nodeId: string): void {
      const node = dag.nodes.get(nodeId);
      if (!node) return;

      node.status = 'executing';
      node.startedAt = Date.now();
      dag.status = 'executing';
      dag.updatedAt = Date.now();
      emit('node:started', nodeId);
    },

    markCompleted(nodeId: string, result: string): void {
      const node = dag.nodes.get(nodeId);
      if (!node) return;

      node.status = 'completed';
      node.result = result;
      node.completedAt = Date.now();
      if (node.startedAt) {
        node.actualDurationMs = node.completedAt - node.startedAt;
      }

      updateReadyNodes();
      updatePlanStatus();
      dag.updatedAt = Date.now();
      emit('node:completed', nodeId, { result });
    },

    markFailed(nodeId: string, error: string): void {
      const node = dag.nodes.get(nodeId);
      if (!node) return;

      node.status = 'failed';
      node.error = error;
      node.completedAt = Date.now();
      if (node.startedAt) {
        node.actualDurationMs = node.completedAt - node.startedAt;
      }

      updatePlanStatus();
      dag.updatedAt = Date.now();
      emit('node:failed', nodeId, { error });
    },

    markSkipped(nodeId: string, reason: string): void {
      const node = dag.nodes.get(nodeId);
      if (!node) return;

      node.status = 'skipped';
      node.result = `Skipped: ${reason}`;
      node.completedAt = Date.now();

      // Skip all dependent nodes as well
      node.dependents.forEach(depId => {
        this.markSkipped(depId, `Dependency ${nodeId} was skipped`);
      });

      updateReadyNodes();
      updatePlanStatus();
      dag.updatedAt = Date.now();
      emit('node:skipped', nodeId, { reason });
    },

    retryNode(nodeId: string): boolean {
      const node = dag.nodes.get(nodeId);
      if (!node || node.status !== 'failed') return false;

      const maxRetries = node.maxRetries ?? 3;
      const retryCount = (node.retryCount ?? 0) + 1;

      if (retryCount > maxRetries) {
        return false;
      }

      node.status = 'ready';
      node.retryCount = retryCount;
      node.error = undefined;
      node.startedAt = undefined;
      node.completedAt = undefined;

      dag.updatedAt = Date.now();
      emit('node:retrying', nodeId, { attempt: retryCount, maxRetries });
      return true;
    },

    hasCycle(): boolean {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();

      function dfs(nodeId: string): boolean {
        visited.add(nodeId);
        recursionStack.add(nodeId);

        const node = dag.nodes.get(nodeId);
        if (node) {
          for (const depId of node.dependsOn) {
            if (!visited.has(depId)) {
              if (dfs(depId)) return true;
            } else if (recursionStack.has(depId)) {
              return true;
            }
          }
        }

        recursionStack.delete(nodeId);
        return false;
      }

      for (const nodeId of dag.nodes.keys()) {
        if (!visited.has(nodeId)) {
          if (dfs(nodeId)) return true;
        }
      }

      return false;
    },

    getProgress(): PlanProgress {
      let completed = 0;
      let failed = 0;
      let skipped = 0;
      let executing = 0;
      let pending = 0;
      let ready = 0;
      let totalEstimated = 0;
      let completedEstimated = 0;

      dag.nodes.forEach(node => {
        switch (node.status) {
          case 'completed':
            completed++;
            completedEstimated += node.actualDurationMs ?? node.estimatedDurationMs ?? 0;
            break;
          case 'failed':
            failed++;
            break;
          case 'skipped':
          case 'cancelled':
            skipped++;
            break;
          case 'executing':
            executing++;
            break;
          case 'ready':
            ready++;
            totalEstimated += node.estimatedDurationMs ?? 0;
            break;
          case 'pending':
            pending++;
            totalEstimated += node.estimatedDurationMs ?? 0;
            break;
        }
      });

      const total = dag.nodes.size;
      const percentage = total > 0 ? Math.round((completed + skipped) / total * 100) : 0;

      return {
        total,
        completed,
        failed,
        skipped,
        executing,
        pending,
        ready,
        percentage,
        estimatedRemainingMs: totalEstimated,
      };
    },

    isComplete(): boolean {
      for (const node of dag.nodes.values()) {
        if (
          node.status !== 'completed' &&
          node.status !== 'skipped' &&
          node.status !== 'failed' &&
          node.status !== 'cancelled'
        ) {
          return false;
        }
      }
      return true;
    },

    validate(): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      // Check for cycles
      if (this.hasCycle()) {
        errors.push('DAG contains a cycle');
      }

      // Check for missing dependencies
      dag.nodes.forEach((node, nodeId) => {
        for (const depId of node.dependsOn) {
          if (!dag.nodes.has(depId)) {
            errors.push(`Node ${nodeId} depends on non-existent node ${depId}`);
          }
        }
      });

      // Check execution order is complete
      if (dag.executionOrder.length !== dag.nodes.size) {
        errors.push('Execution order incomplete - possible cycle or disconnected nodes');
      }

      return { valid: errors.length === 0, errors };
    },

    reset(): void {
      dag.nodes.forEach(node => {
        node.status = 'pending';
        node.result = undefined;
        node.error = undefined;
        node.actualDurationMs = undefined;
        node.startedAt = undefined;
        node.completedAt = undefined;
        node.retryCount = 0;
      });
      dag.status = 'pending';
      updateReadyNodes();
      dag.updatedAt = Date.now();
      dag.version++;
    },

    pause(): void {
      dag.status = 'paused';
      dag.updatedAt = Date.now();
      emit('plan:paused');
    },

    resume(): void {
      dag.status = 'executing';
      dag.updatedAt = Date.now();
      emit('plan:resumed');
    },

    cancel(): void {
      dag.nodes.forEach(node => {
        if (node.status === 'pending' || node.status === 'ready') {
          node.status = 'cancelled';
        }
      });
      dag.status = 'cancelled';
      dag.updatedAt = Date.now();
      emit('plan:cancelled');
    },

    toJSON(): string {
      return JSON.stringify({
        ...dag,
        nodes: Array.from(dag.nodes.entries()),
      }, null, 2);
    },

    fromJSON(json: string): void {
      const data = JSON.parse(json);
      dag.id = data.id;
      dag.goal = data.goal;
      dag.reasoning = data.reasoning;
      dag.nodes = new Map(data.nodes);
      dag.executionOrder = data.executionOrder;
      dag.status = data.status;
      dag.createdAt = data.createdAt;
      dag.updatedAt = data.updatedAt;
      dag.version = data.version;
      dag.metadata = data.metadata;
    },

    subscribe(listener: PlanEventListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getCriticalPath(): PlanNode[] {
      // Find the longest path from any start node to any end node
      const memo = new Map<string, { length: number; path: string[] }>();

      function longestPath(nodeId: string): { length: number; path: string[] } {
        if (memo.has(nodeId)) {
          return memo.get(nodeId)!;
        }

        const node = dag.nodes.get(nodeId);
        if (!node || node.dependsOn.length === 0) {
          const result = { length: node?.estimatedDurationMs ?? 0, path: [nodeId] };
          memo.set(nodeId, result);
          return result;
        }

        let maxLength = 0;
        let maxPath: string[] = [];

        for (const depId of node.dependsOn) {
          const { length, path } = longestPath(depId);
          if (length > maxLength) {
            maxLength = length;
            maxPath = path;
          }
        }

        const result = {
          length: maxLength + (node.estimatedDurationMs ?? 0),
          path: [...maxPath, nodeId],
        };
        memo.set(nodeId, result);
        return result;
      }

      // Find end nodes (no dependents)
      const endNodes = Array.from(dag.nodes.values()).filter(n => n.dependents.length === 0);

      let criticalPath: string[] = [];
      let maxLength = 0;

      for (const endNode of endNodes) {
        const { length, path } = longestPath(endNode.id);
        if (length > maxLength) {
          maxLength = length;
          criticalPath = path;
        }
      }

      return criticalPath.map(id => dag.nodes.get(id)!).filter(Boolean);
    },

    getEstimatedCompletionTime(): number {
      const criticalPath = this.getCriticalPath();
      return criticalPath.reduce((sum, node) => sum + (node.estimatedDurationMs ?? 0), 0);
    },
  };
}
