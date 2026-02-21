# 架构设计

本文档描述 AI Stack 的整体架构、设计理念和模块关系。

---

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              应用层 (Applications)                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────┐  │
│  │  @ai-stack/assistant    │  │  @ai-stack/code         │  │  自定义 Agent   │  │
│  │  (个人 AI 助手)          │  │  (代码编辑 Agent)        │  │  (用户实现)     │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └────────┬────────┘  │
└───────────────┼─────────────────────────────┼──────────────────────┼────────────┘
                │                             │                      │
                └─────────────────────────────┼──────────────────────┘
                                              │
┌─────────────────────────────────────────────┴───────────────────────────────────┐
│                              核心层 (Core)                                        │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                           @ai-stack/agent                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  对话管理    │  │  工具执行    │  │  权限管控    │  │  高级编排        │   │  │
│  │  │  流式响应    │  │  并行执行    │  │  规则引擎    │  │  状态机/恢复     │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────┴────────────────────────────────────────┐
│                              能力层 (Capabilities)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ @ai-stack/   │  │ @ai-stack/   │  │ @ai-stack/   │  │ @ai-stack/           │ │
│  │ mcp          │  │ skill        │  │ memory       │  │ knowledge            │ │
│  │              │  │              │  │              │  │                      │ │
│  │ MCP 协议     │  │ 技能系统     │  │ 记忆系统     │  │ 知识索引             │ │
│  │ 外部工具     │  │ 本地工具     │  │ 持久状态     │  │ 代码/文档            │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────────┼─────────────┘
          │                 │                 │                     │
┌─────────┴─────────────────┴─────────────────┴─────────────────────┴─────────────┐
│                              基础层 (Foundation)                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │  @ai-stack/provider  │  │  @ai-stack/tui                                  │  │
│  │                      │  │                                                 │  │
│  │  多模型 LLM 抽象     │  │  终端 UI 组件                                   │  │
│  │  OpenAI/Claude/Gemini│  │  Ink 组件 + 直接输出                            │  │
│  └──────────┬───────────┘  └─────────────────────────────────────────────────┘  │
└─────────────┼───────────────────────────────────────────────────────────────────┘
              │
┌─────────────┴───────────────────────────────────────────────────────────────────┐
│                              存储层 (Storage)                                    │
│  ┌────────────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │  @ai-stack/memory-store-sqlite     │  │  @ai-stack/memory-store-json       │ │
│  │                                    │  │                                    │ │
│  │  SQLite + FTS5 + sqlite-vec        │  │  JSON/Markdown 轻量存储            │ │
│  │  高性能生产环境                     │  │  开发/原型环境                     │ │
│  └────────────────────────────────────┘  └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 包依赖关系

```
                              ┌─────────────────┐
                              │    openai       │
                              │ @anthropic-ai   │
                              │ @google/genai   │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │  @ai-stack/     │
                              │  provider       │
                              └────────┬────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│ @ai-stack/    │            │ @ai-stack/    │            │ @ai-stack/    │
│ mcp           │            │ skill         │            │ tui           │
└───────┬───────┘            └───────┬───────┘            └───────┬───────┘
        │                            │                            │
        │    ┌───────────────────────┼────────────────────────────┤
        │    │                       │                            │
        │    │              ┌────────▼────────┐                   │
        │    │              │ better-sqlite3  │                   │
        │    │              │ sqlite-vec      │                   │
        │    │              └────────┬────────┘                   │
        │    │                       │                            │
        │    │    ┌──────────────────┼──────────────────┐         │
        │    │    │                  │                  │         │
        │    │    ▼                  ▼                  ▼         │
        │    │ ┌─────────┐    ┌─────────────┐    ┌───────────┐   │
        │    │ │ memory- │    │ memory-     │    │           │   │
        │    │ │ store-  │    │ store-json  │    │ knowledge │   │
        │    │ │ sqlite  │    │             │    │           │   │
        │    │ └────┬────┘    └──────┬──────┘    └─────┬─────┘   │
        │    │      │                │                 │         │
        │    │      └────────────────┼─────────────────┘         │
        │    │                       │                           │
        │    │              ┌────────▼────────┐                  │
        │    │              │  @ai-stack/     │                  │
        │    │              │  memory         │                  │
        │    │              └────────┬────────┘                  │
        │    │                       │                           │
        └────┼───────────────────────┼───────────────────────────┘
             │                       │
             │              ┌────────▼────────┐
             └──────────────►  @ai-stack/     │
                            │  agent          │
                            └────────┬────────┘
                                     │
                   ┌─────────────────┼─────────────────┐
                   │                 │                 │
                   ▼                 ▼                 ▼
            ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
            │ @ai-stack/  │  │ @ai-stack/  │  │   Custom    │
            │ assistant   │  │ code        │  │   Agent     │
            └─────────────┘  └─────────────┘  └─────────────┘
```

---

## 3. 核心模块职责

### 3.1 Provider (@ai-stack/provider)

**职责**：多模型 LLM 抽象，提供统一的聊天和嵌入接口

```typescript
// 统一接口
const provider = createProvider({ provider: 'openai', apiKey: '...' });
await provider.chat(messages, options);
await provider.chatStream(messages, options);
await provider.embed(text);
```

**支持的提供商**：
| 提供商 | 聊天 | 流式 | 工具调用 | 嵌入 |
|--------|------|------|----------|------|
| OpenAI | ✓ | ✓ | ✓ | ✓ |
| Anthropic | ✓ | ✓ | ✓ | ✗ |
| Google | ✓ | ✓ | ✓ | ✓ |
| OpenAI 兼容 | ✓ | ✓ | 取决于实现 | 取决于实现 |

### 3.2 MCP (@ai-stack/mcp)

**职责**：Model Context Protocol 集成，连接外部工具服务器

```typescript
// 管理多个 MCP 服务器
const manager = createMCPClientManager();
await manager.initialize('.mcp.json');
await manager.connectAll();

// 获取工具并桥接到 Agent
const tools = createMCPToolProvider(manager).getTools();
```

**传输类型**：
- `stdio` - 本地进程 (命令行工具)
- `http` - HTTP 服务
- `sse` - Server-Sent Events

### 3.3 Skill (@ai-stack/skill)

**职责**：本地技能系统，动态加载和管理工具

```typescript
// 加载技能
const manager = createSkillManager();
await manager.discoverAndLoad('./skills');

// 获取工具
const tools = createSkillToolProvider(manager).getTools();
```

**Skill 定义** (`skill.json`):
```json
{
  "name": "web-search",
  "tools": [{
    "name": "search",
    "handler": "./handlers.js#search"
  }]
}
```

### 3.4 Memory (@ai-stack/memory)

**职责**：持久化记忆系统，管理对话历史和任务状态

**五层记忆架构**：

| 层级 | 存储 | 用途 | 优先级 |
|------|------|------|--------|
| Profile | ProfileStore | 用户偏好 | 最高 |
| TaskState | TaskStateStore | 当前任务 | 高 |
| Summary | SummaryStore | 滚动摘要 | 中 |
| Episodic | EventStore | 事件日志 | 低 |
| Semantic | SemanticStore | 可检索内容 | 最低 |

**策略层**：
- `RetrievalPolicy` - 何时检索、检索什么
- `WritePolicy` - 何时写入、写入什么
- `BudgetPolicy` - Token 预算分配

### 3.5 Knowledge (@ai-stack/knowledge)

**职责**：代码库和文档索引，提供语义搜索

```typescript
const knowledge = createKnowledgeManager({
  code: { rootDir: './src', watch: true },
  doc: { enabled: true },
});

await knowledge.indexCode();
await knowledge.addDocSource({ url: 'https://react.dev' });
await knowledge.crawlDocs();

const results = await knowledge.search('useEffect');
```

### 3.6 TUI (@ai-stack/tui)

**职责**：终端 UI 组件，混合架构支持 TTY 和非 TTY 环境

```
┌─────────────────────────────────────────────────────────────┐
│                      @ai-stack/tui                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Ink 组件      │    │   Core 模块 (直接 stdout)       │ │
│  │  (React TUI)    │    │                                 │ │
│  │                 │    │  - StreamRenderer (token 流)    │ │
│  │  - Confirm      │    │  - 颜色/图标                    │ │
│  │  - Select       │    │  - 终端检测                     │ │
│  │  - DiffView     │    │  - Spinner                     │ │
│  │  - TaskBoard    │    │                                 │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│          │                           │                       │
│          └───────────┬───────────────┘                       │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Adapters (环境自动检测)                     │ │
│  │  TTY Mode: Ink 组件  |  Classic Mode: 直接输出          │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.7 Agent (@ai-stack/agent)

**职责**：核心 Agent 实现，集成所有能力

**核心功能**：
- 对话管理和流式响应
- 工具注册和执行
- MCP/Skill/Memory/Knowledge 集成
- 权限管控
- 高级编排 (状态机、恢复策略、计划 DAG)

---

## 4. 数据流

### 4.1 对话流程

```
用户输入
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Agent                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. 权限检查 (Guardrail)                                      ││
│  │    - 输入验证                                                ││
│  │    - PII/注入检测                                            ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 2. 上下文准备                                                ││
│  │    - Memory 检索 → 注入历史上下文                            ││
│  │    - Knowledge 搜索 → 注入相关知识                           ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 3. LLM 调用                                                  ││
│  │    - 模型路由 (选择合适的模型)                               ││
│  │    - Provider.chat/chatStream                               ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 4. 工具执行 (如果需要)                                       ││
│  │    - 权限检查                                                ││
│  │    - 并行执行                                                ││
│  │    - 结果收集                                                ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 5. 后处理                                                    ││
│  │    - Memory 写入 (记录事件)                                  ││
│  │    - 输出验证 (Guardrail)                                   ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                         Agent 响应
```

### 4.2 工具执行流程

```
LLM 返回 tool_calls
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                       工具执行管道                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 1. 解析工具调用                                              ││
│  │    - 提取 function.name 和 function.arguments               ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 2. 权限检查                                                  ││
│  │    - 匹配权限规则                                            ││
│  │    - 确认 / 拒绝 / 自动批准                                  ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 3. 工具查找                                                  ││
│  │    - 本地工具 (直接注册)                                     ││
│  │    - MCP 工具 (mcp__server__tool)                           ││
│  │    - Skill 工具 (skill__name__tool)                         ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 4. 执行                                                      ││
│  │    - 超时控制                                                ││
│  │    - 错误处理                                                ││
│  │    - 重试策略                                                ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │ 5. 结果处理                                                  ││
│  │    - 格式化结果                                              ││
│  │    - 添加到消息历史                                          ││
│  │    - 触发回调 (onToolResult)                                ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
                    继续 LLM 对话循环
```

---

## 5. 高级编排模块

### 5.1 状态机 (StateMachine)

管理 Agent 执行状态，支持暂停/恢复和检查点。

```
idle ──────► planning ──────► executing ──────► completed
                  │                │
                  ▼                ▼
               paused ◄──────► waiting
                  │                │
                  ▼                ▼
               error ◄─────────────┘
```

### 5.2 恢复策略 (RecoveryPolicy)

处理执行错误，提供自动重试和熔断器。

**退避策略**：
| 策略 | 公式 | 适用场景 |
|------|------|----------|
| fixed | `delay` | 简单重试 |
| linear | `delay × attempt` | 渐进增加 |
| exponential | `delay × 2^(attempt-1)` | API 调用 |
| fibonacci | `delay × fib(attempt)` | 长时任务 |

### 5.3 计划 DAG (PlanDAG)

管理任务依赖关系，支持并行执行。

```
  Task A ────┐
             │
  Task B ────┼───► Task D ────► Task F
             │
  Task C ────┘
```

### 5.4 评估器 (Evaluator)

评估 Agent 输出质量，决定是否重试。

**评估维度**：
- accuracy (准确性)
- completeness (完整性)
- relevance (相关性)
- safety (安全性)
- coherence (一致性)
- helpfulness (帮助性)

### 5.5 模型路由 (ModelRouter)

根据任务类型智能选择模型，优化成本。

| 任务类型 | 推荐层级 |
|----------|----------|
| tool_selection | fast |
| classification | fast |
| code_generation | strong |
| reasoning | strong |
| conversation | standard |

---

## 6. Super Agent 增强模块 (NEW)

### 6.1 无限 Agentic Loop + 智能终止

Super Loop 提供更自主的执行能力，支持无限迭代直到任务真正完成。

```typescript
const agent = createAgent({
  superLoop: {
    infiniteLoop: true,         // 启用无限循环
    qualityThreshold: 0.7,      // 质量阈值
    detectTaskCompletion: true, // 启用任务完成检测
    checkpointInterval: 5,      // 每 5 次迭代创建检查点
  },
  stopConditions: {
    maxCost: 1.0,               // 成本限制
    maxDurationMs: 5 * 60000,   // 时间限制
    maxTotalTokens: 100000,     // Token 限制
  },
});
```

**终止条件层次**：

```
┌─────────────────────────────────────────────────────────────────┐
│                      智能终止决策                                │
├─────────────────────────────────────────────────────────────────┤
│  1. 硬限制 (Hard Stop) - 不可覆盖                               │
│     - Token 超限                                                │
│     - 成本超限                                                  │
│     - 时间超限                                                  │
├─────────────────────────────────────────────────────────────────┤
│  2. 软限制 (Soft Stop) - 可通过回调覆盖                         │
│     - 迭代次数达到                                              │
│     - 连续工具失败                                              │
│     - 停止模式匹配                                              │
├─────────────────────────────────────────────────────────────────┤
│  3. 任务完成检测                                                │
│     - 完成模式匹配                                              │
│     - LLM 完成度评估                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 自动上下文压缩 (Auto Compaction)

当上下文接近模型限制时自动触发压缩。

```typescript
const agent = createAgent({
  memory: { enabled: true },
  compaction: {
    enabled: true,
    softThreshold: 0.6,        // 60% 时警告
    hardThreshold: 0.8,        // 80% 时压缩
    maxContextTokens: 128000,  // 最大上下文
    onCompaction: (result) => {
      console.log(`压缩: ${result.tokensBefore} → ${result.tokensAfter}`);
    },
  },
});
```

**压缩流程**：

```
上下文使用量监控
        │
        ▼
┌───────────────────┐
│ 检查 Token 使用率 │
└────────┬──────────┘
         │
   ┌─────▼─────┐     ┌─────────────┐
   │ < 60%     │────►│ 正常运行    │
   └───────────┘     └─────────────┘
         │
   ┌─────▼─────┐     ┌─────────────┐
   │ 60-80%    │────►│ 发出警告    │
   └───────────┘     └─────────────┘
         │
   ┌─────▼─────┐     ┌─────────────────────────────┐
   │ > 80%     │────►│ 触发压缩                     │
   └───────────┘     │ 1. 提取关键事件             │
                     │ 2. 生成摘要                 │
                     │ 3. 写入语义存储             │
                     │ 4. 清理旧事件               │
                     └─────────────────────────────┘
```

### 6.3 自我反思循环 (Self-Reflection)

自动评估响应质量，不满足标准时重试。

```typescript
const agent = createAgent({
  evaluator: { enabled: true, useLLMEval: true },
  selfReflection: {
    enabled: true,
    passThreshold: 0.7,    // 通过阈值
    maxRetries: 1,         // 最多重试 1 次
    enableSelfCheck: true, // 启用一致性检查
    includeFeedback: true, // 重试时包含反馈
  },
});
```

**反思流程**：

```
Agent 生成响应
        │
        ▼
┌───────────────────┐
│ Evaluator 评估    │
│ - 准确性          │
│ - 完整性          │
│ - 相关性          │
│ - 安全性          │
└────────┬──────────┘
         │
   ┌─────▼─────┐
   │ 评分 ≥ 0.7│────► 返回响应
   └───────────┘
         │
   ┌─────▼─────────────┐
   │ 评分 < 0.7        │
   │ 重试次数 < 上限   │
   └─────────┬─────────┘
             │
             ▼
   ┌─────────────────────┐
   │ 生成改进反馈        │
   │ 重新生成响应        │
   └─────────────────────┘
```

### 6.4 工具编排器 (Tool Orchestrator)

智能工具选择和执行规划。

```typescript
import { createToolOrchestrator } from '@ai-stack/agent';

const orchestrator = createToolOrchestrator({
  maxSteps: 10,
  maxConcurrency: 3,
  retryFailedSteps: true,
});

// 规划工具链
const chain = await orchestrator.plan('查找并修改所有 TODO 注释', {
  availableTools: agent.getTools(),
});

// 获取下一步建议
const suggestions = orchestrator.suggestNextTools({
  lastToolCall: { name: 'Glob', result: '...' },
  availableTools: ['Read', 'Edit', 'Grep'],
});
```

---

## 7. 安全架构

### 7.1 权限管控

```
工具调用请求
     │
     ▼
┌─────────────────────────┐
│ 1. Session 记忆检查      │ ← 本会话已批准?
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 2. 规则匹配              │ ← 匹配权限规则
│    - 精确匹配           │
│    - Glob 模式          │
│    - 正则表达式         │
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 3. 分类默认权限          │ ← read/write/execute/admin
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│ 4. 权限决策              │
│    - auto: 直接执行     │
│    - confirm: 请求确认  │
│    - deny: 拒绝执行     │
└─────────────────────────┘
```

### 7.2 Guardrail (安全检查)

**内置规则**：
- PII 检测 (个人信息)
- 密钥检测 (API Key, Token)
- 危险命令检测 (rm -rf, DROP TABLE)
- Prompt 注入检测
- 长度限制

---

## 8. 扩展点

### 8.1 自定义 Provider

```typescript
const customProvider = createProvider({
  provider: 'openai-compatible',
  baseURL: 'http://localhost:11434/v1',
  name: 'ollama',
});
```

### 8.2 自定义 MCP 服务器

```typescript
// mcp-servers/my-server/src/server.ts
const server = createServer();
server.setRequestHandler('tools/call', handleToolCall);
server.run();
```

### 8.3 自定义 Skill

```json
// skills/my-skill/skill.json
{
  "name": "my-skill",
  "tools": [{
    "name": "my_tool",
    "handler": "./handlers.js#myTool"
  }]
}
```

### 8.4 自定义存储

```typescript
// 实现 MemoryStores 接口
const customStores: MemoryStores = {
  event: createCustomEventStore(),
  taskState: createCustomTaskStateStore(),
  summary: createCustomSummaryStore(),
  profile: createCustomProfileStore(),
  semantic: createCustomSemanticStore(),
};

const memory = createMemoryManager(customStores);
```

---

## 9. 最佳实践

### 9.1 工厂函数模式

```typescript
// 正确
export function createMyComponent(config: MyConfig): MyComponentInstance {
  let state = initialState;
  return {
    method() { ... },
    getState() { return state; },
  };
}

// 错误 - 不使用类
export class MyComponent { ... }
```

### 9.2 依赖注入

```typescript
// 通过构造函数注入依赖
const agent = createAgent({
  provider: createProvider({ provider: 'openai' }),
  memory: createMemoryManager(stores),
  knowledge: createKnowledgeManager(config),
});
```

### 9.3 错误处理

```typescript
try {
  await agent.chat(input);
} catch (error) {
  if (error instanceof ProviderRateLimitError) {
    await delay(error.retryAfter);
    // 重试
  } else if (error instanceof ToolExecutionError) {
    // 工具执行失败，继续对话
  } else {
    throw error;
  }
}
```

### 9.4 资源清理

```typescript
const agent = createAgent(config);
try {
  // 使用 agent
} finally {
  await agent.close(); // 清理 MCP、Skill、Memory 等资源
}
```
