Context                                                                                        │
│                                                                                                │
│ 问题: 当前 @ai-stack/agent                                                                     │
│ 虽然具备完整的组件（Evaluator、Planner、StopChecker、CompactionManager），但这些组件未集成到主 │
│  Agentic Loop，导致与 Claude Code 等强 Agent 存在能力差距。                                    │
│                                                                                                │
│ 目标: 将现有组件整合为一个自主性更强的 "Super Agent"，具备：                                   │
│ - 无限 Agentic Loop + 智能终止                                                                 │
│ - 自动上下文压缩                                                                               │
│ - 自我反思循环                                                                                 │
│ - 内置代码编辑工具                                                                             │
│                                                                                                │
│ 原则: 集成优先于创建，所有新功能默认关闭以保持向后兼容。                                       │
│                                                                                                │
│ ---                                                                                            │
│ 架构变更概览                                                                                   │
│                                                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐                    │
│ │                           Super Agent Loop                               │                   │
│ ├─────────────────────────────────────────────────────────────────────────┤                    │
│ │                                                                         │                    │
│ │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │                     │
│ │  │ StopChecker │───►│ Evaluator   │───►│ Compaction  │                 │                     │
│ │  │ (终止决策)   │    │ (质量评估)  │    │ (上下文压缩) │                 │                   │
│ │  └─────────────┘    └─────────────┘    └─────────────┘                 │                     │
│ │         │                  │                  │                         │                    │
│ │         └──────────────────┴──────────────────┘                         │                    │
│ │                            │                                            │                    │
│ │                   ┌────────▼────────┐                                   │                    │
│ │                   │   Main Loop     │                                   │                    │
│ │                   │  (agent.ts)     │                                   │                    │
│ │                   └────────┬────────┘                                   │                    │
│ │                            │                                            │                    │
│ │         ┌──────────────────┴──────────────────┐                         │                    │
│ │         │                                      │                         │                   │
│ │  ┌──────▼──────┐                      ┌───────▼───────┐                 │                    │
│ │  │ Code Tools  │                      │ Tool          │                 │                    │
│ │  │ (内置)      │                      │ Orchestrator  │                 │                    │
│ │  └─────────────┘                      └───────────────┘                 │                    │
│ │                                                                         │                    │
│ └─────────────────────────────────────────────────────────────────────────┘                    │
│                                                                                                │
│ ---                                                                                            │
│ Phase 1: Infinite Agentic Loop + 智能终止 (优先级: 高)                                         │
│                                                                                                │
│ 目标                                                                                           │
│                                                                                                │
│ 将已存在的 StopChecker 集成到主循环，支持多维度终止条件。                                      │
│                                                                                                │
│ 修改文件                                                                                       │
│                                                                                                │
│ 1. /packages/libs/agent/src/types.ts - 新增配置类型                                            │
│                                                                                                │
│ export interface SuperLoopConfig {                                                             │
│   /** 启用无限循环模式 (默认: false) */                                                        │
│   infiniteLoop?: boolean;                                                                      │
│                                                                                                │
│   /** 质量阈值，达到后认为任务完成 (0-1, 默认: 0.7) */                                         │
│   qualityThreshold?: number;                                                                   │
│                                                                                                │
│   /** 启用任务完成检测 (默认: true) */                                                         │
│   detectTaskCompletion?: boolean;                                                              │
│                                                                                                │
│   /** 任务完成检测模式 */                                                                      │
│   completionPatterns?: (string | RegExp)[];                                                    │
│                                                                                                │
│   /** 检查点间隔 (迭代次数) */                                                                 │
│   checkpointInterval?: number;                                                                 │
│ }                                                                                              │
│                                                                                                │
│ 2. /packages/libs/agent/src/agent.ts - 集成 StopChecker                                        │
│                                                                                                │
│ 关键变更位置: chat() 方法 (lines 1567-2000)                                                    │
│                                                                                                │
│ // 在循环开始前创建 StopChecker                                                                │
│ const stopChecker = config.superLoop?.infiniteLoop                                             │
│   ? createStopChecker({                                                                        │
│       ...config.stopConditions,                                                                │
│       maxIterations: Infinity, // 无限循环                                                     │
│     })                                                                                         │
│   : null;                                                                                      │
│                                                                                                │
│ // 在每次迭代结束时检查                                                                        │
│ if (stopChecker) {                                                                             │
│   const context = createExecutionContext({                                                     │
│     iterations,                                                                                │
│     toolCalls: toolCallResults,                                                                │
│     totalTokens: totalTokensUsed,                                                              │
│     elapsedMs: Date.now() - startTime,                                                         │
│     lastResponse: response.content,                                                            │
│   });                                                                                          │
│                                                                                                │
│   const stopResult = await stopChecker.check(context);                                         │
│   if (stopResult.shouldStop) {                                                                 │
│     if (stopResult.type === 'hard' || !config.stopConditions?.onStopCondition) {               │
│       break;                                                                                   │
│     }                                                                                          │
│     const shouldContinue = await config.stopConditions.onStopCondition(stopResult, context);   │
│     if (!shouldContinue) break;                                                                │
│   }                                                                                            │
│ }                                                                                              │
│                                                                                                │
│ 3. /packages/libs/agent/src/task-completion.ts - 新增文件                                      │
│                                                                                                │
│ export interface TaskCompletionDetectorInstance {                                              │
│   detect(response: string, context: ExecutionContext): Promise<boolean>;                       │
│ }                                                                                              │
│                                                                                                │
│ export function createTaskCompletionDetector(                                                  │
│   config: TaskCompletionDetectorConfig,                                                        │
│   llmChat?: (prompt: string) => Promise<string>                                                │
│ ): TaskCompletionDetectorInstance;                                                             │
│                                                                                                │
│ 复用现有代码                                                                                   │
│                                                                                                │
│ - stop-checker.ts - 完整复用，无需修改                                                         │
│ - types.ts 中的 StopConditions, ExecutionContext - 完整复用                                    │
│                                                                                                │
│ ---                                                                                            │
│ Phase 2: Auto Context Compaction (优先级: 高)                                                  │
│                                                                                                │
│ 目标                                                                                           │
│                                                                                                │
│ 自动监控 Token 压力，在接近上下文限制时触发压缩。                                              │
│                                                                                                │
│ 修改文件                                                                                       │
│                                                                                                │
│ 1. /packages/libs/agent/src/types.ts - 新增配置                                                │
│                                                                                                │
│ export interface AgentCompactionConfig {                                                       │
│   /** 启用自动压缩 (默认: true if memory enabled) */                                           │
│   enabled?: boolean;                                                                           │
│                                                                                                │
│   /** 软阈值百分比 (默认: 0.6) */                                                              │
│   softThreshold?: number;                                                                      │
│                                                                                                │
│   /** 硬阈值百分比 (默认: 0.8) */                                                              │
│   hardThreshold?: number;                                                                      │
│                                                                                                │
│   /** 最大上下文 tokens (默认: 128000) */                                                      │
│   maxContextTokens?: number;                                                                   │
│                                                                                                │
│   /** 压缩时回调 */                                                                            │
│   onCompaction?: (result: { flushedTokens: number; summary: string }) => void;                 │
│ }                                                                                              │
│                                                                                                │
│ 2. /packages/libs/agent/src/agent.ts - 集成 CompactionManager                                  │
│                                                                                                │
│ 关键变更位置: chat() 方法，在 LLM 响应后                                                       │
│                                                                                                │
│ // 创建 CompactionManager (在 initializeMemory 时)                                             │
│ if (memoryConfig?.compaction?.enabled !== false) {                                             │
│   compactionManager = createCompactionManager({                                                │
│     maxContextTokens: memoryConfig.compaction?.maxContextTokens ?? 128000,                     │
│     softThreshold: memoryConfig.compaction?.softThreshold ?? 0.6,                              │
│     hardThreshold: memoryConfig.compaction?.hardThreshold ?? 0.8,                              │
│   });                                                                                          │
│ }                                                                                              │
│                                                                                                │
│ // 在每次 LLM 响应后检查                                                                       │
│ if (compactionManager && response.usage) {                                                     │
│   compactionManager.updateTokenCount(totalTokensUsed);                                         │
│   const health = compactionManager.checkHealth();                                              │
│                                                                                                │
│   if (health.recommendation === 'flush_now' || health.recommendation === 'critical') {         │
│     const events = await memoryManager.getRecentEvents();                                      │
│     const result = await performCompaction(events);                                            │
│                                                                                                │
│     // 将摘要注入到下一次上下文                                                                │
│     if (result.summary) {                                                                      │
│       injectedSummary = result.summary;                                                        │
│     }                                                                                          │
│                                                                                                │
│     emitEvent({ type: 'memory:compaction', ...result });                                       │
│   }                                                                                            │
│ }                                                                                              │
│                                                                                                │
│ 复用现有代码                                                                                   │
│                                                                                                │
│ - @ai-stack/memory/compaction/compaction-manager.ts - 完整复用                                 │
│ - @ai-stack/memory/compaction/memory-flush.ts - 完整复用                                       │
│                                                                                                │
│ ---                                                                                            │
│ Phase 3: Self-Reflection Loop (优先级: 中)                                                     │
│                                                                                                │
│ 目标                                                                                           │
│                                                                                                │
│ 每次响应后自动评估质量，不满足阈值时自动重试。                                                 │
│                                                                                                │
│ 修改文件                                                                                       │
│                                                                                                │
│ 1. /packages/libs/agent/src/types.ts - 新增配置                                                │
│                                                                                                │
│ export interface AgentSelfReflectionConfig {                                                   │
│   /** 启用自我反思 (默认: false) */                                                            │
│   enabled?: boolean;                                                                           │
│                                                                                                │
│   /** 通过阈值 (默认: 0.7) */                                                                  │
│   passThreshold?: number;                                                                      │
│                                                                                                │
│   /** 最大重试次数 (默认: 1) */                                                                │
│   maxRetries?: number;                                                                         │
│                                                                                                │
│   /** 启用一致性自检 (默认: true) */                                                           │
│   enableSelfCheck?: boolean;                                                                   │
│                                                                                                │
│   /** 评估使用的模型 (可使用便宜模型) */                                                       │
│   evalModel?: string;                                                                          │
│ }                                                                                              │
│                                                                                                │
│ 2. /packages/libs/agent/src/agent.ts - 集成 Evaluator                                          │
│                                                                                                │
│ 关键变更位置: chat() 方法，在返回最终响应前 (line ~1800)                                       │
│                                                                                                │
│ // 在获得最终响应后 (无工具调用)                                                               │
│ if (evaluator && selfReflectionConfig?.enabled) {                                              │
│   const evalContext: EvalContext = {                                                           │
│     originalRequest: input,                                                                    │
│     toolResults: toolCallResults.map(tc => ({                                                  │
│       toolName: tc.name,                                                                       │
│       args: tc.args,                                                                           │
│       result: tc.result,                                                                       │
│     })),                                                                                       │
│     retryCount: currentRetryCount,                                                             │
│   };                                                                                           │
│                                                                                                │
│   const evalResult = await evaluator.evaluate(content, evalContext);                           │
│                                                                                                │
│   // 评分不足时重试                                                                            │
│   if (!evalResult.passed && currentRetryCount < (selfReflectionConfig.maxRetries ?? 1)) {      │
│     const feedback = `Previous response scored ${evalResult.score.toFixed(2)}. ` +             │
│                     `Issues: ${evalResult.issues.join(', ')}. Please improve.`;                │
│     messages.push(userMessage(feedback));                                                      │
│     currentRetryCount++;                                                                       │
│     continue; // 重试循环                                                                      │
│   }                                                                                            │
│                                                                                                │
│   // 一致性自检                                                                                │
│   if (selfReflectionConfig.enableSelfCheck !== false) {                                        │
│     const selfCheckResult = await evaluator.selfCheck(content, evalContext);                   │
│     if (!selfCheckResult.consistent) {                                                         │
│       emitEvent({ type: 'evaluation:inconsistency', problems: selfCheckResult.problems });     │
│     }                                                                                          │
│   }                                                                                            │
│ }                                                                                              │
│                                                                                                │
│ 复用现有代码                                                                                   │
│                                                                                                │
│ - evaluator/evaluator.ts - 完整复用 (已创建但未调用)                                           │
│ - evaluator/types.ts - 完整复用                                                                │
│                                                                                                │
│ ---                                                                                            │
│ Phase 4: Built-in Code Tools (优先级: 中)                                                      │
│                                                                                                │
│ 目标                                                                                           │
│                                                                                                │
│ 将核心代码工具内置到 agent，无需依赖 @ai-stack/code。                                          │
│                                                                                                │
│ 新增文件                                                                                       │
│                                                                                                │
│ packages/libs/agent/src/tools/code/                                                            │
│ ├── index.ts          # 导出和工厂函数                                                         │
│ ├── types.ts          # 类型定义                                                               │
│ ├── context.ts        # 安全上下文                                                             │
│ ├── read.ts           # Read 工具                                                              │
│ ├── write.ts          # Write 工具                                                             │
│ ├── edit.ts           # Edit 工具                                                              │
│ ├── glob.ts           # Glob 工具                                                              │
│ └── grep.ts           # Grep 工具                                                              │
│                                                                                                │
│ 1. /packages/libs/agent/src/tools/code/types.ts                                                │
│                                                                                                │
│ export interface CodeToolsConfig {                                                             │
│   /** 启用内置代码工具 (默认: false) */                                                        │
│   enabled?: boolean;                                                                           │
│                                                                                                │
│   /** 工作目录 (默认: process.cwd()) */                                                        │
│   workingDir?: string;                                                                         │
│                                                                                                │
│   /** 允许的路径模式 */                                                                        │
│   allowedPaths?: string[];                                                                     │
│                                                                                                │
│   /** 阻止的路径模式 */                                                                        │
│   blockedPaths?: string[];                                                                     │
│                                                                                                │
│   /** 最大文件大小 (默认: 1MB) */                                                              │
│   maxFileSize?: number;                                                                        │
│                                                                                                │
│   /** 写入前需要先读取 (默认: true) */                                                         │
│   requireReadFirst?: boolean;                                                                  │
│ }                                                                                              │
│                                                                                                │
│ 2. /packages/libs/agent/src/tools/code/index.ts                                                │
│                                                                                                │
│ export function createCodeTools(config: CodeToolsConfig): Tool[] {                             │
│   const context = createCodeToolContext(config);                                               │
│   return [                                                                                     │
│     createReadTool(context),                                                                   │
│     createWriteTool(context),                                                                  │
│     createEditTool(context),                                                                   │
│     createGlobTool(context),                                                                   │
│     createGrepTool(context),                                                                   │
│   ];                                                                                           │
│ }                                                                                              │
│                                                                                                │
│ 3. /packages/libs/agent/src/agent.ts - 自动注册                                                │
│                                                                                                │
│ // 在 createAgent() 中                                                                         │
│ if (config.codeTools?.enabled) {                                                               │
│   const codeTools = createCodeTools(config.codeTools);                                         │
│   instance.registerTools(codeTools);                                                           │
│ }                                                                                              │
│                                                                                                │
│ 从 @ai-stack/code 提取的代码                                                                   │
│                                                                                                │
│ - tools/read.ts - 简化版本 (移除 undo 依赖)                                                    │
│ - tools/write.ts - 简化版本 (移除 undo 依赖)                                                   │
│ - tools/edit.ts - 简化版本                                                                     │
│ - tools/glob.ts - 完整复用                                                                     │
│ - tools/grep.ts - 完整复用                                                                     │
│                                                                                                │
│ ---                                                                                            │
│ Phase 5: Tool Orchestrator (优先级: 低)                                                        │
│                                                                                                │
│ 目标                                                                                           │
│                                                                                                │
│ 智能工具选择和失败恢复策略。                                                                   │
│                                                                                                │
│ 新增文件                                                                                       │
│                                                                                                │
│ packages/libs/agent/src/tool-orchestrator/                                                     │
│ ├── index.ts                                                                                   │
│ ├── types.ts                                                                                   │
│ └── orchestrator.ts                                                                            │
│                                                                                                │
│ 关键类型:                                                                                      │
│                                                                                                │
│ export interface ToolChain {                                                                   │
│   tools: Array<{                                                                               │
│     name: string;                                                                              │
│     args: Record<string, unknown>;                                                             │
│     dependsOn?: string[];                                                                      │
│   }>;                                                                                          │
│   fallback?: ToolChain;                                                                        │
│ }                                                                                              │
│                                                                                                │
│ export interface ToolOrchestratorInstance {                                                    │
│   plan(goal: string, availableTools: Tool[]): Promise<ToolChain>;                              │
│   execute(chain: ToolChain): Promise<ToolCallResult[]>;                                        │
│   getFallback(toolName: string, error: Error): ToolChain | null;                               │
│ }                                                                                              │
│                                                                                                │
│ ---                                                                                            │
│ 实现优先级                                                                                     │
│ ┌────────────────────────────┬────────┬────────┬──────────┬────────────────────────────┐       │
│ │           Phase            │ 优先级 │ 复杂度 │ 预估时间 │            依赖            │       │
│ ├────────────────────────────┼────────┼────────┼──────────┼────────────────────────────┤       │
│ │ Phase 1: Infinite Loop     │ 高     │ 中     │ 2-3 天   │ StopChecker (已存在)       │       │
│ ├────────────────────────────┼────────┼────────┼──────────┼────────────────────────────┤       │
│ │ Phase 2: Auto Compaction   │ 高     │ 中     │ 2-3 天   │ CompactionManager (已存在) │       │
│ ├────────────────────────────┼────────┼────────┼──────────┼────────────────────────────┤       │
│ │ Phase 3: Self-Reflection   │ 中     │ 低     │ 1-2 天   │ Evaluator (已存在)         │       │
│ ├────────────────────────────┼────────┼────────┼──────────┼────────────────────────────┤       │
│ │ Phase 4: Code Tools        │ 中     │ 中     │ 3-4 天   │ @ai-stack/code 工具        │       │
│ ├────────────────────────────┼────────┼────────┼──────────┼────────────────────────────┤       │
│ │ Phase 5: Tool Orchestrator │ 低     │ 高     │ 4-5 天   │ Planner (已存在)           │       │
│ └────────────────────────────┴────────┴────────┴──────────┴────────────────────────────┘       │
│ 推荐顺序: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5                                      │
│                                                                                                │
│ ---                                                                                            │
│ 向后兼容性                                                                                     │
│                                                                                                │
│ 1. 所有新功能默认关闭                                                                          │
│   - superLoop.infiniteLoop: false                                                              │
│   - selfReflection.enabled: false                                                              │
│   - codeTools.enabled: false                                                                   │
│ 2. 现有配置保持不变                                                                            │
│   - maxIterations 继续工作                                                                     │
│   - onMaxIterations 回调继续支持                                                               │
│ 3. 废弃策略                                                                                    │
│   - 将 ConversationOptions.maxIterations 标记为 deprecated                                     │
│   - 推荐使用 stopConditions.maxIterations                                                      │
│   - 保持 2 个主版本的兼容                                                                      │
│                                                                                                │
│ ---                                                                                            │
│ 关键文件清单                                                                                   │
│ ┌────────────────────────────────────────────────┬──────┬──────────────┐                       │
│ │                      文件                      │ 操作 │     说明     │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/agent.ts               │ 修改 │ 核心循环集成 │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/types.ts               │ 修改 │ 新增配置类型 │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/task-completion.ts     │ 新增 │ 任务完成检测 │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/tools/code/*.ts        │ 新增 │ 内置代码工具 │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/tool-orchestrator/*.ts │ 新增 │ 工具编排器   │                       │
│ ├────────────────────────────────────────────────┼──────┼──────────────┤                       │
│ │ packages/libs/agent/src/index.ts               │ 修改 │ 导出新模块   │                       │
│ └────────────────────────────────────────────────┴──────┴──────────────┘                       │
│ ---                                                                                            │
│ 验证方案                                                                                       │
│                                                                                                │
│ 单元测试                                                                                       │
│                                                                                                │
│ cd packages/libs/agent                                                                         │
│ rushx test                                                                                     │
│                                                                                                │
│ 集成测试                                                                                       │
│                                                                                                │
│ 1. 无限循环测试: 创建复杂任务，验证智能终止                                                    │
│ 2. 压缩测试: 长对话测试，验证自动压缩触发                                                      │
│ 3. 反思测试: 低质量响应测试，验证自动重试                                                      │
│                                                                                                │
│ E2E 测试                                                                                       │
│                                                                                                │
│ const agent = createAgent({                                                                    │
│   superLoop: { infiniteLoop: true, checkpointInterval: 5 },                                    │
│   selfReflection: { enabled: true, passThreshold: 0.8 },                                       │
│   codeTools: { enabled: true, workingDir: './test-project' },                                  │
│   stopConditions: {                                                                            │
│     maxCost: 1.0,                                                                              │
│     maxDurationMs: 5 * 60 * 1000,                                                              │
│   },                                                                                           │
│ });                                                                                            │
│                                                                                                │
│ await agent.chat('Implement a complete REST API with tests');