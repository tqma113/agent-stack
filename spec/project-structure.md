# 项目结构详解

## 1. 目录结构总览

```
agent-stack/
├── packages/                    # 所有包目录
│   ├── libs/                   # 核心业务库 (@agent-stack/*)
│   │   ├── provider/           # @agent-stack/provider
│   │   ├── mcp/                # @agent-stack/mcp
│   │   ├── skill/              # @agent-stack/skill
│   │   ├── memory/             # @agent-stack/memory (策略层)
│   │   ├── memory-store/       # @agent-stack/memory-store (存储层)
│   │   └── index/              # @agent-stack/index
│   ├── skills/                 # 自定义 Skills (@agent-stack-skill/*)
│   │   └── memory/             # @agent-stack-skill/memory
│   └── mcp-servers/            # 自定义 MCP 服务器 (@agent-stack-mcp/*)
│       ├── fetch/              # @agent-stack-mcp/fetch
│       ├── time/               # @agent-stack-mcp/time
│       └── git/                # @agent-stack-mcp/git
├── example/                    # 示例项目
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
packages/libs/provider/
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
packages/libs/index/
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
packages/libs/mcp/
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
packages/libs/skill/
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

## 6. Memory 系统包

Memory 系统采用三层架构，分离关注点：

- **@agent-stack/memory-store**: SQLite 存储层 (IO 操作)
- **@agent-stack/memory**: 策略层 (何时读写、写什么)
- **@agent-stack-skill/memory**: Skill 工具层 (Agent 可调用的工具)

### 6.1 @agent-stack/memory-store 包 (存储层)

```
packages/libs/memory-store/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── errors.ts              # 错误类
│   └── stores/                # 存储实现
│       ├── index.ts           # 存储导出
│       ├── db-operations.ts   # 数据库操作组合函数
│       ├── event.ts           # createEventStore()
│       ├── task-state.ts      # createTaskStateStore()
│       ├── summary.ts         # createSummaryStore()
│       ├── profile.ts         # createProfileStore()
│       └── semantic.ts        # createSemanticStore()
├── dist/
├── package.json
└── tsup.config.ts
```

**package.json**:
```json
{
  "name": "@agent-stack/memory-store",
  "version": "0.0.1",
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "sqlite-vec": "^0.1.6"
  }
}
```

### 6.2 @agent-stack/memory 包 (策略层)

```
packages/libs/memory/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # Legacy 类型 (向后兼容)
│   ├── policy/                # 策略层 (NEW)
│   │   ├── index.ts           # 策略导出
│   │   ├── types.ts           # 策略类型定义
│   │   ├── memory-policy.ts   # createMemoryPolicy() 主策略
│   │   ├── retrieval-policy.ts# createRetrievalPolicy() 检索决策
│   │   ├── write-policy.ts    # createWritePolicy() 写入决策
│   │   └── budget-policy.ts   # createBudgetPolicy() Token 预算
│   ├── rules/                 # 规则引擎 (NEW)
│   │   ├── index.ts           # 规则导出
│   │   ├── rule-engine.ts     # createRuleEngine()
│   │   └── default-rules.ts   # 默认规则配置
│   ├── observer.ts            # 事件创建辅助
│   ├── injector.ts            # 模板注入
│   ├── summarizer.ts          # 摘要生成
│   ├── state-reducer.ts       # 任务状态 Reducer
│   └── manager.ts             # Legacy MemoryManager (向后兼容)
├── tests/
├── dist/
├── package.json
└── vitest.config.ts
```

**package.json**:
```json
{
  "name": "@agent-stack/memory",
  "version": "0.0.1",
  "dependencies": {
    "@agent-stack/memory-store": "workspace:*",
    "better-sqlite3": "^11.7.0"
  }
}
```

---

## 7. Skills 目录 (@agent-stack-skill/*)

自定义 Skills 使用独立的包前缀 `@agent-stack-skill/*`。

### 7.1 @agent-stack-skill/memory (Memory Skill)

```
packages/skills/memory/
├── skill.json                 # Skill 定义文件
├── handlers.cjs               # 编译后的处理函数
├── src/
│   ├── handlers.ts            # search/upsert/delete 实现
│   ├── schema.ts              # JSON Schema 定义
│   └── store-context.ts       # 数据库连接管理
├── scripts/
│   └── copy-handlers.js       # 构建脚本
├── dist/
└── package.json
```

**skill.json 工具定义**:
```json
{
  "name": "memory",
  "version": "1.0.0",
  "tools": [
    { "name": "search", "description": "Search memory...", "handler": "./handlers.cjs#search" },
    { "name": "upsert", "description": "Create or update memory...", "handler": "./handlers.cjs#upsert" },
    { "name": "delete", "description": "Delete memory...", "handler": "./handlers.cjs#delete" }
  ]
}
```

**package.json**:
```json
{
  "name": "@agent-stack-skill/memory",
  "version": "0.0.1",
  "dependencies": {
    "@agent-stack/memory-store": "workspace:*",
    "better-sqlite3": "^11.7.0"
  }
}
```

---

### 7.2 五层记忆架构

| 层级 | 工厂函数 | 用途 | 优先级 |
|------|----------|------|--------|
| Profile | `createProfileStore()` | 用户偏好 (语言/格式/禁忌) | 1 (最高) |
| TaskState | `createTaskStateStore()` | 当前任务状态 (目标/计划/进度) | 2 |
| Summary | `createSummaryStore()` | 滚动摘要 (决策/结论/下一步) | 3 |
| Episodic | `createEventStore()` | 事件日志 (对话/工具/决策) | 4 |
| Semantic | `createSemanticStore()` | 可检索材料 (全文/向量) | 5 (最低) |

### 7.3 调用流程

**Before (直接调用)**:
```typescript
// agent.ts - 旧方式
await memoryManager.recordEvent(event);
const bundle = await memoryManager.retrieve({ query });
```

**After (Policy + Skill)**:
```typescript
// agent.ts - 新方式
const decision = memoryPolicy.shouldRetrieve({ userQuery, sessionId });
if (decision.shouldRetrieve) {
  const params = memoryPolicy.buildSearchParams(context);
  const result = await tools.get('skill__memory__search').execute(params);
}

const writeDecision = memoryPolicy.shouldWrite({ event });
if (writeDecision.shouldWrite) {
  for (const op of writeDecision.operations) {
    await tools.get('skill__memory__upsert').execute(op.payload);
  }
}
```

---

## 8. MCP 服务器 (packages/mcp-servers/)

自定义 MCP 服务器使用独立的包前缀 `@agent-stack-mcp/*`。

### 8.1 @agent-stack-mcp/fetch

Web 内容获取 MCP 服务器，支持 HTML 转 Markdown。

```
packages/mcp-servers/fetch/
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

### 8.2 @agent-stack-mcp/time

时间和时区转换 MCP 服务器，提供当前时间查询和时区转换功能。

```
packages/mcp-servers/time/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── timezone.ts            # 时区工具函数
│   ├── server.ts              # MCP Server 实现
│   └── cli.ts                 # CLI 入口
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**提供的工具**：

| 工具名 | 描述 |
|--------|------|
| `get_current_time` | 获取指定时区或系统时区的当前时间 |
| `convert_time` | 在不同时区之间转换时间 |

**get_current_time 返回格式**：
```json
{
  "timezone": "Asia/Tokyo",
  "datetime": "2024-01-01T13:00:00+09:00",
  "is_dst": false
}
```

**convert_time 返回格式**：
```json
{
  "source": { "timezone": "America/New_York", "datetime": "...", "is_dst": false },
  "target": { "timezone": "Asia/Tokyo", "datetime": "...", "is_dst": false },
  "time_difference": "+14.0h"
}
```

**package.json 关键配置**：

```json
{
  "name": "@agent-stack-mcp/time",
  "version": "0.0.1",
  "bin": {
    "mcp-time": "./dist/cli.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.24.0"
  }
}
```

**MCP 配置示例**：

```json
{
  "mcpServers": {
    "time": {
      "command": "npx",
      "args": ["-y", "@agent-stack-mcp/time"]
    }
  }
}
```

**自定义本地时区**：

```json
{
  "mcpServers": {
    "time": {
      "command": "npx",
      "args": ["-y", "@agent-stack-mcp/time", "--local-timezone=America/New_York"]
    }
  }
}
```

### 8.3 @agent-stack-mcp/git

Git 仓库操作 MCP 服务器，提供完整的 Git 操作工具集。

```
packages/mcp-servers/git/
├── src/
│   ├── index.ts               # 包入口
│   ├── types.ts               # 类型定义
│   ├── git-operations.ts      # Git 操作实现
│   ├── server.ts              # MCP Server 实现
│   └── cli.ts                 # CLI 入口
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**提供的工具**：

| 工具名 | 描述 |
|--------|------|
| `git_status` | 显示工作区状态 |
| `git_diff_unstaged` | 显示未暂存的更改 |
| `git_diff_staged` | 显示已暂存的更改 |
| `git_diff` | 与目标分支/提交比较差异 |
| `git_commit` | 提交更改 |
| `git_add` | 添加文件到暂存区 |
| `git_reset` | 取消所有暂存 |
| `git_log` | 显示提交历史 |
| `git_create_branch` | 创建新分支 |
| `git_checkout` | 切换分支 |
| `git_show` | 显示提交内容 |
| `git_branch` | 列出分支 |

**git_log 返回格式**：
```json
[
  {
    "hash": "abc123...",
    "author": "John Doe",
    "date": "2024-01-01T12:00:00+08:00",
    "message": "feat: add new feature"
  }
]
```

**package.json 关键配置**：

```json
{
  "name": "@agent-stack-mcp/git",
  "version": "0.0.1",
  "bin": {
    "mcp-git": "./dist/cli.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.24.0"
  }
}
```

**MCP 配置示例**：

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@agent-stack-mcp/git"]
    }
  }
}
```

**指定默认仓库路径**：

```json
{
  "mcpServers": {
    "git": {
      "command": "npx",
      "args": ["-y", "@agent-stack-mcp/git", "--repository", "/path/to/repo"]
    }
  }
}
```

---

## 9. Rush 配置目录

### 9.1 common/config/rush/

```
common/config/rush/
├── .npmrc                     # npm 配置
├── command-line.json          # 自定义命令
├── common-versions.json       # 共享版本
├── pnpm-config.json          # pnpm 配置
├── pnpm-lock.yaml            # 依赖锁文件
└── ... (其他 Rush 配置)
```

### 9.2 common/scripts/

```
common/scripts/
├── install-run.js            # 通用安装运行脚本
├── install-run-rush.js       # Rush 安装运行脚本
├── install-run-rushx.js      # Rushx 安装运行脚本
└── install-run-rush-pnpm.js  # pnpm 安装运行脚本
```

---

## 10. 开发工具配置

### 10.1 .claude/ 目录

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

### 10.2 .ttadk/ 目录

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

## 11. 构建输出

### 11.1 dist/ 目录结构

每个包的 `dist/` 目录输出：

```
dist/
├── index.js           # CommonJS 入口
├── index.mjs          # ESM 入口
├── index.d.ts         # TypeScript 类型声明
├── index.d.mts        # ESM 类型声明
└── index.js.map       # Source Map
```

### 11.2 构建命令

```bash
# 单包构建
rushx build

# 全量构建
rush build

# 重新构建
rush rebuild
```
