# 项目结构详解

## 1. 目录结构总览

```
agent-stack/
├── packages/                    # 业务包目录
│   ├── provider/               # @agent-stack/provider
│   ├── mcp/                    # @agent-stack/mcp
│   ├── skill/                  # @agent-stack/skill
│   ├── memory/                 # @agent-stack/memory
│   └── index/                  # @agent-stack/index
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
| `src/openai/client.ts` | OpenAI API 客户端封装类 |
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
│   └── cli.ts                 # 命令式 CLI
├── dist/                      # 构建输出
├── package.json
└── tsup.config.ts
```

### 3.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口，re-export agent、config 和 provider |
| `src/agent.ts` | Agent 核心类，实现对话和工具调用 |
| `src/types.ts` | Agent 相关类型定义 |
| `src/config.ts` | 配置文件加载和解析 (.agent-stack.json) |
| `src/cli.ts` | 命令式 CLI，支持 chat/run/tools/config 命令 |

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
    "commander": "^12.1.0"
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
| `src/client.ts` | MCPClientManager 管理多个 MCP 连接 |
| `src/bridge.ts` | 将 MCP 工具转换为 Agent Tool 接口 |
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
| `src/manager.ts` | SkillManager 管理 Skill 生命周期 |
| `src/bridge.ts` | 将 Skill 工具转换为 Agent Tool 接口 |
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
│   │   ├── base.ts            # SQLiteStore 基类
│   │   ├── event.ts           # EventStore (事件存储)
│   │   ├── task-state.ts      # TaskStateStore (任务状态)
│   │   ├── summary.ts         # SummaryStore (摘要)
│   │   ├── profile.ts         # ProfileStore (用户偏好)
│   │   └── semantic.ts        # SemanticStore (语义检索)
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
| `src/stores/base.ts` | SQLite 基类，提供连接管理 |
| `src/stores/event.ts` | 事件日志存储 (CRUD, 批量操作, 查询) |
| `src/stores/task-state.ts` | 任务状态存储 (幂等更新, 版本控制, 快照) |
| `src/stores/summary.ts` | 对话摘要存储 |
| `src/stores/profile.ts` | 用户偏好存储 (跨会话持久化) |
| `src/stores/semantic.ts` | 语义检索 (FTS5 + 向量搜索) |
| `src/manager.ts` | MemoryManager 主类，协调所有组件 |
| `src/observer.ts` | 事件创建辅助函数 |
| `src/retriever.ts` | 多路召回和优先级排序 |
| `src/injector.ts` | 模板引擎，将记忆注入 Prompt |
| `src/budgeter.ts` | Token 预算分配和管理 |
| `src/write-policy.ts` | 写入决策和冲突解决 |
| `src/summarizer.ts` | 摘要生成和合并 |
| `src/state-reducer.ts` | 不可变任务状态更新 |

### 6.3 五层记忆架构

| 层级 | 存储类 | 用途 | 优先级 |
|------|--------|------|--------|
| Profile | `ProfileStore` | 用户偏好 (语言/格式/禁忌) | 1 (最高) |
| TaskState | `TaskStateStore` | 当前任务状态 (目标/计划/进度) | 2 |
| Summary | `SummaryStore` | 滚动摘要 (决策/结论/下一步) | 3 |
| Episodic | `EventStore` | 事件日志 (对话/工具/决策) | 4 |
| Semantic | `SemanticStore` | 可检索材料 (全文/向量) | 5 (最低) |

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

## 7. Rush 配置目录

### 7.1 common/config/rush/

```
common/config/rush/
├── .npmrc                     # npm 配置
├── command-line.json          # 自定义命令
├── common-versions.json       # 共享版本
├── pnpm-config.json          # pnpm 配置
├── pnpm-lock.yaml            # 依赖锁文件
└── ... (其他 Rush 配置)
```

### 7.2 common/scripts/

```
common/scripts/
├── install-run.js            # 通用安装运行脚本
├── install-run-rush.js       # Rush 安装运行脚本
├── install-run-rushx.js      # Rushx 安装运行脚本
└── install-run-rush-pnpm.js  # pnpm 安装运行脚本
```

---

## 8. 开发工具配置

### 8.1 .claude/ 目录

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

### 8.2 .ttadk/ 目录

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

## 9. 构建输出

### 9.1 dist/ 目录结构

每个包的 `dist/` 目录输出：

```
dist/
├── index.js           # CommonJS 入口
├── index.mjs          # ESM 入口
├── index.d.ts         # TypeScript 类型声明
├── index.d.mts        # ESM 类型声明
└── index.js.map       # Source Map
```

### 9.2 构建命令

```bash
# 单包构建
rushx build

# 全量构建
rush build

# 重新构建
rush rebuild
```
