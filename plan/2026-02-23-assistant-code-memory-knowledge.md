# Assistant Agent Memory/Knowledge 和 Code Knowledge 支持

## Context

用户希望统一 AI Stack 各个包的 Memory 和 Knowledge 支持：
- **Assistant**: 保留现有 Markdown Memory + 新增 Agent Memory + 新增 Agent Knowledge
- **Code**: 新增 Agent Knowledge（不自动索引，用户手动触发）

这样可以让：
1. Assistant 拥有双层记忆系统（显式的 Markdown + 隐式的 Agent Memory）
2. Assistant 可以索引文档/代码作为知识库
3. Code 可以搜索代码库和文档，提升代码理解能力

## 设计决策

### Markdown Memory 与 Agent Memory 的关系
- **Markdown Memory** = Source of Truth（用户可编辑的事实、待办、笔记）
- **Agent Memory** = 对话记忆（自动管理的事件、摘要、语义搜索）
- 启动时：Markdown → Agent Memory 单向同步（增量，内容不变则跳过）

### 存储结构

**Assistant** (`~/.ai-stack/`):
```
memory/
├── MEMORY.md              # Markdown Memory (source of truth)
├── markdown-index.db      # Markdown 派生索引 (原 sqlite.db)
├── agent.db               # Agent Memory (新增)
└── logs/
knowledge/
└── sqlite.db              # Agent Knowledge (新增)
scheduler/
└── jobs.json
```

**Code** (`./.ai-stack/`):
```
knowledge/
└── sqlite.db              # Agent Knowledge (新增)
history/
└── sqlite.db
tasks/
└── sqlite.db
```

## 实现完成

### 1. Assistant 类型定义更新

**文件**: `packages/libs/assistant/src/types.ts`

- 添加了 `AgentMemoryConfigSection` 接口
- 添加了 `AgentKnowledgeConfigSection` 接口
- 更新了 `AssistantConfig` 包含新字段

### 2. Assistant 配置解析更新

**文件**: `packages/libs/assistant/src/config.ts`

- 更新 `getDefaultConfig` 添加 agentMemory 和 agentKnowledge 默认值
- 更新 `resolveConfig` 处理新配置路径
- 重命名 markdown memory dbPath: `sqlite.db` → `markdown-index.db`

### 3. Markdown 到 Agent Memory 同步模块

**新文件**: `packages/libs/assistant/src/memory/markdown-to-agent-sync.ts`

- `syncMarkdownToAgentMemory()` - 主同步函数
- `createSyncState()` - 创建同步状态
- 使用 content hash 实现增量同步

### 4. Assistant 初始化流程更新

**文件**: `packages/libs/assistant/src/assistant/assistant.ts`

- 添加 `@ai-stack/memory` 和 `@ai-stack/knowledge` 导入
- 添加 Agent Memory 和 Knowledge Manager 初始化
- 实现 Markdown → Agent Memory 同步
- 添加新实例方法：
  - `getAgentMemory()`, `retrieveAgentMemory()`, `getAgentMemoryContext()`
  - `syncMarkdownToAgentMemory()`
  - `getKnowledge()`, `searchKnowledge()`, `indexCode()`, `crawlDocs()`, `addDocSource()`, `getKnowledgeStats()`

### 5. Code 类型定义更新

**文件**: `packages/libs/code/src/types.ts`

- 添加 `CodeKnowledgeConfig` 接口
- 添加 Knowledge 相关类型定义
- 更新 `CodeAgentInstance` 接口

### 6. Code 配置和初始化更新

**文件**: `packages/libs/code/src/config.ts`

- 添加 knowledge 配置默认值
- 更新 `resolveConfig` 处理 knowledge 配置

**文件**: `packages/libs/code/src/code-agent/code-agent.ts`

- 添加 Knowledge Manager 初始化
- 添加新实例方法

### 7. 依赖更新

**文件**: `packages/libs/assistant/package.json`, `packages/libs/code/package.json`

- 添加 `@ai-stack/knowledge` workspace 依赖

### 8. Example 配置更新

- `packages/examples/assistant/assistant.json` - 添加 agentMemory 和 agentKnowledge 配置
- `packages/examples/code/code.json` - 添加 knowledge 配置

### 9. 文档更新

- `spec/project-structure.md` - 更新存储目录结构
- `spec/architecture.md` - 添加双层记忆架构说明

## 关键文件清单

| 文件 | 修改类型 |
|------|----------|
| `packages/libs/assistant/src/types.ts` | 添加新接口 |
| `packages/libs/assistant/src/config.ts` | 更新默认值和解析 |
| `packages/libs/assistant/src/memory/markdown-to-agent-sync.ts` | 新文件 |
| `packages/libs/assistant/src/memory/index.ts` | 导出新模块 |
| `packages/libs/assistant/src/assistant/assistant.ts` | 主要修改 |
| `packages/libs/assistant/package.json` | 添加依赖 |
| `packages/libs/code/src/types.ts` | 添加新接口 |
| `packages/libs/code/src/config.ts` | 更新默认值和解析 |
| `packages/libs/code/src/code-agent/code-agent.ts` | 主要修改 |
| `packages/libs/code/package.json` | 添加依赖 |
| `packages/examples/assistant/assistant.json` | 更新配置 |
| `packages/examples/code/code.json` | 更新配置 |
| `spec/project-structure.md` | 更新文档 |
| `spec/architecture.md` | 更新文档 |

## 验证结果

✅ `rush build` 成功完成，所有 22 个包编译通过

## 使用示例

### Assistant 配置

```json
{
  "memory": { "enabled": true, "syncOnStartup": true },
  "agentMemory": { "enabled": true, "syncFromMarkdown": true },
  "agentKnowledge": { "enabled": false }
}
```

### Code 配置

```json
{
  "knowledge": {
    "enabled": false,
    "code": { "enabled": true, "autoIndex": false },
    "doc": { "enabled": true, "autoIndex": false }
  }
}
```

### 手动触发索引

```typescript
// Assistant
const assistant = createAssistant();
await assistant.initialize();
await assistant.indexCode();  // 手动触发代码索引

// Code
const code = createCodeAgent();
await code.initialize();
const results = await code.searchKnowledge('useEffect');
```
