# 业务逻辑详解

本文档描述 AI Stack 的核心业务流程、数据流和集成模式。

---

## 1. 核心业务模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        @ai-stack/agent                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  对话管理 | 工具执行 | 流式响应 | 权限管控 | 高级编排       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ @ai-stack/    │   │ @ai-stack/    │   │ @ai-stack/    │
│ provider      │   │ mcp + skill   │   │ memory +      │
│               │   │               │   │ knowledge     │
│ LLM 调用      │   │ 工具系统      │   │ 持久化        │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## 2. Provider 业务逻辑

### 2.1 统一多模型接口

```typescript
const provider = createProvider({
  provider: 'openai',  // 或 'anthropic' | 'google' | 'openai-compatible'
  apiKey: '...',
});

await provider.chat(messages, options);    // 同步聊天
await provider.chatStream(messages, options); // 流式聊天
await provider.embed(text);                // 文本嵌入
```

### 2.2 消息格式自动转换

| 提供商 | 系统消息 | 工具调用格式 |
|--------|----------|--------------|
| OpenAI | `role='system'` | `tool_calls` 数组 |
| Anthropic | 独立 `system` 参数 | `tool_use` 块 |
| Google | `systemInstruction` | `functionCall` |

### 2.3 辅助函数

```typescript
// 消息构建
systemMessage('...')
userMessage('...')
assistantMessage('...')
toolMessage(toolCallId, '...')

// 工具定义
defineTool('name', 'description', parameters)
defineParameters(properties, required)

// Token 处理
estimateTokens(text)
truncateToTokens(text, max)
chunkText(text, maxTokens)
```

---

## 3. Agent 业务逻辑

### 3.1 对话流程

```
用户输入
    │
    ▼
┌─────────────────────┐
│ 1. 权限检查          │ ← Guardrail (输入验证)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. 上下文准备        │ ← Memory 检索 + Knowledge 搜索
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. LLM 调用          │ ← 模型路由 + 流式/同步
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. 工具执行 (循环)   │ ← 权限检查 + 并行执行
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 5. 后处理            │ ← Memory 写入 + 输出验证
└─────────────────────┘
    │
    ▼
Agent 响应
```

### 3.2 工具系统

**Tool 接口**：
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: object;           // JSON Schema
  execute: (args) => Promise<string>;

  // 增强文档 (可选)
  examples?: ToolExample[];     // 使用示例
  hints?: string[];             // 使用提示
  edgeCases?: string[];         // 边界情况
  constraints?: string[];       // 约束条件
}
```

**工具执行流程**：
```
LLM 返回 tool_calls
    │
    ├─ 1. 权限检查 (auto/confirm/deny)
    │
    ├─ 2. 工具查找 (本地/MCP/Skill)
    │
    ├─ 3. 并行执行 (超时控制)
    │
    └─ 4. 结果处理 → 继续对话
```

**并行执行配置**：
```typescript
const agent = createAgent({
  toolExecution: {
    parallelExecution: true,
    maxConcurrentTools: 5,
    toolTimeout: 30000,
  },
});
```

### 3.3 停止条件

```typescript
interface StopConditions {
  maxIterations?: number;        // 迭代限制
  maxToolCalls?: number;         // 工具调用限制
  maxTotalTokens?: number;       // Token 限制
  maxDurationMs?: number;        // 时间限制
  maxCost?: number;              // 成本限制
  stopPatterns?: string[];       // 停止模式
  maxConsecutiveFailures?: number; // 连续失败限制
  customCondition?: () => boolean; // 自定义条件
}
```

**软停止 vs 硬停止**：
- **软停止** (可覆盖): 迭代限制、工具调用限制
- **硬停止** (不可覆盖): Token 限制、时间限制、成本限制

### 3.4 可观测性

**事件类型**：
```typescript
'tool:start' | 'tool:end' | 'tool:error'
'llm:request' | 'llm:response'
'iteration:start' | 'iteration:end'
'thinking:start' | 'thinking:update' | 'thinking:end'
'plan:created' | 'plan:step:start' | 'plan:step:complete'
```

**使用示例**：
```typescript
const agent = createAgent({
  telemetry: {
    enabled: true,
    onEvent: (event) => {
      console.log(`[${event.type}] ${event.durationMs}ms`);
    },
  },
});
```

---

## 4. MCP 业务逻辑

### 4.1 连接管理

```typescript
const manager = createMCPClientManager();
await manager.initialize('.mcp.json');
await manager.connectAll();

// 获取工具
const tools = createMCPToolProvider(manager).getTools();
```

### 4.2 工具桥接

```
MCP Tool                        Agent Tool
┌─────────────────┐             ┌──────────────────────┐
│ name: search    │     →       │ name: mcp__server__  │
│ inputSchema: {} │             │       search         │
└─────────────────┘             └──────────────────────┘
```

### 4.3 配置格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "remote": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

---

## 5. Skill 业务逻辑

### 5.1 加载流程

```
skill.json
    │
    ├─ 1. 解析配置
    │
    ├─ 2. 动态 import 处理函数
    │
    ├─ 3. 执行 onLoad 钩子
    │
    └─ 4. 状态: loaded → active
```

### 5.2 状态机

```
unloaded → loading → loaded ↔ active
                │           │
                └── error ←─┘
```

### 5.3 Skill 定义

```json
{
  "name": "web-search",
  "tools": [{
    "name": "search",
    "description": "Search the web",
    "parameters": { ... },
    "handler": "./handlers.js#search"
  }]
}
```

---

## 6. Memory 业务逻辑

### 6.1 五层记忆架构

| 层级 | 存储 | 优先级 | 用途 |
|------|------|--------|------|
| Profile | ProfileStore | 最高 | 用户偏好 |
| TaskState | TaskStateStore | 高 | 当前任务 |
| Summary | SummaryStore | 中 | 滚动摘要 |
| Episodic | EventStore | 低 | 事件日志 |
| Semantic | SemanticStore | 最低 | 可检索内容 |

### 6.2 策略层

```
┌─────────────────────────────────────────────────────────────┐
│                    MemoryPolicy (主策略)                      │
├─────────────────────────────────────────────────────────────┤
│  RetrievalPolicy  │  WritePolicy  │  BudgetPolicy           │
│  何时检索/检索什么 │  何时写入/写什么│  Token 预算分配        │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 检索排序

**时间衰减**：
```
score × e^(-λ × ageInDays)
λ = ln(2) / halfLifeDays
```

**MMR 去重**：
```
MMR = λ × relevance - (1-λ) × max_similarity
```

### 6.4 上下文压缩

```
Context Compaction 流程:

Token 使用量 → 检查阈值
    │
    ├─ < 60%: 正常运行
    ├─ 60-80%: 准备 flush
    ├─ 80-95%: 立即 flush
    └─ > 95%: 强制 compaction

Flush 内容:
- decisions (决策)
- facts (事实)
- todos (待办)
- preferences (偏好)
- summary (摘要)
```

### 6.5 使用示例

```typescript
const agent = createAgent({
  memory: {
    enabled: true,
    dbPath: './memory/sqlite.db',
    autoInitialize: true,
    autoInject: true,
    tokenBudget: {
      profile: 200,
      taskState: 300,
      recentEvents: 500,
      semanticChunks: 800,
      total: 2200,
    },
  },
});

// 任务管理
const task = await agent.createTask('Implement feature', {
  plan: [
    { id: '1', description: 'Step 1', status: 'pending' },
    { id: '2', description: 'Step 2', status: 'pending' },
  ],
});

await agent.completeTaskStep('1', 'Done');
const progress = await agent.getTaskProgress();
```

---

## 7. Knowledge 业务逻辑

### 7.1 索引模式

```
┌───────────────────────────────────────────────────────────────┐
│                      KnowledgeManager                          │
├───────────────────────────────────────────────────────────────┤
│  CodeIndexer          │  DocIndexer          │  HybridSearch  │
│  - AST 解析           │  - URL 爬取          │  - FTS + Vector│
│  - 智能切分           │  - HTML → Markdown   │  - 时间衰减    │
│  - 文件监听           │  - 章节提取          │  - MMR 去重    │
└───────────────────────────────────────────────────────────────┘
```

### 7.2 自动检索流程

```
用户输入
    │
    ├─ 1. 自动检索代码 (searchCode)
    │
    ├─ 2. 自动检索文档 (searchDocs)
    │
    ├─ 3. 注入上下文到 System Prompt
    │
    └─ 4. LLM 调用
```

### 7.3 使用示例

```typescript
const agent = createAgent({
  knowledge: {
    enabled: true,
    code: {
      rootDir: './src',
      include: ['**/*.ts'],
      watch: true,
    },
    doc: { enabled: true },
    search: {
      autoSearch: true,
      autoInject: true,
    },
  },
});

// 添加文档源
await agent.addDocSource({
  name: 'React Docs',
  url: 'https://react.dev',
  type: 'url',
});

await agent.crawlDocs();
```

---

## 8. 权限管控

### 8.1 权限级别

| 级别 | 行为 |
|------|------|
| `auto` | 直接执行 |
| `confirm` | 请求用户确认 |
| `deny` | 拒绝执行 |

### 8.2 检查流程

```
工具调用 → Session 记忆 → 规则匹配 → 分类默认 → 全局默认
                                                    │
                                                    ▼
                                              权限决策
```

### 8.3 规则配置

```typescript
const agent = createAgent({
  permission: {
    enabled: true,
    rules: [
      { tool: '*_read*', level: 'auto' },
      { tool: '*_write*', level: 'confirm' },
      { tool: '*_delete*', level: 'deny' },
    ],
    onConfirm: async (request) => {
      // 自定义确认逻辑
      return { allowed: true, rememberForSession: true };
    },
  },
});
```

---

## 9. 高级编排

### 9.1 状态机

```
idle → planning → executing → completed
            ↓           ↓
         paused ←→ waiting
            ↓           ↓
         error ←────────┘
```

### 9.2 恢复策略

**退避策略**：
| 策略 | 公式 |
|------|------|
| fixed | `delay` |
| linear | `delay × attempt` |
| exponential | `delay × 2^(attempt-1)` |
| fibonacci | `delay × fib(attempt)` |

**熔断器**：
```
closed → 失败达阈值 → open → 超时 → half-open → 成功 → closed
```

### 9.3 计划 DAG

```typescript
const dag = createPlanDAG();
dag.addNode({ id: 'A', description: 'Task A' });
dag.addNode({ id: 'B', description: 'Task B', dependsOn: ['A'] });
dag.addNode({ id: 'C', description: 'Task C', dependsOn: ['A'] });
dag.addNode({ id: 'D', description: 'Task D', dependsOn: ['B', 'C'] });

// 获取可并行执行的任务
const ready = dag.getReadyNodes(); // ['A']
dag.markCompleted('A');
const nextReady = dag.getReadyNodes(); // ['B', 'C'] - 可并行
```

### 9.4 模型路由

| 任务类型 | 推荐模型层级 |
|----------|-------------|
| tool_selection | fast |
| classification | fast |
| code_generation | strong |
| reasoning | strong |
| conversation | standard |

### 9.5 评估器

```typescript
const evaluator = createEvaluator({
  dimensions: {
    accuracy: 0.25,
    completeness: 0.25,
    relevance: 0.20,
    safety: 0.15,
    coherence: 0.10,
    helpfulness: 0.05,
  },
  passThreshold: 0.7,
});

const result = await evaluator.evaluate(response, context);
if (!result.passed) {
  // 重试
}
```

### 9.6 Guardrail

**内置规则**：
- PII 检测
- 密钥检测
- 危险命令检测
- Prompt 注入检测
- 长度限制

```typescript
const agent = createAgent({
  guardrail: {
    enabled: true,
    enableBuiltInRules: true,
    customRules: [
      { id: 'custom', type: 'output', check: (text) => ... },
    ],
  },
});
```

---

## 10. Code Agent 工具

### 10.1 Read 工具

```
输出格式 (numbered):

  1 | import { foo } from "./foo";
  2 |
  3 | export function main() {
  4 |   return foo();
  5 | }
```

### 10.2 Edit 工具

**模式**：
| 模式 | 参数 |
|------|------|
| exact | `old_string`, `new_string` |
| line | `start_line`, `end_line`, `new_content` |
| fuzzy | `search_pattern`, `replacement` |

### 10.3 Undo/Redo

```typescript
// SQLite 持久化历史
const history = createFileHistoryStore({ dbPath: '.ai-code/history.db' });

// 操作
await history.recordChange(change);
await history.undo(); // 撤销
await history.redo(); // 重做
await history.createCheckpoint('my-checkpoint');
await history.restoreCheckpoint('my-checkpoint');
```

---

## 11. Assistant 特性

### 11.1 双层记忆架构

Assistant 采用**双层记忆架构**，结合显式和隐式记忆：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          双层记忆架构                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: Markdown Memory (显式记忆)                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Source of Truth - 用户可编辑                                    │   │
│  │  - MEMORY.md: Profile, Facts, Todos, Notes                       │   │
│  │  - logs/YYYY-MM-DD.md: 每日日志                                  │   │
│  │  - markdown-index.db: BM25 全文索引                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ 启动时同步 (增量，hash 比较)             │
│                              ▼                                          │
│  Layer 2: Agent Memory (隐式记忆)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  自动管理 - 语义搜索                                             │   │
│  │  - agent.db: Events, Profiles, Summaries, SemanticChunks        │   │
│  │  - 支持 Token Budget 管理                                        │   │
│  │  - 支持 Write Policy (事件自动记录)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Layer 3: Agent Knowledge (可选)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  手动触发索引 - 代码/文档语义搜索                                │   │
│  │  - knowledge/sqlite.db: Code chunks, Doc chunks                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**同步流程**：
```typescript
// 启动时自动执行
await assistant.initialize();  // 触发 Markdown → Agent Memory 同步

// 手动触发同步
await assistant.syncMarkdownToAgentMemory();

// 同步策略：
// 1. 计算 Markdown 内容 hash
// 2. 与上次同步 hash 比较
// 3. 只同步变化的内容
// 4. Profile → Agent Profile store
// 5. Facts/Todos → Memory events (tag: 'markdown-sync')
// 6. Notes → Semantic chunks
```

### 11.2 Markdown Memory

**MEMORY.md 格式**：
```markdown
# Assistant Memory

## Profile
- **Name**: Alice
- **Timezone**: Asia/Shanghai

## Facts
- User prefers concise responses

## Todos
- [ ] Review PR #123

## Notes
User mentioned interest in Rust.
```

### 11.3 多通道网关

```
┌─────────────────────────────────────────────┐
│                   Gateway                     │
├─────────────────────────────────────────────┤
│  CLI Adapter  │ Telegram Adapter │ Discord  │
└─────────────────────────────────────────────┘
```

### 11.4 调度器

```typescript
// Cron 定时
scheduler.addJob({
  id: 'daily-summary',
  schedule: '0 9 * * *',
  action: async () => { ... },
});

// 一次性提醒
scheduler.addReminder({
  at: Date.now() + 3600000,
  message: 'Meeting in 1 hour',
});

// 文件监听触发
scheduler.watchFile('./config.json', async () => {
  console.log('Config changed');
});
```

---

## 12. 错误处理

### 12.1 错误类型

| 错误类 | 可恢复 |
|--------|--------|
| `ProviderAuthError` | 否 |
| `ProviderRateLimitError` | 是 |
| `ToolNotFoundError` | 否 |
| `ToolExecutionError` | 取决于 |
| `ToolTimeoutError` | 是 |
| `ConfigValidationError` | 否 |
| `MCPConnectionError` | 是 |

### 12.2 错误恢复

```typescript
try {
  await agent.chat(input);
} catch (error) {
  if (error instanceof ProviderRateLimitError) {
    await delay(error.retryAfter);
    return retry();
  }
  if (error.recoverable) {
    return retry();
  }
  throw error;
}
```

---

## 13. 配置示例

### 13.1 Agent 配置

```json
{
  "name": "My Agent",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful assistant.",
  "mcp": {
    "configPath": "./mcp.json",
    "autoConnect": true
  },
  "skill": {
    "directories": ["./skills"],
    "autoLoad": true
  },
  "memory": {
    "enabled": true,
    "dbPath": "./memory/sqlite.db",
    "autoInject": true
  },
  "knowledge": {
    "enabled": true,
    "code": { "rootDir": "./src" },
    "search": { "autoSearch": true }
  },
  "permission": {
    "enabled": true,
    "defaultLevel": "confirm"
  },
  "toolExecution": {
    "parallelExecution": true,
    "maxConcurrentTools": 5
  },
  "telemetry": {
    "enabled": true
  }
}
```

### 13.2 Code Agent 配置

```json
{
  "model": "gpt-4o",
  "safety": {
    "workingDir": ".",
    "allowedPaths": ["**/*"],
    "blockedPaths": ["**/node_modules/**", "**/.git/**"],
    "blockSecrets": true
  },
  "history": {
    "enabled": true,
    "dbPath": ".ai-code/history.db"
  },
  "tasks": {
    "enabled": true,
    "dbPath": ".ai-code/tasks.db"
  }
}
```
