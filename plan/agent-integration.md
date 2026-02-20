# Agent 架构模块集成计划

## 一、当前架构分析

### 1.1 现有执行流程 (`chat()` 方法)

```
用户输入
    │
    ├── 1. 自动初始化 (MCP, Skill, Memory, Knowledge)
    │
    ├── 2. 记录用户消息到 Memory
    │
    ├── 3. 构建 System Prompt (注入 Memory/Knowledge 上下文)
    │
    ├── 4. 主循环:
    │       ├── 检查 maxIterations
    │       ├── LLM 调用
    │       ├── 如果有 tool_calls:
    │       │     ├── 并行执行工具 (带权限检查)
    │       │     └── 记录结果到 Memory
    │       └── 如果无 tool_calls: 返回响应
    │
    └── 5. 记录助手消息到 Memory
```

### 1.2 待集成模块

| 模块 | 职责 | 集成点 |
|------|------|--------|
| StateMachine | 状态管理 | 包装整个执行流程 |
| RecoveryPolicy | 错误恢复 | 工具执行、LLM 调用 |
| PlanDAG + Planner | 任务规划 | 替代简单循环 |
| Evaluator | 质量评估 | 响应返回前 |
| ModelRouter | 模型选择 | LLM 调用前 |
| MetricsAggregator | 指标收集 | 全程埋点 |
| Guardrail | 安全检查 | 输入/输出/工具调用 |

---

## 二、集成设计

### 2.1 新增配置类型

```typescript
// types.ts 扩展 AgentConfig
export interface AgentConfig {
  // ... 现有配置 ...

  // 新增: 架构模块配置
  stateMachine?: AgentStateMachineConfig;
  recovery?: AgentRecoveryConfig;
  planner?: AgentPlannerConfig;
  evaluator?: AgentEvaluatorConfig;
  router?: AgentRouterConfig;
  metrics?: AgentMetricsConfig;
  guardrail?: AgentGuardrailConfig;
}

// 规划器配置
export interface AgentPlannerConfig {
  enabled?: boolean;
  mode?: 'react' | 'plan-execute' | 'hybrid';
  maxSteps?: number;
  allowDynamicReplanning?: boolean;
}

// 评估器配置
export interface AgentEvaluatorConfig {
  enabled?: boolean;
  passThreshold?: number;
  maxRetries?: number;
  useLLMEval?: boolean;
  evalModel?: string;
}

// 路由器配置
export interface AgentRouterConfig {
  enabled?: boolean;
  fast?: ModelTier;
  standard?: ModelTier;
  strong?: ModelTier;
  costOptimization?: boolean;
  dailyCostLimit?: number;
}

// 指标配置
export interface AgentMetricsConfig {
  enabled?: boolean;
  onExport?: (metrics: AggregatedMetrics) => void;
  autoExportIntervalMs?: number;
  alerts?: AlertCondition[];
}

// Guardrail 配置
export interface AgentGuardrailConfig {
  enabled?: boolean;
  enableBuiltInRules?: boolean;
  customRules?: GuardrailRule[];
  blockOnViolation?: boolean;
}
```

### 2.2 集成后执行流程

```
用户输入
    │
    ├── 1. Guardrail 检查输入 ⭐ NEW
    │       └── 检测 PII/注入/长度
    │
    ├── 2. StateMachine: transition(START) ⭐ NEW
    │
    ├── 3. 自动初始化
    │
    ├── 4. Metrics: 记录请求开始 ⭐ NEW
    │
    ├── 5. ModelRouter: 选择模型 ⭐ NEW
    │       └── 根据任务类型/成本选择
    │
    ├── 6. Planner: 生成执行计划 (可选) ⭐ NEW
    │       ├── StateMachine: transition(PLAN_CREATED)
    │       └── 或使用 ReAct 模式跳过
    │
    ├── 7. 主执行循环:
    │       │
    │       ├── Plan-Execute 模式:
    │       │     └── 按 DAG 顺序执行节点
    │       │         ├── getParallelBatch() → 并行执行
    │       │         └── markCompleted/markFailed
    │       │
    │       └── ReAct 模式 (现有逻辑):
    │             ├── LLM 调用 (RecoveryPolicy 包装) ⭐ NEW
    │             └── 工具执行 (RecoveryPolicy 包装) ⭐ NEW
    │
    ├── 8. Guardrail 检查输出 ⭐ NEW
    │
    ├── 9. Evaluator: 评估响应质量 ⭐ NEW
    │       ├── 通过 → 继续
    │       └── 未通过 → 重试 (如果未超限)
    │
    ├── 10. StateMachine: transition(COMPLETE) ⭐ NEW
    │
    ├── 11. Metrics: 记录执行指标 ⭐ NEW
    │
    └── 12. 返回响应
```

---

## 三、实现步骤

### Phase 1: 基础集成 (状态机 + 指标)

**目标**: 添加状态跟踪和指标收集，不影响现有行为

1. **在 agent.ts 中添加模块实例变量**
   ```typescript
   let stateMachine: StateMachineInstance | null = null;
   let metricsAggregator: MetricsAggregatorInstance | null = null;
   ```

2. **在 createAgent() 中初始化**
   ```typescript
   if (config.stateMachine?.enabled) {
     stateMachine = createStateMachine(config.stateMachine);
   }
   if (config.metrics?.enabled) {
     metricsAggregator = createMetricsAggregator(config.metrics);
   }
   ```

3. **在 chat() 中添加状态转换和指标记录**
   - 入口: `stateMachine?.transition({ type: 'START', input })`
   - 出口: `stateMachine?.transition({ type: 'COMPLETE', result })`
   - 错误: `stateMachine?.transition({ type: 'ERROR', error })`
   - 指标: `metricsAggregator?.recordLatency/recordToolCall/...`

**文件改动**:
- `packages/libs/agent/src/agent.ts`
- `packages/libs/agent/src/types.ts`

---

### Phase 2: Guardrail 集成 (安全检查)

**目标**: 在输入/输出/工具调用时进行安全检查

1. **添加 Guardrail 实例**
   ```typescript
   let guardrail: GuardrailInstance | null = null;
   ```

2. **初始化**
   ```typescript
   if (config.guardrail?.enabled) {
     guardrail = createGuardrail({
       enableBuiltInRules: config.guardrail.enableBuiltInRules,
       rules: config.guardrail.customRules,
       blockOnViolation: config.guardrail.blockOnViolation,
     });
   }
   ```

3. **集成点**
   - `chat()` 入口: 检查用户输入
   - 返回前: 检查输出内容
   - 工具执行前: 检查工具调用

**代码示例**:
```typescript
// 输入检查
if (guardrail) {
  const inputResults = await guardrail.checkInput(input);
  if (guardrail.shouldBlock(inputResults)) {
    throw new Error(`Input blocked: ${inputResults.find(r => !r.passed)?.message}`);
  }
}

// 输出检查
if (guardrail) {
  const outputResults = await guardrail.checkOutput(content);
  if (guardrail.shouldBlock(outputResults)) {
    // 可以选择重试或返回错误
  }
}

// 工具调用检查
if (guardrail) {
  const toolResults = await guardrail.checkToolCall(toolName, args);
  if (guardrail.shouldBlock(toolResults)) {
    return { result: 'Tool call blocked', executed: false, denied: true };
  }
}
```

**文件改动**:
- `packages/libs/agent/src/agent.ts`

---

### Phase 3: Recovery 集成 (错误恢复)

**目标**: 为 LLM 调用和工具执行添加重试机制

1. **添加 RecoveryPolicy 实例**
   ```typescript
   let llmRecovery: RecoveryPolicyInstance | null = null;
   let toolRecovery: RecoveryPolicyInstance | null = null;
   ```

2. **初始化**
   ```typescript
   if (config.recovery?.enabled) {
     llmRecovery = createApiRecoveryPolicy({
       maxRetries: config.recovery.maxRetries,
       backoffStrategy: config.recovery.backoffStrategy,
     });
     toolRecovery = createToolRecoveryPolicy({
       maxRetries: 2,
     });
   }
   ```

3. **包装 LLM 调用**
   ```typescript
   async function doChat(...) {
     if (llmRecovery) {
       return llmRecovery.execute('llm_chat', () => {
         return provider ? provider.chat(...) : client!.chat(...);
       });
     }
     return provider ? provider.chat(...) : client!.chat(...);
   }
   ```

4. **包装工具执行**
   ```typescript
   async function executeToolWithPermission(...) {
     if (toolRecovery) {
       return toolRecovery.execute(`tool_${toolName}`, () => {
         return tool.execute(args);
       });
     }
     return tool.execute(args);
   }
   ```

**文件改动**:
- `packages/libs/agent/src/agent.ts`

---

### Phase 4: ModelRouter 集成 (模型路由)

**目标**: 根据任务类型智能选择模型

1. **添加 ModelRouter 实例**
   ```typescript
   let modelRouter: ModelRouterInstance | null = null;
   ```

2. **初始化**
   ```typescript
   if (config.router?.enabled) {
     modelRouter = createModelRouter({
       fast: config.router.fast,
       standard: config.router.standard,
       strong: config.router.strong,
       costOptimization: config.router.costOptimization,
       dailyCostLimit: config.router.dailyCostLimit,
     });
   }
   ```

3. **在 LLM 调用前选择模型**
   ```typescript
   function selectModel(taskType: TaskType): string {
     if (modelRouter) {
       const decision = modelRouter.route(taskType);
       return decision.model;
     }
     return agentConfig.model;
   }
   ```

4. **任务类型推断**
   - 有工具调用 → `tool_selection`
   - 规划阶段 → `planning`
   - 代码生成 → `code_generation`
   - 一般对话 → `conversation`

5. **记录使用量**
   ```typescript
   if (modelRouter && response.usage) {
     modelRouter.recordUsage(selectedTier, {
       input: response.usage.promptTokens,
       output: response.usage.completionTokens,
     });
   }
   ```

**文件改动**:
- `packages/libs/agent/src/agent.ts`

---

### Phase 5: Evaluator 集成 (质量评估)

**目标**: 评估响应质量，决定是否重试

1. **添加 Evaluator 实例**
   ```typescript
   let evaluator: EvaluatorInstance | null = null;
   ```

2. **初始化**
   ```typescript
   if (config.evaluator?.enabled) {
     evaluator = createEvaluator(
       {
         passThreshold: config.evaluator.passThreshold,
         useLLMEval: config.evaluator.useLLMEval,
         evalModel: config.evaluator.evalModel,
         maxRetries: config.evaluator.maxRetries,
       },
       async (prompt, model) => instance.complete(prompt, undefined) // 使用自身作为评估 LLM
     );
   }
   ```

3. **在返回前评估**
   ```typescript
   // 在 chat() 返回前
   if (evaluator && !skipEvaluation) {
     const evalResult = await evaluator.evaluate(content, {
       originalRequest: input,
       toolResults: toolCallResults.map(tc => ({
         name: tc.name,
         args: tc.args,
         result: tc.result,
         success: true,
       })),
       retryCount: currentRetryCount,
     });

     if (!evalResult.passed && evalResult.shouldRetry) {
       // 添加反馈到上下文，重试
       conversationHistory.push(userMessage(
         `Please improve your response. Issues: ${evalResult.issues.join(', ')}`
       ));
       currentRetryCount++;
       continue; // 继续主循环
     }
   }
   ```

**文件改动**:
- `packages/libs/agent/src/agent.ts`

---

### Phase 6: Planner 集成 (任务规划) - 可选模式

**目标**: 支持 Plan-Execute 模式的任务分解

1. **添加 Planner 实例**
   ```typescript
   let planner: PlannerInstance | null = null;
   ```

2. **初始化**
   ```typescript
   if (config.planner?.enabled) {
     planner = createPlanner(
       {
         mode: config.planner.mode,
         maxSteps: config.planner.maxSteps,
         allowDynamicReplanning: config.planner.allowDynamicReplanning,
       },
       async (prompt) => instance.complete(prompt)
     );
   }
   ```

3. **Plan-Execute 模式实现**
   ```typescript
   async function chatWithPlanning(input: string, options: ConversationOptions): Promise<AgentResponse> {
     // 1. 生成计划
     const dag = await planner.plan(input, {
       availableTools: Array.from(tools.values()).map(t => ({
         name: t.name,
         description: t.description,
         parameters: t.parameters,
       })),
     });

     stateMachine?.transition({ type: 'PLAN_CREATED', plan: dagToRef(dag) });

     // 2. 按 DAG 执行
     while (!dag.isComplete()) {
       const batch = dag.getParallelBatch(5);
       if (batch.length === 0) break;

       // 并行执行节点
       const results = await Promise.all(
         batch.map(async (node) => {
           dag.markExecuting(node.id);

           if (node.tool) {
             const tool = tools.get(node.tool);
             if (tool) {
               const result = await executeToolWithPermission(tool, node.args ?? {}, node.tool);
               dag.markCompleted(node.id, result.result);
               return { node, result: result.result };
             }
           }

           // 无工具节点 - 调用 LLM
           const response = await doChat([
             systemMessage(agentConfig.systemPrompt),
             userMessage(node.description),
           ], { model: agentConfig.model });
           dag.markCompleted(node.id, response.content ?? '');
           return { node, result: response.content ?? '' };
         })
       );
     }

     // 3. 生成最终响应
     const summaryPrompt = `Based on the completed tasks:\n${
       dag.getAllNodes().map(n => `- ${n.description}: ${n.result}`).join('\n')
     }\n\nProvide a summary response.`;

     const finalResponse = await doChat([
       systemMessage(agentConfig.systemPrompt),
       userMessage(summaryPrompt),
     ], { model: agentConfig.model });

     return { content: finalResponse.content ?? '' };
   }
   ```

4. **模式切换**
   ```typescript
   async chat(input: string, options: ConversationOptions = {}): Promise<AgentResponse> {
     // 判断是否使用规划模式
     if (planner && config.planner?.mode === 'plan-execute') {
       return chatWithPlanning(input, options);
     }

     // 否则使用现有 ReAct 模式
     return chatReact(input, options);
   }
   ```

**文件改动**:
- `packages/libs/agent/src/agent.ts`

---

## 四、AgentInstance 接口扩展

```typescript
export interface AgentInstance {
  // ... 现有方法 ...

  // 状态机
  getStateMachine(): StateMachineInstance | null;
  pause(): void;
  resume(): void;
  checkpoint(name?: string): Promise<string>;
  restore(checkpointId: string): Promise<void>;

  // 指标
  getMetrics(): AggregatedMetrics | null;
  resetMetrics(): void;

  // Guardrail
  getGuardrail(): GuardrailInstance | null;
  addGuardrailRule(rule: GuardrailRule): void;

  // 模型路由
  getModelRouter(): ModelRouterInstance | null;
  getCostStats(): CostStats | null;

  // 评估器
  getEvaluator(): EvaluatorInstance | null;

  // 规划器
  getPlanner(): PlannerInstance | null;
  getCurrentPlan(): PlanDAGInstance | null;
}
```

---

## 五、实施顺序和时间估计

| Phase | 内容 | 复杂度 | 预计时间 |
|-------|------|--------|----------|
| 1 | 状态机 + 指标 | 低 | 30 分钟 |
| 2 | Guardrail | 中 | 30 分钟 |
| 3 | Recovery | 低 | 20 分钟 |
| 4 | ModelRouter | 中 | 30 分钟 |
| 5 | Evaluator | 中 | 30 分钟 |
| 6 | Planner | 高 | 60 分钟 |

**总计**: 约 3-4 小时

---

## 六、向后兼容性

1. **所有新功能默认禁用**
   - 只有显式配置 `enabled: true` 才会启用
   - 不影响现有代码

2. **渐进式采用**
   - 可以单独启用某个模块
   - 不需要一次性全部启用

3. **配置示例**
   ```typescript
   // 最小配置 (不启用新模块)
   const agent = createAgent({ systemPrompt: '...' });

   // 启用部分模块
   const agent = createAgent({
     systemPrompt: '...',
     metrics: { enabled: true },
     guardrail: { enabled: true },
   });

   // 全功能配置
   const agent = createAgent({
     systemPrompt: '...',
     stateMachine: { enabled: true, checkpointPath: './checkpoints' },
     recovery: { enabled: true, maxRetries: 3 },
     guardrail: { enabled: true, enableBuiltInRules: true },
     router: { enabled: true, costOptimization: true },
     evaluator: { enabled: true, passThreshold: 0.7 },
     planner: { enabled: true, mode: 'plan-execute' },
     metrics: { enabled: true },
   });
   ```

---

## 七、测试计划

1. **单元测试**
   - 每个模块的独立测试 (已完成)
   - 集成后的配置解析测试

2. **集成测试**
   - 各模块组合的测试
   - 错误传播和恢复测试
   - 性能回归测试

3. **E2E 测试**
   - 完整对话流程测试
   - Plan-Execute 模式测试
   - 检查点恢复测试

---

## 八、风险和缓解

| 风险 | 缓解措施 |
|------|----------|
| 性能开销 | 默认禁用，按需启用 |
| 复杂度增加 | 清晰的模块边界，独立配置 |
| 调试困难 | 完善的日志和指标 |
| 兼容性问题 | 完整的类型检查，渐进式发布 |

---

## 九、后续优化

1. **Sub-Agent 集成** - 作为独立功能，不影响主循环
2. **DAG 可视化** - TUI 组件展示执行进度
3. **分布式执行** - 支持多实例协作
4. **持久化增强** - 支持更多 checkpoint 存储后端
