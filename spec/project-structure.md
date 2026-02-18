# 项目结构详解

## 1. 目录结构总览

```
agent-stack/
├── packages/                    # 核心业务包目录
│   ├── provider/               # @agent-stack/provider
│   ├── mcp/                    # @agent-stack/mcp
│   ├── skill/                  # @agent-stack/skill
│   ├── memory/                 # @agent-stack/memory
│   └── index/                  # @agent-stack/index
├── mcp-servers/                 # 自定义 MCP 服务器 (@agent-stack-mcp/*)
│   └── fetch/                  # @agent-stack-mcp/fetch
├── examples/                   # 示例配置（非 Rush 项目）
│   ├── .agent-stack.json      # Agent 配置示例
│   ├── .mcp.json              # MCP 配置示例
│   └── skills/                # 示例 Skills
├── common/                     # Rush 公共目录
│   ├── config/rush/           # Rush 配置
│   ├── scripts/               # Rush 脚本
│   └── temp/                  # 临时文件
├── .claude/                   # Claude Code 配置
├── .ttadk/                    # TTADK 插件
├── .github/                   # GitHub 配置
├── .mcp.json                  # MCP 服务器配置
├── spec/                      # 项目文档
└── rush.json                  # Rush 主配置
```

---

## 2. @agent-stack/provider 包

### 2.1 目录结构

```
packages/provider/
├── src/
│   ├── index.ts               # 包入口
│   └── openai/                # OpenAI 模块
│       ├── index.ts           # 模块导出
│       ├── client.ts          # OpenAIClient 类 (303 行)
│       ├── types.ts           # 类型定义 (165 行)
│       └── helpers.ts         # 辅助函数 (158 行)
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 2.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口，re-export openai 模块 |
| `src/openai/client.ts` | `createOpenAIClient()` 工厂函数 |
| `src/openai/types.ts` | TypeScript 类型定义和接口 |
| `src/openai/helpers.ts` | 消息构建、工具定义等辅助函数 |

### 2.3 package.json 关键配置

```json
{
  "name": "@agent-stack/provider",
  "version": "0.0.1",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "dependencies": {
    "openai": "^4.77.0"
  }
}
```

---

## 3. @agent-stack/index 包

### 3.1 目录结构

```
packages/index/
├── src/
│   ├── index.ts               # 包入口
│   ├── agent.ts               # Agent 类实现
│   ├── types.ts               # 类型定义
│   ├── config.ts              # 配置文件加载
│   ├── cli.ts                 # 命令式 CLI
│   └── ui/                    # 终端 UI 模块
│       ├── index.ts           # UI 模块导出
│       ├── types.ts           # UI 类型定义
│       ├── colors.ts          # 主题和颜色
│       ├── spinner.ts         # Ora spinner 封装
│       ├── box.ts             # 消息框渲染
│       ├── layout.ts          # 布局组件
│       └── stream.ts          # 流式输出管理
├── dist/                      # 构建输出
├── package.json
└── tsup.config.ts
```

### 3.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口，re-export agent、config 和 provider |
| `src/agent.ts` | `createAgent()` 工厂函数，实现对话和工具调用 |
| `src/types.ts` | Agent 相关类型定义 |
| `src/config.ts` | 配置文件加载和解析 (.agent-stack.json) |
| `src/cli.ts` | 命令式 CLI，支持 chat/run/tools/config 命令 |
| `src/ui/` | 终端 UI 模块，提供现代化界面组件 |

### 3.3 package.json 关键配置

```json
{
  "name": "@agent-stack/index",
  "version": "0.0.1",
  "bin": {
    "agent-stack": "./dist/cli.js"
  },
  "dependencies": {
    "@agent-stack/provider": "workspace:*",
    "@agent-stack/mcp": "workspace:*",
    "@agent-stack/skill": "workspace:*",
    "@agent-stack/memory": "workspace:*",
    "boxen": "^8.0.1",
    "chalk": "^5.4.0",
    "cli-truncate": "^4.0.0",
    "commander": "^12.1.0",
    "ora": "^8.1.0",
    "strip-ansi": "^7.1.0",
    "terminal-size": "^4.0.0"
  }
}
```

---

## 4. @agent-stack/mcp 包

### 4.1 目录结构

```
packages/mcp/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── config.ts              # 配置加载
│   ├── transport.ts           # 传输层工厂
│   ├── client.ts              # MCPClientManager 类
│   ├── bridge.ts              # 工具桥接
│   └── helpers.ts             # 辅助函数
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 4.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口 |
| `src/types.ts` | MCP 相关类型定义和错误类 |
| `src/config.ts` | 配置文件加载和解析 |
| `src/transport.ts` | 创建 stdio/http 传输 |
| `src/client.ts` | `createMCPClientManager()` 工厂函数 |
| `src/bridge.ts` | `createMCPToolProvider()` 工厂函数 |
| `src/helpers.ts` | 工具名处理、超时控制等辅助函数 |

### 4.3 package.json 关键配置

```json
{
  "name": "@agent-stack/mcp",
  "version": "0.0.1",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

---

## 5. @agent-stack/skill 包

### 5.1 目录结构

```
packages/skill/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── config.ts              # 配置加载
│   ├── loader.ts              # Skill 加载器
│   ├── manager.ts             # SkillManager 类
│   ├── bridge.ts              # 工具桥接
│   └── helpers.ts             # 辅助函数
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### 5.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口 |
| `src/types.ts` | Skill 相关类型定义和错误类 |
| `src/config.ts` | 配置文件加载和目录发现 |
| `src/loader.ts` | Skill 加载和处理函数解析 |
| `src/manager.ts` | `createSkillManager()` 工厂函数 |
| `src/bridge.ts` | `createSkillToolProvider()` 工厂函数 |
| `src/helpers.ts` | 工具名处理、路径解析等辅助函数 |

### 5.3 package.json 关键配置

```json
{
  "name": "@agent-stack/skill",
  "version": "0.0.1",
  "dependencies": {}
}
```

注：skill 包不需要外部运行时依赖，仅使用 Node.js 原生能力实现动态加载。

---

## 6. @agent-stack/memory 包

### 6.1 目录结构

```
packages/memory/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义 (800+ 行)
│   ├── errors.ts              # 错误类
│   ├── stores/                # 存储层
│   │   ├── index.ts           # 存储导出
│   │   ├── db-operations.ts   # 数据库操作组合函数
│   │   ├── event.ts           # createEventStore() 工厂函数
│   │   ├── task-state.ts      # createTaskStateStore() 工厂函数
│   │   ├── summary.ts         # createSummaryStore() 工厂函数
│   │   ├── profile.ts         # createProfileStore() 工厂函数
│   │   └── semantic.ts        # createSemanticStore() 工厂函数
│   ├── manager.ts             # MemoryManager 主入口
│   ├── observer.ts            # 事件采集
│   ├── retriever.ts           # 多路召回
│   ├── injector.ts            # 模板注入
│   ├── budgeter.ts            # Token 预算
│   ├── write-policy.ts        # 写入策略
│   ├── summarizer.ts          # 摘要生成
│   └── state-reducer.ts       # 任务状态 Reducer
├── tests/                     # 测试文件 (124 测试)
│   ├── stores/
│   │   ├── event.test.ts
│   │   ├── task-state.test.ts
│   │   ├── profile.test.ts
│   │   ├── summary.test.ts
│   │   └── semantic.test.ts
│   ├── state-reducer.test.ts
│   ├── write-policy.test.ts
│   └── integration/
│       └── regression.test.ts
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

### 6.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口 |
| `src/types.ts` | 完整类型定义 (Memory, Task, Profile, Semantic) |
| `src/errors.ts` | 错误类定义 |
| `src/stores/db-operations.ts` | `createDbOperations()` 数据库操作组合函数 |
| `src/stores/event.ts` | `createEventStore()` 事件日志存储 |
| `src/stores/task-state.ts` | `createTaskStateStore()` 任务状态存储 |
| `src/stores/summary.ts` | `createSummaryStore()` 对话摘要存储 |
| `src/stores/profile.ts` | `createProfileStore()` 用户偏好存储 |
| `src/stores/semantic.ts` | `createSemanticStore()` 语义检索 (FTS5 + 向量) |
| `src/manager.ts` | `createMemoryManager()` 主入口，协调所有组件 |
| `src/observer.ts` | `createMemoryObserver()` 事件创建辅助函数 |
| `src/retriever.ts` | `createMemoryRetriever()` 多路召回和优先级排序 |
| `src/injector.ts` | `createMemoryInjector()` 模板引擎 |
| `src/budgeter.ts` | `createMemoryBudgeter()` Token 预算分配 |
| `src/write-policy.ts` | `createWritePolicyEngine()` 写入决策和冲突解决 |
| `src/summarizer.ts` | `createMemorySummarizer()` 摘要生成和合并 |
| `src/state-reducer.ts` | `TaskStateReducer` 不可变任务状态更新 (纯函数) |

### 6.3 五层记忆架构

| 层级 | 工厂函数 | 用途 | 优先级 |
|------|----------|------|--------|
| Profile | `createProfileStore()` | 用户偏好 (语言/格式/禁忌) | 1 (最高) |
| TaskState | `createTaskStateStore()` | 当前任务状态 (目标/计划/进度) | 2 |
| Summary | `createSummaryStore()` | 滚动摘要 (决策/结论/下一步) | 3 |
| Episodic | `createEventStore()` | 事件日志 (对话/工具/决策) | 4 |
| Semantic | `createSemanticStore()` | 可检索材料 (全文/向量) | 5 (最低) |

### 6.4 package.json 关键配置

```json
{
  "name": "@agent-stack/memory",
  "version": "0.0.1",
  "dependencies": {
    "better-sqlite3": "^11.10.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "@types/better-sqlite3": "^7.6.12"
  }
}
```

---

## 7. MCP 服务器 (mcp-servers/)

自定义 MCP 服务器使用独立的包前缀 `@agent-stack-mcp/*`。

### 7.1 @agent-stack-mcp/fetch

Web 内容获取 MCP 服务器，支持 HTML 转 Markdown。

```
mcp-servers/fetch/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── fetcher.ts             # Web 获取和 HTML 处理
│   ├── server.ts              # MCP Server 实现
│   └── cli.ts                 # CLI 入口
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**文件职责**：

| 文件 | 职责 |
|------|------|
| `src/types.ts` | FetchInput/FetchResult 类型, Zod schema |
| `src/fetcher.ts` | `fetchUrl()` HTML 获取和 Markdown 转换 |
| `src/server.ts` | `createServer()` / `runServer()` MCP 服务器 |
| `src/cli.ts` | CLI 入口，读取环境变量配置 |

**package.json 关键配置**：

```json
{
  "name": "@agent-stack-mcp/fetch",
  "version": "0.0.1",
  "bin": {
    "mcp-fetch": "./dist/cli.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-html-markdown": "^1.3.0",
    "zod": "^3.24.0"
  }
}
```

**MCP 配置示例**：

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@agent-stack-mcp/fetch"]
    }
  }
}
```

---

## 8. Rush 配置目录

### 8.1 common/config/rush/

```
common/config/rush/
├── .npmrc                     # npm 配置
├── command-line.json          # 自定义命令
├── common-versions.json       # 共享版本
├── pnpm-config.json          # pnpm 配置
├── pnpm-lock.yaml            # 依赖锁文件
└── ... (其他 Rush 配置)
```

### 8.2 common/scripts/

```
common/scripts/
├── install-run.js            # 通用安装运行脚本
├── install-run-rush.js       # Rush 安装运行脚本
├── install-run-rushx.js      # Rushx 安装运行脚本
└── install-run-rush-pnpm.js  # pnpm 安装运行脚本
```

---

## 9. 开发工具配置

### 9.1 .claude/ 目录

```
.claude/
├── settings.json             # Claude Code 设置
├── commands/                 # 自定义命令
│   ├── adk/                 # ADK 相关命令
│   │   ├── plan.md
│   │   ├── specify.md
│   │   ├── tasks.md
│   │   └── ...
│   └── adkl/                # ADK Lite 命令
└── skills/                  # 技能定义
    └── common-knowledge/    # 通用知识库
```

### 9.2 .ttadk/ 目录

```
.ttadk/
├── config.json              # TTADK 配置
├── config-sum/             # 配置摘要
└── plugins/                # 插件
    └── ttadk/
        ├── core/           # 核心插件
        │   ├── mcps/       # MCP 服务配置
        │   └── resources/  # 模板和脚本
        └── common-kit/     # 通用工具包
```

---

## 10. 构建输出

### 10.1 dist/ 目录结构

每个包的 `dist/` 目录输出：

```
dist/
├── index.js           # CommonJS 入口
├── index.mjs          # ESM 入口
├── index.d.ts         # TypeScript 类型声明
├── index.d.mts        # ESM 类型声明
└── index.js.map       # Source Map
```

### 10.2 构建命令

```bash
# 单包构建
rushx build

# 全量构建
rush build

# 重新构建
rush rebuild
```
