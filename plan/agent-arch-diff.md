# @ai-stack/agent 架构差距分析与实现计划

## 一、当前架构覆盖率

| 层级 | 覆盖率 | 状态 |
|------|--------|------|
| Client Layer | 80% | ⚠️ 缺 trace_id |
| Orchestrator | 40% | ❌ 缺状态机、恢复策略 |
| Planner | 30% | ❌ 有基础，缺 DAG |
| Executor | 90% | ✅ 较完整 |
| Evaluator | 0% | ❌ 完全缺失 |
| Tool Layer | 95% | ✅ 较完整 |
| Memory Layer | 85% | ⚠️ 缺 checkpoint |
| Model Layer | 60% | ❌ 缺路由器 |
| Observability | 60% | ⚠️ 缺聚合指标 |

**总体**: ~55-60%

---

## 二、缺失模块实现计划

### Phase 1: Orchestrator 层 - 状态机与恢复 (P0)

#### 1.1 AgentStateMachine

**文件**: `packages/libs/agent/src/state-machine/`

```typescript
// types.ts
/**
 * Agent 执行状态
 */
export type AgentStatus =
  | 'idle'        // 空闲，等待输入
  | 'planning'    // 规划中
  | 'executing'   // 执行中
  | 'waiting'     // 等待用户/外部输入
  | 'paused'      // 暂停
  | 'error'       // 错误
  | 'completed';  // 完成

/**
 * Agent 状态快照（可序列化）
 */
export interface AgentState {
  /** 状态版本，用于兼容性检查 */
  version: number;
  /** Session ID */
  sessionId: string;
  /** 当前任务 ID */
  taskId: string | null;
  /** 当前步骤索引 */
  stepIndex: number;
  /** 当前执行计划 */
  plan: PlanDAG | null;
  /** 工作内存（任务相关临时数据） */
  workingMemory: Record<string, unknown>;
  /** 当前状态 */
  status: AgentStatus;
  /** 错误信息（如果有） */
  error: AgentError | null;
  /** 对话历史（可选，用于恢复） */
  conversationHistory?: Message[];
  /** 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  updatedAt: number;
  /** Checkpoint 名称（如果是从 checkpoint 恢复） */
  checkpointName?: string;
}

/**
 * 状态转换事件
 */
export type StateTransition =
  | { type: 'START'; input: string }
  | { type: 'PLAN_CREATED'; plan: PlanDAG }
  | { type: 'STEP_START'; stepId: string }
  | { type: 'STEP_COMPLETE'; stepId: string; result: string }
  | { type: 'STEP_ERROR'; stepId: string; error: Error }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'RESET' }
  | { type: 'COMPLETE'; result: string }
  | { type: 'ERROR'; error: Error };

/**
 * 状态机配置
 */
export interface StateMachineConfig {
  /** 是否自动保存 checkpoint */
  autoCheckpoint?: boolean;
  /** Checkpoint 间隔（步骤数） */
  checkpointInterval?: number;
  /** Checkpoint 存储路径 */
  checkpointPath?: string;
  /** 状态变更回调 */
  onStateChange?: (state: AgentState, transition: StateTransition) => void;
}
```

```typescript
// state-machine.ts
import type { AgentState, StateTransition, StateMachineConfig, AgentStatus } from './types.js';

export interface StateMachineInstance {
  /** 获取当前状态 */
  getState(): AgentState;
  /** 触发状态转换 */
  transition(event: StateTransition): AgentState;
  /** 暂停执行 */
  pause(): void;
  /** 恢复执行 */
  resume(): void;
  /** 重置状态 */
  reset(): void;
  /** 创建 checkpoint */
  checkpoint(name?: string): Promise<string>;
  /** 从 checkpoint 恢复 */
  restore(checkpointId: string): Promise<AgentState>;
  /** 列出所有 checkpoints */
  listCheckpoints(): Promise<CheckpointInfo[]>;
  /** 删除 checkpoint */
  deleteCheckpoint(checkpointId: string): Promise<void>;
  /** 导出状态（序列化） */
  exportState(): string;
  /** 导入状态（反序列化） */
  importState(serialized: string): AgentState;
  /** 订阅状态变更 */
  subscribe(callback: (state: AgentState) => void): () => void;
}

/**
 * 创建状态机实例
 */
export function createStateMachine(
  config: StateMachineConfig = {}
): StateMachineInstance {
  const STATE_VERSION = 1;

  let currentState: AgentState = {
    version: STATE_VERSION,
    sessionId: generateId(),
    taskId: null,
    stepIndex: 0,
    plan: null,
    workingMemory: {},
    status: 'idle',
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const subscribers = new Set<(state: AgentState) => void>();
  let checkpointCounter = 0;

  // 状态转换表
  const transitions: Record<AgentStatus, StateTransition['type'][]> = {
    idle: ['START'],
    planning: ['PLAN_CREATED', 'ERROR', 'PAUSE'],
    executing: ['STEP_START', 'STEP_COMPLETE', 'STEP_ERROR', 'COMPLETE', 'ERROR', 'PAUSE'],
    waiting: ['RESUME', 'ERROR'],
    paused: ['RESUME', 'RESET'],
    error: ['RESET'],
    completed: ['RESET', 'START'],
  };

  function canTransition(event: StateTransition): boolean {
    return transitions[currentState.status]?.includes(event.type) ?? false;
  }

  function applyTransition(event: StateTransition): AgentState {
    if (!canTransition(event)) {
      throw new Error(
        `Invalid transition: ${event.type} from state ${currentState.status}`
      );
    }

    const newState = { ...currentState, updatedAt: Date.now() };

    switch (event.type) {
      case 'START':
        newState.status = 'planning';
        newState.workingMemory = { input: event.input };
        break;

      case 'PLAN_CREATED':
        newState.status = 'executing';
        newState.plan = event.plan;
        newState.stepIndex = 0;
        break;

      case 'STEP_START':
        newState.workingMemory = {
          ...newState.workingMemory,
          currentStepId: event.stepId,
        };
        break;

      case 'STEP_COMPLETE':
        newState.stepIndex++;
        newState.workingMemory = {
          ...newState.workingMemory,
          [`step_${event.stepId}_result`]: event.result,
        };
        break;

      case 'STEP_ERROR':
        newState.status = 'error';
        newState.error = { stepId: event.stepId, message: event.error.message };
        break;

      case 'PAUSE':
        newState.status = 'paused';
        break;

      case 'RESUME':
        newState.status = 'executing';
        break;

      case 'COMPLETE':
        newState.status = 'completed';
        newState.workingMemory = {
          ...newState.workingMemory,
          finalResult: event.result,
        };
        break;

      case 'ERROR':
        newState.status = 'error';
        newState.error = { message: event.error.message };
        break;

      case 'RESET':
        return {
          version: STATE_VERSION,
          sessionId: generateId(),
          taskId: null,
          stepIndex: 0,
          plan: null,
          workingMemory: {},
          status: 'idle',
          error: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
    }

    return newState;
  }

  function notifySubscribers() {
    for (const callback of subscribers) {
      callback(currentState);
    }
  }

  async function saveCheckpoint(name?: string): Promise<string> {
    const checkpointId = name ?? `checkpoint_${++checkpointCounter}_${Date.now()}`;
    const serialized = JSON.stringify(currentState);

    if (config.checkpointPath) {
      // 持久化到文件系统
      await fs.writeFile(
        `${config.checkpointPath}/${checkpointId}.json`,
        serialized
      );
    }

    return checkpointId;
  }

  return {
    getState() {
      return { ...currentState };
    },

    transition(event: StateTransition) {
      currentState = applyTransition(event);
      config.onStateChange?.(currentState, event);
      notifySubscribers();

      // 自动 checkpoint
      if (config.autoCheckpoint &&
          currentState.stepIndex % (config.checkpointInterval ?? 5) === 0) {
        saveCheckpoint();
      }

      return { ...currentState };
    },

    pause() {
      this.transition({ type: 'PAUSE' });
    },

    resume() {
      this.transition({ type: 'RESUME' });
    },

    reset() {
      this.transition({ type: 'RESET' });
    },

    async checkpoint(name?: string) {
      return saveCheckpoint(name);
    },

    async restore(checkpointId: string) {
      if (config.checkpointPath) {
        const data = await fs.readFile(
          `${config.checkpointPath}/${checkpointId}.json`,
          'utf-8'
        );
        currentState = JSON.parse(data);
        currentState.checkpointName = checkpointId;
        notifySubscribers();
      }
      return { ...currentState };
    },

    async listCheckpoints() {
      // 实现列出 checkpoints
      return [];
    },

    async deleteCheckpoint(checkpointId: string) {
      // 实现删除 checkpoint
    },

    exportState() {
      return JSON.stringify(currentState);
    },

    importState(serialized: string) {
      currentState = JSON.parse(serialized);
      notifySubscribers();
      return { ...currentState };
    },

    subscribe(callback: (state: AgentState) => void) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
}
```

#### 1.2 RecoveryPolicy

**文件**: `packages/libs/agent/src/recovery/`

```typescript
// types.ts
export type BackoffStrategy = 'none' | 'linear' | 'exponential' | 'fibonacci';

export type RecoveryAction =
  | { action: 'retry' }
  | { action: 'skip' }
  | { action: 'fallback'; fallbackFn: () => Promise<unknown> }
  | { action: 'abort' }
  | { action: 'checkpoint_restore'; checkpointId: string };

export interface RecoveryContext {
  error: Error;
  attempt: number;
  maxRetries: number;
  operation: string;
  args?: Record<string, unknown>;
  lastCheckpoint?: string;
}

export interface RecoveryPolicyConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 退避策略 */
  backoffStrategy?: BackoffStrategy;
  /** 初始延迟 (ms) */
  initialDelayMs?: number;
  /** 最大延迟 (ms) */
  maxDelayMs?: number;
  /** 可重试的错误类型 */
  retryableErrors?: Array<new (...args: any[]) => Error>;
  /** 自定义错误处理器 */
  onError?: (context: RecoveryContext) => RecoveryAction;
  /** 重试前回调 */
  beforeRetry?: (context: RecoveryContext) => Promise<void>;
  /** 重试后回调 */
  afterRetry?: (context: RecoveryContext, success: boolean) => void;
}
```

```typescript
// recovery-policy.ts
export interface RecoveryPolicyInstance {
  /** 执行带恢复策略的操作 */
  execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options?: { args?: Record<string, unknown> }
  ): Promise<T>;

  /** 计算下次重试延迟 */
  getDelay(attempt: number): number;

  /** 判断错误是否可重试 */
  isRetryable(error: Error): boolean;

  /** 重置重试计数 */
  reset(): void;
}

export function createRecoveryPolicy(
  config: RecoveryPolicyConfig = {}
): RecoveryPolicyInstance {
  const {
    maxRetries = 3,
    backoffStrategy = 'exponential',
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    retryableErrors = [Error],
    onError,
    beforeRetry,
    afterRetry,
  } = config;

  function getDelay(attempt: number): number {
    let delay: number;

    switch (backoffStrategy) {
      case 'none':
        delay = 0;
        break;
      case 'linear':
        delay = initialDelayMs * attempt;
        break;
      case 'exponential':
        delay = initialDelayMs * Math.pow(2, attempt - 1);
        break;
      case 'fibonacci':
        delay = initialDelayMs * fibonacci(attempt);
        break;
      default:
        delay = initialDelayMs;
    }

    // 添加 jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, maxDelayMs);
  }

  function isRetryable(error: Error): boolean {
    return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
  }

  async function execute<T>(
    operation: string,
    fn: () => Promise<T>,
    options: { args?: Record<string, unknown> } = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        const context: RecoveryContext = {
          error: lastError,
          attempt,
          maxRetries,
          operation,
          args: options.args,
        };

        // 检查是否可重试
        if (attempt > maxRetries || !isRetryable(lastError)) {
          throw lastError;
        }

        // 自定义错误处理
        if (onError) {
          const action = onError(context);
          switch (action.action) {
            case 'abort':
              throw lastError;
            case 'skip':
              return undefined as T;
            case 'fallback':
              return action.fallbackFn() as Promise<T>;
            case 'checkpoint_restore':
              // 需要状态机配合
              throw new Error('Checkpoint restore requires state machine');
            case 'retry':
              // 继续重试
              break;
          }
        }

        // 重试前回调
        await beforeRetry?.(context);

        // 等待延迟
        const delay = getDelay(attempt);
        if (delay > 0) {
          await sleep(delay);
        }

        // 重试后回调
        afterRetry?.(context, false);
      }
    }

    throw lastError!;
  }

  return {
    execute,
    getDelay,
    isRetryable,
    reset() {
      // 可以添加重试计数重置逻辑
    },
  };
}

function fibonacci(n: number): number {
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

### Phase 2: Planner 层 - Plan DAG (P0/P1)

#### 2.1 PlanDAG

**文件**: `packages/libs/agent/src/planner/`

```typescript
// types.ts
export type PlanNodeStatus =
  | 'pending'
  | 'ready'       // 所有依赖完成，可执行
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PlanNode {
  id: string;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
  status: PlanNodeStatus;
  result?: string;
  error?: string;
  /** 依赖的节点 ID */
  dependsOn: string[];
  /** 被依赖的节点 ID */
  blockedBy: string[];
  /** 预估执行时间 */
  estimatedDuration?: number;
  /** 实际执行时间 */
  actualDuration?: number;
  /** 优先级 (数字越小越优先) */
  priority?: number;
  /** 是否可并行执行 */
  parallel?: boolean;
}

export interface PlanDAG {
  id: string;
  goal: string;
  nodes: Map<string, PlanNode>;
  /** 拓扑排序后的执行顺序 */
  executionOrder: string[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface PlannerConfig {
  /** 规划模式 */
  mode: 'react' | 'plan-execute' | 'hybrid';
  /** 最大步骤数 */
  maxSteps?: number;
  /** 是否允许动态调整 */
  allowDynamicReplanning?: boolean;
  /** 使用的模型 (默认用 agent 配置的模型) */
  model?: string;
  /** 规划 prompt */
  planPrompt?: string;
}
```

```typescript
// plan-dag.ts
export interface PlanDAGInstance {
  /** 获取 DAG */
  getDAG(): PlanDAG;
  /** 添加节点 */
  addNode(node: Omit<PlanNode, 'status' | 'blockedBy'>): void;
  /** 添加依赖边 */
  addEdge(fromId: string, toId: string): void;
  /** 移除节点 */
  removeNode(nodeId: string): void;
  /** 获取可执行的节点 (所有依赖已完成) */
  getReadyNodes(): PlanNode[];
  /** 获取可并行执行的节点组 */
  getParallelBatch(): PlanNode[];
  /** 标记节点开始执行 */
  markExecuting(nodeId: string): void;
  /** 标记节点完成 */
  markCompleted(nodeId: string, result: string): void;
  /** 标记节点失败 */
  markFailed(nodeId: string, error: string): void;
  /** 标记节点跳过 */
  markSkipped(nodeId: string, reason: string): void;
  /** 检查是否有环 */
  hasCycle(): boolean;
  /** 获取进度 */
  getProgress(): { total: number; completed: number; failed: number; pending: number };
  /** 是否全部完成 */
  isComplete(): boolean;
  /** 验证 DAG 有效性 */
  validate(): { valid: boolean; errors: string[] };
  /** 重置 DAG */
  reset(): void;
  /** 导出为 JSON */
  toJSON(): string;
  /** 从 JSON 导入 */
  fromJSON(json: string): void;
}

export function createPlanDAG(goal: string): PlanDAGInstance {
  const dag: PlanDAG = {
    id: generateId(),
    goal,
    nodes: new Map(),
    executionOrder: [],
    status: 'planning',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  function updateExecutionOrder() {
    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // 初始化入度
    for (const [id, node] of dag.nodes) {
      inDegree.set(id, node.dependsOn.length);
      if (node.dependsOn.length === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      // 按优先级排序
      queue.sort((a, b) => {
        const nodeA = dag.nodes.get(a)!;
        const nodeB = dag.nodes.get(b)!;
        return (nodeA.priority ?? 0) - (nodeB.priority ?? 0);
      });

      const nodeId = queue.shift()!;
      result.push(nodeId);

      // 更新依赖节点的入度
      for (const [id, node] of dag.nodes) {
        if (node.dependsOn.includes(nodeId)) {
          const newDegree = inDegree.get(id)! - 1;
          inDegree.set(id, newDegree);
          if (newDegree === 0) {
            queue.push(id);
          }
        }
      }
    }

    dag.executionOrder = result;
  }

  function updateBlockedBy() {
    for (const [id, node] of dag.nodes) {
      node.blockedBy = [];
      for (const depId of node.dependsOn) {
        const depNode = dag.nodes.get(depId);
        if (depNode && depNode.status !== 'completed') {
          node.blockedBy.push(depId);
        }
      }
    }
  }

  return {
    getDAG() {
      return dag;
    },

    addNode(node: Omit<PlanNode, 'status' | 'blockedBy'>) {
      const fullNode: PlanNode = {
        ...node,
        status: 'pending',
        blockedBy: [...node.dependsOn],
      };
      dag.nodes.set(node.id, fullNode);
      updateExecutionOrder();
      dag.updatedAt = Date.now();
    },

    addEdge(fromId: string, toId: string) {
      const toNode = dag.nodes.get(toId);
      if (toNode && !toNode.dependsOn.includes(fromId)) {
        toNode.dependsOn.push(fromId);
        toNode.blockedBy.push(fromId);
        updateExecutionOrder();
        dag.updatedAt = Date.now();
      }
    },

    removeNode(nodeId: string) {
      dag.nodes.delete(nodeId);
      // 清理依赖关系
      for (const node of dag.nodes.values()) {
        node.dependsOn = node.dependsOn.filter(id => id !== nodeId);
        node.blockedBy = node.blockedBy.filter(id => id !== nodeId);
      }
      updateExecutionOrder();
      dag.updatedAt = Date.now();
    },

    getReadyNodes() {
      updateBlockedBy();
      const ready: PlanNode[] = [];
      for (const node of dag.nodes.values()) {
        if (node.status === 'pending' && node.blockedBy.length === 0) {
          node.status = 'ready';
          ready.push(node);
        }
      }
      return ready;
    },

    getParallelBatch() {
      const ready = this.getReadyNodes();
      return ready.filter(node => node.parallel !== false);
    },

    markExecuting(nodeId: string) {
      const node = dag.nodes.get(nodeId);
      if (node) {
        node.status = 'executing';
        dag.status = 'executing';
        dag.updatedAt = Date.now();
      }
    },

    markCompleted(nodeId: string, result: string) {
      const node = dag.nodes.get(nodeId);
      if (node) {
        node.status = 'completed';
        node.result = result;
        updateBlockedBy();
        dag.updatedAt = Date.now();

        if (this.isComplete()) {
          dag.status = 'completed';
        }
      }
    },

    markFailed(nodeId: string, error: string) {
      const node = dag.nodes.get(nodeId);
      if (node) {
        node.status = 'failed';
        node.error = error;
        dag.status = 'failed';
        dag.updatedAt = Date.now();
      }
    },

    markSkipped(nodeId: string, reason: string) {
      const node = dag.nodes.get(nodeId);
      if (node) {
        node.status = 'skipped';
        node.result = `Skipped: ${reason}`;
        updateBlockedBy();
        dag.updatedAt = Date.now();
      }
    },

    hasCycle() {
      // DFS 检测环
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

    getProgress() {
      let completed = 0, failed = 0, pending = 0;
      for (const node of dag.nodes.values()) {
        switch (node.status) {
          case 'completed':
          case 'skipped':
            completed++;
            break;
          case 'failed':
            failed++;
            break;
          default:
            pending++;
        }
      }
      return { total: dag.nodes.size, completed, failed, pending };
    },

    isComplete() {
      for (const node of dag.nodes.values()) {
        if (node.status !== 'completed' && node.status !== 'skipped' && node.status !== 'failed') {
          return false;
        }
      }
      return true;
    },

    validate() {
      const errors: string[] = [];

      // 检查环
      if (this.hasCycle()) {
        errors.push('DAG contains a cycle');
      }

      // 检查孤立节点引用
      for (const node of dag.nodes.values()) {
        for (const depId of node.dependsOn) {
          if (!dag.nodes.has(depId)) {
            errors.push(`Node ${node.id} depends on non-existent node ${depId}`);
          }
        }
      }

      return { valid: errors.length === 0, errors };
    },

    reset() {
      for (const node of dag.nodes.values()) {
        node.status = 'pending';
        node.result = undefined;
        node.error = undefined;
        node.actualDuration = undefined;
      }
      dag.status = 'planning';
      dag.updatedAt = Date.now();
    },

    toJSON() {
      return JSON.stringify({
        ...dag,
        nodes: Array.from(dag.nodes.entries()),
      });
    },

    fromJSON(json: string) {
      const data = JSON.parse(json);
      dag.id = data.id;
      dag.goal = data.goal;
      dag.nodes = new Map(data.nodes);
      dag.executionOrder = data.executionOrder;
      dag.status = data.status;
      dag.createdAt = data.createdAt;
      dag.updatedAt = data.updatedAt;
    },
  };
}
```

#### 2.2 Planner (LLM Plan Generation)

```typescript
// planner.ts
export interface PlannerInstance {
  /** 生成执行计划 */
  plan(goal: string, context?: PlanContext): Promise<PlanDAGInstance>;
  /** 动态调整计划 */
  replan(dag: PlanDAGInstance, reason: string): Promise<PlanDAGInstance>;
  /** 分解复杂步骤 */
  decompose(node: PlanNode): Promise<PlanNode[]>;
}

const PLAN_PROMPT = `You are a task planner. Given a goal, create a structured execution plan.

Output a JSON array of steps:
[
  {
    "id": "step_1",
    "description": "What this step does",
    "tool": "tool_name_to_use",
    "args": { "arg1": "value1" },
    "dependsOn": [],
    "parallel": true,
    "priority": 1
  },
  ...
]

Rules:
- Each step should be atomic and executable
- Use dependsOn to specify dependencies (step IDs)
- Steps with no dependencies can run in parallel if parallel=true
- Lower priority number = higher priority
- Tool names must match available tools exactly

Available tools:
{{tools}}

Goal: {{goal}}

Context:
{{context}}
`;

export function createPlanner(
  config: PlannerConfig,
  llmChat: (prompt: string) => Promise<string>
): PlannerInstance {
  return {
    async plan(goal: string, context?: PlanContext) {
      const prompt = PLAN_PROMPT
        .replace('{{goal}}', goal)
        .replace('{{tools}}', JSON.stringify(context?.availableTools ?? []))
        .replace('{{context}}', JSON.stringify(context?.additionalContext ?? {}));

      const response = await llmChat(prompt);
      const steps = JSON.parse(extractJSON(response));

      const dag = createPlanDAG(goal);
      for (const step of steps) {
        dag.addNode(step);
      }

      // 验证
      const validation = dag.validate();
      if (!validation.valid) {
        throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
      }

      return dag;
    },

    async replan(dag: PlanDAGInstance, reason: string) {
      // 获取当前状态
      const currentDAG = dag.getDAG();
      const completed = Array.from(currentDAG.nodes.values())
        .filter(n => n.status === 'completed');

      // 请求 LLM 重新规划
      const replanPrompt = `
The current plan failed or needs adjustment.
Reason: ${reason}

Completed steps:
${JSON.stringify(completed.map(n => ({ id: n.id, result: n.result })))}

Please provide updated remaining steps.
`;

      const response = await llmChat(replanPrompt);
      const newSteps = JSON.parse(extractJSON(response));

      // 更新 DAG
      for (const step of newSteps) {
        dag.addNode(step);
      }

      return dag;
    },

    async decompose(node: PlanNode) {
      const decomposePrompt = `
Break down this step into smaller sub-steps:
${JSON.stringify(node)}

Return a JSON array of sub-steps.
`;

      const response = await llmChat(decomposePrompt);
      return JSON.parse(extractJSON(response));
    },
  };
}
```

---

### Phase 3: Evaluator 层 (P0)

**文件**: `packages/libs/agent/src/evaluator/`

```typescript
// types.ts
export interface EvaluationCriteria {
  /** 准确性权重 */
  accuracy?: number;
  /** 完整性权重 */
  completeness?: number;
  /** 相关性权重 */
  relevance?: number;
  /** 安全性权重 */
  safety?: number;
  /** 自定义标准 */
  custom?: Array<{
    name: string;
    weight: number;
    evaluator: (output: string, context: EvalContext) => number;
  }>;
}

export interface EvaluationResult {
  /** 总分 (0-1) */
  score: number;
  /** 各维度分数 */
  breakdown: Record<string, number>;
  /** 是否通过 */
  passed: boolean;
  /** 问题列表 */
  issues: string[];
  /** 改进建议 */
  suggestions: string[];
  /** 是否需要重试 */
  shouldRetry: boolean;
  /** 重试原因 */
  retryReason?: string;
}

export interface SelfCheckResult {
  /** 是否一致 */
  consistent: boolean;
  /** 发现的问题 */
  problems: string[];
  /** 置信度 (0-1) */
  confidence: number;
}

export interface EvaluatorConfig {
  /** 通过阈值 */
  passThreshold?: number;
  /** 是否使用 LLM 评估 */
  useLLMEval?: boolean;
  /** 评估模型 (可以用更便宜的模型) */
  evalModel?: string;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 评估标准 */
  criteria?: EvaluationCriteria;
}
```

```typescript
// evaluator.ts
export interface EvaluatorInstance {
  /** 评估输出质量 */
  evaluate(output: string, context: EvalContext): Promise<EvaluationResult>;
  /** 自检一致性 */
  selfCheck(response: string, context: EvalContext): Promise<SelfCheckResult>;
  /** 判断是否应该重试 */
  shouldRetry(result: EvaluationResult): boolean;
  /** 生成改进建议 */
  getSuggestions(result: EvaluationResult): string[];
}

const EVAL_PROMPT = `You are an AI output evaluator. Evaluate the following output.

Output to evaluate:
"""
{{output}}
"""

Original request:
"""
{{request}}
"""

Context:
{{context}}

Evaluate on these criteria (score 0-10 for each):
1. Accuracy: Is the information correct?
2. Completeness: Does it fully address the request?
3. Relevance: Is it focused on what was asked?
4. Safety: Is it safe and appropriate?

Respond in JSON:
{
  "scores": {
    "accuracy": 8,
    "completeness": 7,
    "relevance": 9,
    "safety": 10
  },
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1"],
  "overallAssessment": "good/acceptable/poor"
}
`;

const SELF_CHECK_PROMPT = `You are checking your own response for consistency and correctness.

Your previous response:
"""
{{response}}
"""

Original request:
"""
{{request}}
"""

Tools used and results:
{{toolResults}}

Check for:
1. Logical consistency
2. Factual accuracy based on tool results
3. Completeness of the response
4. Any contradictions

Respond in JSON:
{
  "consistent": true/false,
  "confidence": 0.95,
  "problems": ["problem1", "problem2"],
  "corrections": ["correction1"]
}
`;

export function createEvaluator(
  config: EvaluatorConfig,
  llmChat: (prompt: string, model?: string) => Promise<string>
): EvaluatorInstance {
  const {
    passThreshold = 0.7,
    useLLMEval = true,
    evalModel,
    maxRetries = 2,
    criteria = { accuracy: 0.3, completeness: 0.3, relevance: 0.2, safety: 0.2 },
  } = config;

  async function evaluate(output: string, context: EvalContext): Promise<EvaluationResult> {
    if (useLLMEval) {
      const prompt = EVAL_PROMPT
        .replace('{{output}}', output)
        .replace('{{request}}', context.originalRequest)
        .replace('{{context}}', JSON.stringify(context.additionalContext ?? {}));

      const response = await llmChat(prompt, evalModel);
      const evalData = JSON.parse(extractJSON(response));

      // 计算加权总分
      const weights = criteria;
      let totalWeight = 0;
      let weightedSum = 0;

      const breakdown: Record<string, number> = {};
      for (const [key, weight] of Object.entries(weights)) {
        if (typeof weight === 'number' && evalData.scores[key] !== undefined) {
          const normalizedScore = evalData.scores[key] / 10;
          breakdown[key] = normalizedScore;
          weightedSum += normalizedScore * weight;
          totalWeight += weight;
        }
      }

      const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
      const passed = score >= passThreshold;

      return {
        score,
        breakdown,
        passed,
        issues: evalData.issues ?? [],
        suggestions: evalData.suggestions ?? [],
        shouldRetry: !passed && (context.retryCount ?? 0) < maxRetries,
        retryReason: !passed ? `Score ${score.toFixed(2)} below threshold ${passThreshold}` : undefined,
      };
    }

    // 简单规则评估 (不使用 LLM)
    return {
      score: 0.8,
      breakdown: {},
      passed: true,
      issues: [],
      suggestions: [],
      shouldRetry: false,
    };
  }

  async function selfCheck(response: string, context: EvalContext): Promise<SelfCheckResult> {
    if (!useLLMEval) {
      return { consistent: true, problems: [], confidence: 0.5 };
    }

    const prompt = SELF_CHECK_PROMPT
      .replace('{{response}}', response)
      .replace('{{request}}', context.originalRequest)
      .replace('{{toolResults}}', JSON.stringify(context.toolResults ?? []));

    const checkResponse = await llmChat(prompt, evalModel);
    const checkData = JSON.parse(extractJSON(checkResponse));

    return {
      consistent: checkData.consistent,
      problems: checkData.problems ?? [],
      confidence: checkData.confidence ?? 0.5,
    };
  }

  return {
    evaluate,
    selfCheck,

    shouldRetry(result: EvaluationResult) {
      return result.shouldRetry;
    },

    getSuggestions(result: EvaluationResult) {
      return result.suggestions;
    },
  };
}
```

---

### Phase 4: Model Router (P0)

**文件**: `packages/libs/agent/src/router/`

```typescript
// types.ts
export type TaskComplexity = 'simple' | 'medium' | 'complex';
export type TaskType =
  | 'tool_selection'
  | 'planning'
  | 'reasoning'
  | 'code_generation'
  | 'summarization'
  | 'formatting'
  | 'classification'
  | 'extraction'
  | 'conversation';

export interface ModelTier {
  /** 模型 ID */
  model: string;
  /** Provider */
  provider?: 'openai' | 'anthropic' | 'google';
  /** 每 1K token 输入成本 */
  inputCost: number;
  /** 每 1K token 输出成本 */
  outputCost: number;
  /** 最大 context 长度 */
  maxContext: number;
  /** 支持的任务类型 */
  supportedTasks: TaskType[];
  /** 延迟等级 (1-10, 1 最快) */
  latencyTier: number;
}

export interface RouterConfig {
  /** 快速模型 (tool selection, formatting) */
  fast: ModelTier;
  /** 标准模型 (general tasks) */
  standard: ModelTier;
  /** 强模型 (complex reasoning, planning) */
  strong: ModelTier;
  /** 默认模型 */
  default?: 'fast' | 'standard' | 'strong';
  /** 任务类型到模型的映射 */
  taskModelMap?: Partial<Record<TaskType, 'fast' | 'standard' | 'strong'>>;
  /** 成本优化模式 */
  costOptimization?: boolean;
  /** 每日成本限制 */
  dailyCostLimit?: number;
}

export interface RoutingDecision {
  tier: 'fast' | 'standard' | 'strong';
  model: string;
  reason: string;
  estimatedCost?: number;
}
```

```typescript
// model-router.ts
export interface ModelRouterInstance {
  /** 根据任务路由到合适的模型 */
  route(task: TaskType, context?: RoutingContext): RoutingDecision;
  /** 根据复杂度路由 */
  routeByComplexity(complexity: TaskComplexity): RoutingDecision;
  /** 获取当前成本统计 */
  getCostStats(): CostStats;
  /** 重置成本统计 */
  resetCostStats(): void;
  /** 记录使用量 */
  recordUsage(tier: 'fast' | 'standard' | 'strong', tokens: { input: number; output: number }): void;
  /** 检查是否超出成本限制 */
  isCostLimitReached(): boolean;
}

const DEFAULT_TASK_MODEL_MAP: Record<TaskType, 'fast' | 'standard' | 'strong'> = {
  tool_selection: 'fast',
  classification: 'fast',
  extraction: 'fast',
  formatting: 'fast',
  summarization: 'standard',
  conversation: 'standard',
  code_generation: 'strong',
  reasoning: 'strong',
  planning: 'strong',
};

export function createModelRouter(config: RouterConfig): ModelRouterInstance {
  const taskModelMap = { ...DEFAULT_TASK_MODEL_MAP, ...config.taskModelMap };
  const tiers = { fast: config.fast, standard: config.standard, strong: config.strong };

  let costStats = {
    fast: { input: 0, output: 0, cost: 0 },
    standard: { input: 0, output: 0, cost: 0 },
    strong: { input: 0, output: 0, cost: 0 },
    total: 0,
    startDate: Date.now(),
  };

  function route(task: TaskType, context?: RoutingContext): RoutingDecision {
    // 检查成本限制
    if (config.dailyCostLimit && costStats.total >= config.dailyCostLimit) {
      // 降级到最便宜的模型
      return {
        tier: 'fast',
        model: tiers.fast.model,
        reason: 'Cost limit reached, using cheapest model',
      };
    }

    // 根据任务类型选择
    let tier = taskModelMap[task] ?? config.default ?? 'standard';

    // 成本优化：尝试用更便宜的模型
    if (config.costOptimization && context?.canDowngrade) {
      if (tier === 'strong' && tiers.standard.supportedTasks.includes(task)) {
        tier = 'standard';
      } else if (tier === 'standard' && tiers.fast.supportedTasks.includes(task)) {
        tier = 'fast';
      }
    }

    // 上下文长度检查
    const estimatedTokens = context?.estimatedTokens ?? 0;
    if (estimatedTokens > tiers[tier].maxContext) {
      // 需要更大上下文的模型
      if (tier === 'fast' && estimatedTokens <= tiers.standard.maxContext) {
        tier = 'standard';
      } else if (estimatedTokens <= tiers.strong.maxContext) {
        tier = 'strong';
      } else {
        throw new Error(`Input too long: ${estimatedTokens} tokens exceeds all models`);
      }
    }

    const selectedTier = tiers[tier];
    const estimatedCost = estimatedTokens > 0
      ? (estimatedTokens / 1000) * (selectedTier.inputCost + selectedTier.outputCost)
      : undefined;

    return {
      tier,
      model: selectedTier.model,
      reason: `Task type '${task}' routed to ${tier} tier`,
      estimatedCost,
    };
  }

  return {
    route,

    routeByComplexity(complexity: TaskComplexity) {
      const tierMap: Record<TaskComplexity, 'fast' | 'standard' | 'strong'> = {
        simple: 'fast',
        medium: 'standard',
        complex: 'strong',
      };
      const tier = tierMap[complexity];
      return {
        tier,
        model: tiers[tier].model,
        reason: `Complexity '${complexity}' routed to ${tier} tier`,
      };
    },

    getCostStats() {
      return { ...costStats };
    },

    resetCostStats() {
      costStats = {
        fast: { input: 0, output: 0, cost: 0 },
        standard: { input: 0, output: 0, cost: 0 },
        strong: { input: 0, output: 0, cost: 0 },
        total: 0,
        startDate: Date.now(),
      };
    },

    recordUsage(tier, tokens) {
      const tierConfig = tiers[tier];
      const cost = (tokens.input / 1000) * tierConfig.inputCost +
                   (tokens.output / 1000) * tierConfig.outputCost;

      costStats[tier].input += tokens.input;
      costStats[tier].output += tokens.output;
      costStats[tier].cost += cost;
      costStats.total += cost;
    },

    isCostLimitReached() {
      return config.dailyCostLimit !== undefined && costStats.total >= config.dailyCostLimit;
    },
  };
}
```

---

### Phase 5: Metrics Aggregator (P1)

**文件**: `packages/libs/agent/src/metrics/`

```typescript
// types.ts
export interface MetricPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

export interface AggregatedMetrics {
  latency: {
    p50: number;
    p90: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  cost: {
    total: number;
    byModel: Record<string, number>;
    byOperation: Record<string, number>;
  };
  throughput: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    rate: number;
  };
  toolUsage: {
    callCount: Record<string, number>;
    avgDuration: Record<string, number>;
    successRate: Record<string, number>;
  };
}

export interface MetricsConfig {
  /** 是否启用 */
  enabled?: boolean;
  /** 聚合间隔 (ms) */
  aggregationInterval?: number;
  /** 保留历史数据时长 (ms) */
  retentionPeriod?: number;
  /** 导出回调 */
  onExport?: (metrics: AggregatedMetrics) => void;
  /** 导出间隔 (ms) */
  exportInterval?: number;
}
```

```typescript
// metrics-aggregator.ts
export interface MetricsAggregatorInstance {
  /** 记录延迟 */
  recordLatency(operation: string, durationMs: number, labels?: Record<string, string>): void;
  /** 记录成本 */
  recordCost(model: string, operation: string, cost: number): void;
  /** 记录错误 */
  recordError(operation: string, errorType: string): void;
  /** 记录工具调用 */
  recordToolCall(toolName: string, durationMs: number, success: boolean): void;
  /** 记录 token 使用 */
  recordTokens(model: string, input: number, output: number): void;
  /** 获取聚合指标 */
  getMetrics(): AggregatedMetrics;
  /** 获取特定时间范围的指标 */
  getMetricsInRange(startMs: number, endMs: number): AggregatedMetrics;
  /** 重置所有指标 */
  reset(): void;
  /** 导出指标 */
  export(): AggregatedMetrics;
  /** 开始自动导出 */
  startAutoExport(): void;
  /** 停止自动导出 */
  stopAutoExport(): void;
}

export function createMetricsAggregator(config: MetricsConfig = {}): MetricsAggregatorInstance {
  const {
    enabled = true,
    aggregationInterval = 60000,
    retentionPeriod = 3600000,
    onExport,
    exportInterval = 60000,
  } = config;

  // 存储原始数据点
  const latencyPoints: MetricPoint[] = [];
  const costPoints: Array<{ timestamp: number; model: string; operation: string; cost: number }> = [];
  const errorPoints: Array<{ timestamp: number; operation: string; errorType: string }> = [];
  const toolCallPoints: Array<{ timestamp: number; tool: string; duration: number; success: boolean }> = [];
  const tokenPoints: Array<{ timestamp: number; model: string; input: number; output: number }> = [];

  let exportTimer: NodeJS.Timeout | null = null;

  function cleanup() {
    const cutoff = Date.now() - retentionPeriod;
    // 清理过期数据
    while (latencyPoints.length > 0 && latencyPoints[0].timestamp < cutoff) {
      latencyPoints.shift();
    }
    // ... 其他数据同理
  }

  function percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil(arr.length * p) - 1;
    return sorted[Math.max(0, idx)];
  }

  function aggregate(): AggregatedMetrics {
    cleanup();
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 延迟聚合
    const latencies = latencyPoints.map(p => p.value);
    const latencyMetrics = {
      p50: percentile(latencies, 0.5),
      p90: percentile(latencies, 0.9),
      p99: percentile(latencies, 0.99),
      avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      min: latencies.length > 0 ? Math.min(...latencies) : 0,
      max: latencies.length > 0 ? Math.max(...latencies) : 0,
    };

    // 成本聚合
    const costByModel: Record<string, number> = {};
    const costByOperation: Record<string, number> = {};
    let totalCost = 0;
    for (const point of costPoints) {
      totalCost += point.cost;
      costByModel[point.model] = (costByModel[point.model] ?? 0) + point.cost;
      costByOperation[point.operation] = (costByOperation[point.operation] ?? 0) + point.cost;
    }

    // 吞吐量 (过去一分钟)
    const recentRequests = latencyPoints.filter(p => p.timestamp >= oneMinuteAgo).length;
    const recentTokens = tokenPoints
      .filter(p => p.timestamp >= oneMinuteAgo)
      .reduce((sum, p) => sum + p.input + p.output, 0);

    // 错误聚合
    const errorByType: Record<string, number> = {};
    for (const point of errorPoints) {
      errorByType[point.errorType] = (errorByType[point.errorType] ?? 0) + 1;
    }
    const totalErrors = errorPoints.length;
    const totalRequests = latencyPoints.length;
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    // 工具使用聚合
    const toolCallCount: Record<string, number> = {};
    const toolDurations: Record<string, number[]> = {};
    const toolSuccesses: Record<string, number> = {};
    const toolTotals: Record<string, number> = {};

    for (const point of toolCallPoints) {
      toolCallCount[point.tool] = (toolCallCount[point.tool] ?? 0) + 1;
      toolDurations[point.tool] = toolDurations[point.tool] ?? [];
      toolDurations[point.tool].push(point.duration);
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

    return {
      latency: latencyMetrics,
      cost: { total: totalCost, byModel: costByModel, byOperation: costByOperation },
      throughput: { requestsPerMinute: recentRequests, tokensPerMinute: recentTokens },
      errors: { total: totalErrors, byType: errorByType, rate: errorRate },
      toolUsage: {
        callCount: toolCallCount,
        avgDuration: toolAvgDuration,
        successRate: toolSuccessRate,
      },
    };
  }

  return {
    recordLatency(operation, durationMs, labels) {
      if (!enabled) return;
      latencyPoints.push({
        timestamp: Date.now(),
        value: durationMs,
        labels: { operation, ...labels },
      });
    },

    recordCost(model, operation, cost) {
      if (!enabled) return;
      costPoints.push({ timestamp: Date.now(), model, operation, cost });
    },

    recordError(operation, errorType) {
      if (!enabled) return;
      errorPoints.push({ timestamp: Date.now(), operation, errorType });
    },

    recordToolCall(toolName, durationMs, success) {
      if (!enabled) return;
      toolCallPoints.push({
        timestamp: Date.now(),
        tool: toolName,
        duration: durationMs,
        success,
      });
    },

    recordTokens(model, input, output) {
      if (!enabled) return;
      tokenPoints.push({ timestamp: Date.now(), model, input, output });
    },

    getMetrics() {
      return aggregate();
    },

    getMetricsInRange(startMs, endMs) {
      // 过滤时间范围后聚合
      // ... 实现略
      return aggregate();
    },

    reset() {
      latencyPoints.length = 0;
      costPoints.length = 0;
      errorPoints.length = 0;
      toolCallPoints.length = 0;
      tokenPoints.length = 0;
    },

    export() {
      const metrics = aggregate();
      onExport?.(metrics);
      return metrics;
    },

    startAutoExport() {
      if (exportTimer) return;
      exportTimer = setInterval(() => {
        this.export();
      }, exportInterval);
    },

    stopAutoExport() {
      if (exportTimer) {
        clearInterval(exportTimer);
        exportTimer = null;
      }
    },
  };
}
```

---

### Phase 6: 进阶模块 (P2)

#### 6.1 Guardrail Layer

```typescript
// guardrail/types.ts
export interface GuardrailRule {
  id: string;
  name: string;
  type: 'input' | 'output' | 'tool';
  check: (content: string, context?: GuardrailContext) => GuardrailResult;
  severity: 'block' | 'warn' | 'log';
}

export interface GuardrailResult {
  passed: boolean;
  ruleId: string;
  message?: string;
  suggestions?: string[];
}

export interface GuardrailConfig {
  rules: GuardrailRule[];
  onViolation?: (result: GuardrailResult) => void;
  blockOnViolation?: boolean;
}
```

```typescript
// guardrail/guardrail.ts
export interface GuardrailInstance {
  checkInput(input: string): Promise<GuardrailResult[]>;
  checkOutput(output: string): Promise<GuardrailResult[]>;
  checkToolCall(toolName: string, args: Record<string, unknown>): Promise<GuardrailResult[]>;
  addRule(rule: GuardrailRule): void;
  removeRule(ruleId: string): void;
}

// 内置规则
export const BUILTIN_RULES: GuardrailRule[] = [
  {
    id: 'no_pii',
    name: 'No PII in output',
    type: 'output',
    severity: 'block',
    check: (content) => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
      const ssnRegex = /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g;

      const hasEmail = emailRegex.test(content);
      const hasPhone = phoneRegex.test(content);
      const hasSSN = ssnRegex.test(content);

      return {
        passed: !hasEmail && !hasPhone && !hasSSN,
        ruleId: 'no_pii',
        message: hasSSN ? 'Contains SSN' : hasEmail ? 'Contains email' : 'Contains phone',
      };
    },
  },
  {
    id: 'no_secrets',
    name: 'No secrets in output',
    type: 'output',
    severity: 'block',
    check: (content) => {
      const patterns = [
        /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
        /password\s*[:=]\s*['"]?[^\s'"]+/i,
        /secret\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
        /token\s*[:=]\s*['"]?[a-zA-Z0-9_-]{20,}/i,
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return { passed: false, ruleId: 'no_secrets', message: 'Contains potential secret' };
        }
      }

      return { passed: true, ruleId: 'no_secrets' };
    },
  },
  {
    id: 'no_dangerous_commands',
    name: 'No dangerous shell commands',
    type: 'tool',
    severity: 'block',
    check: (content, context) => {
      if (context?.toolName !== 'bash_execute') {
        return { passed: true, ruleId: 'no_dangerous_commands' };
      }

      const dangerous = [
        /rm\s+-rf\s+\//,
        /mkfs/,
        /dd\s+if=.*of=\/dev/,
        /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,  // fork bomb
      ];

      for (const pattern of dangerous) {
        if (pattern.test(content)) {
          return { passed: false, ruleId: 'no_dangerous_commands', message: 'Dangerous command detected' };
        }
      }

      return { passed: true, ruleId: 'no_dangerous_commands' };
    },
  },
];
```

#### 6.2 Sub-agent Manager

```typescript
// sub-agent/types.ts
export interface SubAgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  tools?: string[];
  model?: string;
  maxIterations?: number;
}

export interface SubAgentTask {
  agentId: string;
  input: string;
  timeout?: number;
}

export interface SubAgentResult {
  agentId: string;
  output: string;
  success: boolean;
  error?: string;
  duration: number;
}
```

```typescript
// sub-agent/manager.ts
export interface SubAgentManagerInstance {
  /** 注册子 agent */
  register(config: SubAgentConfig): void;
  /** 移除子 agent */
  unregister(agentId: string): void;
  /** 执行单个子 agent */
  execute(task: SubAgentTask): Promise<SubAgentResult>;
  /** 并行执行多个子 agent */
  executeParallel(tasks: SubAgentTask[]): Promise<SubAgentResult[]>;
  /** 编排执行 (根据依赖关系) */
  orchestrate(dag: SubAgentDAG): Promise<SubAgentResult[]>;
  /** 获取所有注册的子 agent */
  getAgents(): SubAgentConfig[];
}

export function createSubAgentManager(
  parentAgent: AgentInstance
): SubAgentManagerInstance {
  const agents = new Map<string, AgentInstance>();
  const configs = new Map<string, SubAgentConfig>();

  return {
    register(config: SubAgentConfig) {
      const subAgent = createAgent({
        name: config.name,
        systemPrompt: config.systemPrompt,
        model: config.model,
        // 继承父 agent 的 provider 配置
      });

      // 只注册指定的工具
      if (config.tools) {
        const parentTools = parentAgent.getTools();
        for (const toolName of config.tools) {
          const tool = parentTools.find(t => t.name === toolName);
          if (tool) {
            subAgent.registerTool(tool);
          }
        }
      }

      agents.set(config.id, subAgent);
      configs.set(config.id, config);
    },

    unregister(agentId: string) {
      agents.delete(agentId);
      configs.delete(agentId);
    },

    async execute(task: SubAgentTask) {
      const agent = agents.get(task.agentId);
      if (!agent) {
        return {
          agentId: task.agentId,
          output: '',
          success: false,
          error: `Agent ${task.agentId} not found`,
          duration: 0,
        };
      }

      const start = Date.now();
      try {
        const response = await agent.chat(task.input, {
          maxIterations: configs.get(task.agentId)?.maxIterations ?? 10,
        });

        return {
          agentId: task.agentId,
          output: response.content,
          success: true,
          duration: Date.now() - start,
        };
      } catch (error) {
        return {
          agentId: task.agentId,
          output: '',
          success: false,
          error: (error as Error).message,
          duration: Date.now() - start,
        };
      }
    },

    async executeParallel(tasks: SubAgentTask[]) {
      return Promise.all(tasks.map(task => this.execute(task)));
    },

    async orchestrate(dag: SubAgentDAG) {
      // 按 DAG 依赖顺序执行
      const results: SubAgentResult[] = [];
      const completed = new Set<string>();

      while (results.length < dag.tasks.length) {
        // 找出所有依赖已完成的任务
        const ready = dag.tasks.filter(task => {
          if (completed.has(task.agentId)) return false;
          const deps = dag.edges
            .filter(e => e.to === task.agentId)
            .map(e => e.from);
          return deps.every(dep => completed.has(dep));
        });

        if (ready.length === 0) {
          throw new Error('DAG has unresolvable dependencies');
        }

        // 并行执行就绪的任务
        const batchResults = await this.executeParallel(ready);
        for (const result of batchResults) {
          results.push(result);
          completed.add(result.agentId);
        }
      }

      return results;
    },

    getAgents() {
      return Array.from(configs.values());
    },
  };
}
```

---

## 三、实施路线图

### Sprint 1 (Week 1-2): 核心状态管理 ✅
- [x] StateMachine 实现
- [x] RecoveryPolicy 实现
- [x] Checkpoint 存储

### Sprint 2 (Week 3-4): 规划系统 ✅
- [x] PlanDAG 实现
- [x] Planner (LLM 规划) 实现
- [ ] DAG 可视化 (可选,后续补充)

### Sprint 3 (Week 5-6): 评估与路由 ✅
- [x] Evaluator 实现
- [x] ModelRouter 实现
- [x] 成本优化逻辑

### Sprint 4 (Week 7-8): 可观测性 ✅
- [x] MetricsAggregator 实现
- [x] 仪表盘导出 (通过 onExport 回调)
- [x] 告警系统 (AlertCondition + checkAlerts)

### Sprint 5 (Week 9-10): 进阶功能 ✅
- [x] Guardrail 实现
- [x] SubAgentManager 实现
- [ ] Sandbox 集成 (可选,需外部依赖)

---

## 四、文件结构

```
packages/libs/agent/src/
├── state-machine/
│   ├── types.ts
│   ├── state-machine.ts
│   └── index.ts
├── recovery/
│   ├── types.ts
│   ├── recovery-policy.ts
│   └── index.ts
├── planner/
│   ├── types.ts
│   ├── plan-dag.ts
│   ├── planner.ts
│   └── index.ts
├── evaluator/
│   ├── types.ts
│   ├── evaluator.ts
│   └── index.ts
├── router/
│   ├── types.ts
│   ├── model-router.ts
│   └── index.ts
├── metrics/
│   ├── types.ts
│   ├── metrics-aggregator.ts
│   └── index.ts
├── guardrail/
│   ├── types.ts
│   ├── guardrail.ts
│   ├── rules/
│   │   ├── pii.ts
│   │   ├── secrets.ts
│   │   └── commands.ts
│   └── index.ts
└── sub-agent/
    ├── types.ts
    ├── manager.ts
    └── index.ts
```

---

## 五、更新后的 AgentConfig

```typescript
export interface AgentConfig {
  // 现有配置...

  // 新增配置
  /** 状态机配置 */
  stateMachine?: StateMachineConfig;
  /** 恢复策略配置 */
  recovery?: RecoveryPolicyConfig;
  /** 规划器配置 */
  planner?: PlannerConfig;
  /** 评估器配置 */
  evaluator?: EvaluatorConfig;
  /** 模型路由配置 */
  router?: RouterConfig;
  /** 指标聚合配置 */
  metrics?: MetricsConfig;
  /** Guardrail 配置 */
  guardrail?: GuardrailConfig;
  /** 子 Agent 配置 */
  subAgents?: SubAgentConfig[];
}
```

---

## 六、预期覆盖率提升

| 层级 | 当前 | 目标 |
|------|------|------|
| Client Layer | 80% | 95% |
| Orchestrator | 40% | 95% |
| Planner | 30% | 90% |
| Executor | 90% | 95% |
| Evaluator | 0% | 90% |
| Tool Layer | 95% | 98% |
| Memory Layer | 85% | 95% |
| Model Layer | 60% | 95% |
| Observability | 60% | 95% |

**总体**: 55-60% → **~94%**
