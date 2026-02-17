# @agent-stack/memory 实现计划

## 概述

本文档详细描述了 `@agent-stack/memory` 包的完整实现计划，从 M0 (骨架) 到 M7 (完整功能) 的里程碑拆解。

---

## 架构设计

### 核心模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        MemoryManager                             │
├─────────────────────────────────────────────────────────────────┤
│  Observe  →  采集事件流 (用户输入/工具调用/决策/状态)              │
│  Write    →  裁决写入哪层 (规则 + 可选 LLM 分类)                  │
│  Retrieve →  多路召回 + 重排 → MemoryBundle                      │
│  Inject   →  按模板/预算注入 prompt                              │
└─────────────────────────────────────────────────────────────────┘
```

### 五层记忆存储

| 层级 | 存储类 | 用途 | 优先级 |
|------|--------|------|--------|
| Profile | `ProfileStore` | 用户偏好 (语言/格式/禁忌) | 1 (最高) |
| TaskState | `TaskStateStore` | 当前任务状态 (目标/计划/进度) | 2 |
| Summary | `SummaryStore` | 滚动摘要 (决策/结论/下一步) | 3 |
| Episodic | `EventStore` | 事件日志 (对话/工具/决策) | 4 |
| Semantic | `SemanticStore` | 可检索材料 (全文/向量) | 5 (最低) |

### 目录结构 (M0 已完成)

```
packages/memory/
├── src/
│   ├── index.ts           # 入口导出
│   ├── types.ts           # 类型定义 (schema) ✓
│   ├── errors.ts          # 错误类 ✓
│   ├── stores/            # 存储层
│   │   ├── index.ts       # 存储导出 ✓
│   │   ├── base.ts        # SQLiteStore 基类 ✓
│   │   ├── event.ts       # EventStore ✓
│   │   ├── task-state.ts  # TaskStateStore ✓
│   │   ├── summary.ts     # SummaryStore ✓
│   │   ├── profile.ts     # ProfileStore ✓
│   │   └── semantic.ts    # SemanticStore (FTS5) ✓
│   ├── manager.ts         # MemoryManager 主入口 ✓
│   ├── observer.ts        # 事件采集 ✓
│   ├── retriever.ts       # 多路召回 ✓
│   ├── injector.ts        # 模板注入 ✓
│   ├── budgeter.ts        # Token 预算 ✓
│   ├── write-policy.ts    # 写入策略 ✓
│   └── summarizer.ts      # 摘要生成 ✓
├── package.json           # ✓
├── tsconfig.json          # ✓
└── tsup.config.ts         # ✓
```

---

## 里程碑详解

### Milestone 0: Schema + 骨架 ✅ 已完成

**产出**:
- [x] 包目录结构
- [x] `types.ts` - 完整类型定义
- [x] `errors.ts` - 错误类
- [x] 所有 Store 骨架
- [x] Manager 骨架
- [x] 工具组件骨架 (observer, retriever, injector, budgeter, write-policy, summarizer)
- [x] `package.json` + 构建配置
- [x] 添加到 `rush.json`

**验收标准**:
- [x] `rush build` 成功编译

---

### Milestone 1: EventStore + 事件采集 ✅ 已完成

**目标**: 所有交互自动记录为事件

**已完成**:

1. **EventStore** (`src/stores/event.ts`)
   - [x] 事件 CRUD 操作
   - [x] 按会话/类型/时间查询
   - [x] 索引优化

2. **MemoryObserver** (`src/observer.ts`)
   - [x] 实体提取 (文件/URL/函数/类)
   - [x] 事件创建辅助函数
   - [x] 订阅/通知机制

3. **Agent 集成** (`packages/index/src/agent.ts`)
   - [x] 添加 `@agent-stack/memory` 依赖
   - [x] `AgentMemoryConfig` 配置类型
   - [x] `initializeMemory()` / `closeMemory()` / `close()` 方法
   - [x] `chat()` 方法自动记录 USER_MSG / ASSISTANT_MSG
   - [x] `stream()` 方法自动记录事件
   - [x] 工具调用自动记录 TOOL_CALL / TOOL_RESULT
   - [x] Memory Context 自动注入 System Prompt
   - [x] `getMemoryContext()` / `retrieveMemory()` API
   - [x] `newSession()` / `getSessionId()` 会话管理

**待完善任务**: ✅ 已完成

1. **批量操作**
   - [x] 添加批量插入支持 (`addBatch()`)
   - [x] 添加事件删除 (`delete()`, `deleteBatch()`, `deleteBySession()`, `deleteBeforeTimestamp()`)

**测试用例**:
```typescript
// 基本事件记录
const event = await memory.recordEvent(
  observer.createUserMessageEvent('Hello')
);
expect(event.id).toBeDefined();
expect(event.type).toBe('USER_MSG');

// 查询事件
const events = await eventStore.query({ sessionId: 'test' });
expect(events.length).toBeGreaterThan(0);

// 事件回放
const recentEvents = await eventStore.getRecent(10);
```

**验收标准**:
- [x] 每轮对话自动记录 USER_MSG, ASSISTANT_MSG 事件
- [x] 工具调用记录 TOOL_CALL, TOOL_RESULT 事件
- [x] 事件可按会话/类型/时间查询

---

### Milestone 2: TaskStateStore + 状态管理 ✅ 已完成

**目标**: 任务执行状态持久化，幂等更新

**已完成**:

1. **TaskStateStore** (`src/stores/task-state.ts`)
   - [x] 幂等 action_id 机制
   - [x] 版本冲突检测
   - [x] 快照回滚

2. **状态 Reducer** (`src/state-reducer.ts`)
   - [x] 实现 `TaskStateReducer` 类
   - [x] 定义 action 类型: `SET_GOAL`, `SET_STATUS`, `ADD_STEP`, `UPDATE_STEP`, `COMPLETE_STEP`, `BLOCK_STEP`, `UNBLOCK_STEP`, `ADD_CONSTRAINT`, `REMOVE_CONSTRAINT`, `SET_NEXT_ACTION`, `RESET_PROGRESS`, `BATCH`
   - [x] 不可变状态更新
   - [x] `TaskActions` 辅助函数

3. **Agent 任务管理** (`packages/index/src/agent.ts`)
   - [x] `createTask()` - 创建任务
   - [x] `updateTask()` - 更新任务
   - [x] `getCurrentTask()` - 获取当前任务
   - [x] `addTaskStep()` - 添加步骤
   - [x] `completeTaskStep()` - 完成步骤
   - [x] `blockTaskStep()` / `unblockTaskStep()` - 阻塞/解除阻塞
   - [x] `getTaskProgress()` - 获取进度
   - [x] `getNextStep()` - 获取下一步
   - [x] `setTaskStatus()` - 设置状态

**待测试任务**:

**测试用例**:
```typescript
// 创建任务
const task = await memory.createTask({
  goal: 'Implement feature X',
  status: 'in_progress',
  plan: [
    { id: '1', description: 'Step 1', status: 'pending' },
    { id: '2', description: 'Step 2', status: 'pending' },
  ],
});

// 幂等更新
await memory.updateTask(task.id, { done: ['1'], actionId: 'action-1' });
await memory.updateTask(task.id, { done: ['1'], actionId: 'action-1' }); // 重复不生效

// 回滚
await taskStateStore.rollback(task.id, 1);
```

**验收标准**:
- [x] 连续多轮任务不重复执行同一步 (通过 actionId 幂等机制实现)
- [x] 正确更新 `done/next_action`
- [x] 版本冲突时抛出 `TaskStateConflictError`
- [x] 可回滚到历史版本

---

### Milestone 3: SummaryStore + 摘要生成 ✅ 已完成

**目标**: 自动压缩对话上下文

**已完成**:

1. **MemorySummarizer** (`src/summarizer.ts`)
   - [x] 规则提取逻辑 (extractSummary)
   - [x] LLM 摘要函数接口 (setSummarizeFunction)
   - [x] LLM 提示词生成 (createLLMPrompt)
   - [x] Todo 完成检测 (markTodosCompleted)
   - [x] 显著性判断 (isSignificantToolCall, isSignificantUserMessage)

2. **自动摘要触发** (`src/manager.ts`)
   - [x] 每 N 轮事件触发 (unsummarizedEventCount)
   - [x] 调用 writePolicy.shouldSummarize()
   - [x] 保留关键信息 (decisions, todos)

3. **摘要合并**
   - [x] mergeSummaries() - 合并两个摘要
   - [x] 新摘要继承旧摘要的未完成 todo
   - [x] 合并决策历史

**测试用例**:
```typescript
// 模拟 25 轮对话
for (let i = 0; i < 25; i++) {
  await memory.recordEvent(observer.createUserMessageEvent(`Message ${i}`));
}

// 检查自动生成摘要
const summary = await summaryStore.getLatest(sessionId);
expect(summary).toBeDefined();
expect(summary.bullets.length).toBeGreaterThan(0);
```

**验收标准**:
- [x] 200+ 轮对话后仍能准确复述: 目标、约束、已决策、下一步 (回归测试验证)
- [x] 摘要 token 在预算内 (tokenBudget 控制)

---

### Milestone 4: ProfileStore + 偏好管理 ✅ 已完成

**目标**: 用户偏好跨会话持久化

**已完成**:

1. **ProfileStore** (`src/stores/profile.ts`)
   - [x] CRUD 操作
   - [x] 过期清理 (cleanupExpired)
   - [x] 来源追溯 (getBySourceEvent)

2. **WritePolicyEngine** (`src/write-policy.ts`)
   - [x] 偏好检测正则 (containsPreference)
   - [x] 冲突策略 (resolveConflict)
   - [x] 偏好提取 (extractPreferences)
     - 语言偏好: Chinese, English, Japanese, Korean, Spanish, French, German
     - 格式偏好: markdown, plain, json, table
     - 详细度偏好: concise, detailed
     - 语气偏好: formal, casual
     - 代码风格: preferTypeScript, includeComments

3. **Agent Profile API** (`packages/index/src/agent.ts`)
   - [x] `setProfile()` - 设置偏好
   - [x] `getProfile()` - 获取偏好
   - [x] `getAllProfiles()` - 获取所有偏好

**测试用例**:
```typescript
// 设置偏好
await memory.setProfile({
  key: 'language',
  value: 'Chinese',
  confidence: 0.9,
  explicit: true,
});

// 新会话读取偏好
const newMemory = new MemoryManager({ dbPath: samePath });
await newMemory.initialize();
const profile = await newMemory.getProfile('language');
expect(profile?.value).toBe('Chinese');
```

**验收标准**:
- [x] 用户说 "以后用中文+表格总结" 后，后续任务稳定生效 (Profile Stability 测试验证)
- [x] 偏好可被用户删除/修改 (ProfileStore.delete() 实现)
- [x] 偏好更新有来源追溯 (sourceEventId 字段支持)

---

### Milestone 5: SemanticStore + 检索 ✅ 已完成

**目标**: 历史内容可语义检索

**已实现**:

1. **SemanticStore (FTS5 + sqlite-vec)** (`src/stores/semantic.ts`)
   - [x] FTS5 全文搜索
   - [x] sqlite-vec 向量搜索 (KNN)
   - [x] 混合检索 (Hybrid: FTS + Vector) - 默认启用
   - [x] 标签过滤
   - [x] 会话过滤
   - [x] 可配置向量维度 (默认 1536)
   - [x] Fallback: 无 sqlite-vec 时降级到 FTS-only
   - [x] `setEmbedFunction()` - 自动 Embedding 生成
   - [x] `searchText()` - 纯文本搜索
   - [x] `searchSimilar()` - 纯向量搜索
   - [x] 默认混合搜索权重: FTS 0.3, Vector 0.7

**待完善 (后续优化)**:
- 时间加权
- 基于 LLM 的重排

**测试用例**:
```typescript
// 添加内容
await memory.addChunk({
  text: 'We decided to use approach B because of performance',
  tags: ['decision', 'performance'],
});

// 搜索
const results = await memory.searchChunks('why approach B');
expect(results.length).toBeGreaterThan(0);
expect(results[0].chunk.text).toContain('approach B');
```

**验收标准**:
- [x] 用户问 "上次我们选方案 B 的原因？" 能检索到对应内容 (Semantic Search Quality 测试验证)
- [x] 结果带时间戳/来源引用 (SemanticChunk.timestamp, sourceEventId)

---

### Milestone 6: Retriever + Injector ✅ 已完成

**目标**: 正确组装和注入记忆

**已完成**:

1. **MemoryRetriever** (`src/retriever.ts`)
   - [x] 优先级排序 (profile by explicit/confidence)
   - [x] Token 预算裁剪 (trimToTokenBudget)
   - [x] 陈旧数据警告 (isStale)
   - [x] 并行多层检索 (Promise.all)

2. **MemoryInjector** (`src/injector.ts`)
   - [x] 自定义模板支持 (template option)
   - [x] 分层格式化 (formatProfile, formatTaskState, formatSummary, formatEvents, formatChunks)
   - [x] 警告显示 (formatWarnings)
   - [x] Handlebars-like 模板引擎 (renderTemplate)

3. **MemoryBudgeter** (`src/budgeter.ts`)
   - [x] 动态分配 (allocate)
   - [x] 利用率报告 (getUtilization)

**测试用例**:
```typescript
// 检索 bundle
const bundle = await memory.retrieve({
  sessionId: 'test',
  query: 'implementation plan',
});

expect(bundle.profile.length).toBeGreaterThanOrEqual(0);
expect(bundle.totalTokens).toBeLessThan(budget.total);

// 注入 prompt
const injected = memory.inject(bundle);
expect(injected).toContain('User Preferences');
```

**验收标准**:
- [x] 新问题场景不会乱注入旧任务记忆 (Session Isolation 测试验证)
- [x] 延续任务场景不会丢关键约束 (Memory Injection 测试验证)
- [x] Token 预算不超限 (Memory Bloat Detection 测试验证)

---

### Milestone 7: WritePolicy + 回归测试 ✅ 已完成

**目标**: 防止记忆污染和膨胀

**已完成**:

1. **WritePolicyEngine 完善** (`src/write-policy.ts`)
   - [x] 时间衰减 (calculateDecay)
   - [x] 陈旧标记 (isStale)
   - [x] 偏好提取 (extractPreferences)
   - [x] 冲突解决策略

2. **测试套件** (`tests/`)
   - [x] EventStore 测试 (10 tests)
   - [x] TaskStateStore 测试 (10 tests)
   - [x] ProfileStore 测试 (13 tests)
   - [x] SummaryStore 测试 (8 tests)
   - [x] SemanticStore 测试 (11 tests)
   - [x] WritePolicyEngine 测试 (23 tests)
   - [x] StateReducer 测试 (25 tests)
   - [x] 回归测试 (15 tests)
     - 100-200 轮对话模拟
     - 记忆膨胀检测
     - 偏好稳定性测试
     - 幂等性测试
     - 会话隔离测试
     - 语义搜索质量测试

**测试结果**: 124/124 通过 (包含批量操作和删除功能测试)

---

## Agent 集成计划

### 阶段 1: 基础集成

```typescript
// packages/index/src/agent.ts

import { MemoryManager, type MemoryConfig } from '@agent-stack/memory';

interface AgentConfig {
  // ... existing config
  memory?: MemoryConfig | boolean;  // true = 使用默认配置
}

class Agent {
  private memoryManager?: MemoryManager;

  constructor(config: AgentConfig) {
    if (config.memory) {
      this.memoryManager = new MemoryManager(
        config.memory === true ? {} : config.memory
      );
    }
  }

  async initialize() {
    await this.memoryManager?.initialize();
  }

  async chat(input: string) {
    // 记录用户消息
    if (this.memoryManager) {
      const observer = this.memoryManager.getObserver();
      await this.memoryManager.recordEvent(
        observer.createUserMessageEvent(input)
      );
    }

    // 检索记忆
    const memoryBundle = await this.memoryManager?.retrieve({ query: input });
    const memoryContext = memoryBundle
      ? this.memoryManager!.inject(memoryBundle)
      : '';

    // 构建 prompt (注入记忆)
    const messages = this.buildMessages(input, memoryContext);

    // 调用 LLM
    const response = await this.client.chat(messages);

    // 记录助手消息
    if (this.memoryManager) {
      const observer = this.memoryManager.getObserver();
      await this.memoryManager.recordEvent(
        observer.createAssistantMessageEvent(response.content)
      );
    }

    return response;
  }
}
```

### 阶段 2: 工具调用集成

```typescript
// 工具调用时自动记录
async executeToolCall(toolCall) {
  if (this.memoryManager) {
    const observer = this.memoryManager.getObserver();

    // 记录调用
    const callEvent = await this.memoryManager.recordEvent(
      observer.createToolCallEvent(toolCall.name, toolCall.args)
    );

    // 执行工具
    const result = await tool.execute(toolCall.args);

    // 记录结果
    await this.memoryManager.recordEvent(
      observer.createToolResultEvent(toolCall.name, result, callEvent.id)
    );

    return result;
  }
}
```

### 阶段 3: 任务管理集成

```typescript
// 任务管理 API
class Agent {
  async createTask(goal: string, constraints?: TaskConstraint[]) {
    return this.memoryManager?.createTask({
      goal,
      status: 'pending',
      constraints: constraints || [],
      plan: [],
      done: [],
      blocked: [],
    });
  }

  async updateTaskProgress(stepId: string, result?: string) {
    const task = await this.memoryManager?.getCurrentTask();
    if (task) {
      await this.memoryManager?.updateTask(task.id, {
        done: [...task.done, stepId],
        actionId: `complete-${stepId}-${Date.now()}`,
      });
    }
  }
}
```

---

## 配置示例

### .agent-stack.json

```json
{
  "model": "gpt-4o",
  "memory": {
    "dbPath": ".agent-stack/memory.db",
    "tokenBudget": {
      "profile": 200,
      "taskState": 300,
      "recentEvents": 500,
      "semanticChunks": 800,
      "summary": 400,
      "total": 2200
    },
    "writePolicy": {
      "autoSummarize": true,
      "summarizeEveryNEvents": 20,
      "conflictStrategy": "explicit"
    },
    "retrieval": {
      "maxRecentEvents": 10,
      "maxSemanticChunks": 5,
      "enableSemanticSearch": true
    }
  }
}
```

---

## 测试计划

### 单元测试

| 模块 | 测试文件 | 关键测试 |
|------|----------|----------|
| EventStore | `event.test.ts` | CRUD, 查询, 索引 |
| TaskStateStore | `task-state.test.ts` | 幂等, 版本冲突, 回滚 |
| SummaryStore | `summary.test.ts` | 创建, 合并, 查询 |
| ProfileStore | `profile.test.ts` | CRUD, 过期, 白名单 |
| SemanticStore | `semantic.test.ts` | FTS 搜索, 向量搜索 |
| MemoryRetriever | `retriever.test.ts` | 多路召回, 预算 |
| MemoryInjector | `injector.test.ts` | 模板, 格式化 |
| WritePolicyEngine | `write-policy.test.ts` | 决策, 冲突 |

### 集成测试

| 场景 | 测试文件 | 描述 |
|------|----------|------|
| 基础对话 | `integration/basic-chat.test.ts` | 单轮/多轮对话记忆 |
| 任务执行 | `integration/task-flow.test.ts` | 创建→执行→完成 |
| 长会话 | `integration/long-session.test.ts` | 100+ 轮自动摘要 |
| 跨会话 | `integration/cross-session.test.ts` | 偏好持久化 |

### 回归测试

| 指标 | 阈值 | 检测方法 |
|------|------|----------|
| 记忆膨胀 | < 10MB / 500轮 | 监控 DB 大小 |
| 偏好漂移 | 0 | 对比首次设置 |
| 重复执行 | 0 | action_id 验证 |
| Token 超限 | 0 | 注入后统计 |

---

## 时间估算

| 里程碑 | 预计工时 | 依赖 |
|--------|----------|------|
| M0 骨架 | ✅ 完成 | - |
| M1 事件 | ✅ 完成 | M0 |
| M2 任务 | ✅ 完成 | M1 |
| M3 摘要 | ✅ 完成 | M2 |
| M4 偏好 | ✅ 完成 | M1 |
| M5 检索 | ✅ 完成 | M1 |
| M6 注入 | ✅ 完成 | M1-M5 |
| M7 策略 | ✅ 完成 | M6 |
| 测试 | ✅ 完成 (134/134) | M7 |

**总计**: 约 15-20 工作日

---

## 当前状态

**已完成里程碑**: M0-M7 (全部完成)
**测试覆盖**: 134/134 通过

## 完成项

1. ~~**安装依赖**: `rush update`~~ ✓
2. ~~**验证构建**: `rush build`~~ ✓
3. ~~**M1-M6 实现**: 核心功能已完成~~ ✓
4. ~~**编写测试**: 为每个 Store 添加单元测试~~ ✓
5. ~~**M7 回归测试**: 对话模拟、性能测试~~ ✓
6. ~~**批量操作**: EventStore 批量插入/删除~~ ✓
7. ~~**混合搜索**: setEmbedFunction() 自动 Embedding~~ ✓

## 后续优化方向

- 增加 500+ 轮对话压力测试
- ~~Embedding 生成集成 (与 OpenAIClient.embed())~~ ✓ (通过 setEmbedFunction 实现)
- LLM 重排优化
- 性能基准测试
