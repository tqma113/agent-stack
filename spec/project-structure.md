# 项目结构详解

本文档详细说明 AI Stack 的目录结构、包组织和文件职责。

---

## 1. 目录总览

```
ai-stack/
├── packages/                    # 所有包目录
│   ├── libs/                   # 核心库 (@ai-stack/*)
│   ├── skills/                 # 技能包 (@ai-stack-skill/*)
│   ├── mcp-servers/            # MCP 服务器 (@ai-stack-mcp/*)
│   ├── examples/               # 示例项目 (@ai-stack-example/*)
│   └── config/                 # 共享配置
│
├── common/                     # Rush 公共目录
│   ├── config/rush/            # Rush 配置文件
│   ├── scripts/                # Rush 脚本
│   └── temp/                   # 临时文件
│
├── spec/                       # 项目文档
├── .claude/                    # Claude Code 配置
├── .ttadk/                     # TTADK 插件
├── .github/                    # GitHub 配置
├── .mcp.json                   # MCP 服务器配置
├── rush.json                   # Rush 主配置
└── CLAUDE.md                   # Claude Code 指令
```

---

## 2. 核心库 (packages/libs/)

### 2.1 @ai-stack/provider

多模型 LLM 抽象层。

```
packages/libs/provider/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 统一类型定义
│   ├── factory.ts              # createProvider() 工厂
│   ├── openai/                 # OpenAI 适配器
│   │   ├── index.ts
│   │   ├── client.ts           # OpenAI 客户端
│   │   ├── types.ts
│   │   └── helpers.ts          # 消息构建辅助函数
│   ├── anthropic/              # Anthropic 适配器
│   │   ├── index.ts
│   │   ├── client.ts
│   │   └── types.ts
│   └── google/                 # Google 适配器
│       ├── index.ts
│       ├── client.ts
│       └── types.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `openai` (默认)
- `@anthropic-ai/sdk` (可选)
- `@google/generative-ai` (可选)

---

### 2.2 @ai-stack/mcp

MCP 协议支持。

```
packages/libs/mcp/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 配置加载
│   ├── transport.ts            # 传输层工厂
│   ├── client.ts               # MCPClientManager
│   ├── bridge.ts               # MCPToolProvider
│   └── helpers.ts              # 辅助函数
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `@modelcontextprotocol/sdk`
- `json5`

---

### 2.3 @ai-stack/skill

技能系统。

```
packages/libs/skill/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 配置加载
│   ├── loader.ts               # Skill 加载器
│   ├── manager.ts              # SkillManager
│   ├── bridge.ts               # SkillToolProvider
│   └── helpers.ts              # 辅助函数
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：无外部依赖

---

### 2.4 @ai-stack/memory-store-sqlite

SQLite 存储层。

```
packages/libs/memory-store-sqlite/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── errors.ts               # 错误类
│   ├── factory.ts              # createSqliteStores()
│   └── stores/
│       ├── index.ts
│       ├── db-operations.ts    # 数据库操作
│       ├── event.ts            # EventStore
│       ├── task-state.ts       # TaskStateStore
│       ├── summary.ts          # SummaryStore
│       ├── profile.ts          # ProfileStore
│       ├── semantic.ts         # SemanticStore
│       └── embedding-cache.ts  # EmbeddingCache
├── tests/
│   └── stores/
│       ├── event.test.ts
│       ├── task-state.test.ts
│       ├── summary.test.ts
│       ├── profile.test.ts
│       ├── semantic.test.ts
│       └── embedding-cache.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

**依赖**：
- `better-sqlite3`
- `sqlite-vec`

---

### 2.5 @ai-stack/memory-store-json

JSON 轻量存储。

```
packages/libs/memory-store-json/
├── src/
│   ├── index.ts                # 包入口
│   ├── factory.ts              # createJsonStores()
│   ├── utils/
│   │   └── file-ops.ts         # 文件操作
│   └── stores/
│       ├── index.ts
│       ├── event.ts            # JSON 事件存储
│       ├── task-state.ts
│       ├── summary.ts          # JSON + Markdown
│       ├── profile.ts
│       └── semantic.ts         # 倒排索引
├── tests/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**存储格式**：
```
.ai-stack/memory/
├── events/{sessionId}/events.json
├── tasks/{taskId}.json
├── profiles/profiles.json
├── summaries/{sessionId}/
│   ├── summaries.json
│   └── latest.md
└── semantic/
    ├── chunks.json
    └── index.json
```

**依赖**：
- `@ai-stack/memory-store-sqlite` (仅类型)

---

### 2.6 @ai-stack/memory

记忆策略层。

```
packages/libs/memory/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── errors.ts               # 错误类
│   ├── stores-interface.ts     # 聚合接口
│   │
│   ├── policy/                 # 策略层
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── memory-policy.ts    # 主策略
│   │   ├── retrieval-policy.ts # 检索策略
│   │   ├── write-policy.ts     # 写入策略
│   │   └── budget-policy.ts    # Token 预算
│   │
│   ├── rules/                  # 规则引擎
│   │   ├── index.ts
│   │   ├── rule-engine.ts
│   │   └── default-rules.ts
│   │
│   ├── ranking/                # 搜索排序
│   │   ├── index.ts
│   │   ├── temporal-decay.ts   # 时间衰减
│   │   ├── mmr.ts              # MMR 去重
│   │   └── pipeline.ts         # 组合管道
│   │
│   ├── compaction/             # 上下文压缩
│   │   ├── index.ts
│   │   ├── memory-flush.ts
│   │   └── compaction-manager.ts
│   │
│   ├── transcript/             # 会话转录
│   │   ├── index.ts
│   │   ├── session-transcript.ts
│   │   └── transcript-indexer.ts
│   │
│   ├── pipeline/               # 读写管道
│   │   ├── index.ts
│   │   └── memory-pipeline.ts
│   │
│   ├── observer.ts             # 事件观察
│   ├── injector.ts             # 上下文注入
│   ├── summarizer.ts           # 摘要生成
│   ├── retriever.ts            # 检索器
│   ├── budgeter.ts             # 预算管理
│   └── state-reducer.ts        # 任务状态
│
├── tests/
│   ├── state-reducer.test.ts
│   ├── write-policy.test.ts
│   ├── ranking/
│   ├── compaction/
│   ├── transcript/
│   ├── pipeline/
│   └── integration/
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

**依赖**：
- `@ai-stack/memory-store-sqlite` (类型)

---

### 2.7 @ai-stack/tree-index

树形层级索引。

```
packages/libs/tree-index/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── errors.ts               # 错误类
│   ├── tree-store.ts           # 树存储 (SQLite)
│   │
│   ├── builders/               # 树构建器
│   │   ├── index.ts
│   │   ├── code-tree-builder.ts    # 代码树构建
│   │   ├── doc-tree-builder.ts     # 文档树构建
│   │   ├── event-tree-builder.ts   # 事件树构建
│   │   └── task-tree-builder.ts    # 任务树构建
│   │
│   ├── search/                 # 树感知搜索
│   │   ├── index.ts
│   │   ├── tree-search.ts      # 子树搜索
│   │   └── tree-filter.ts      # 结果过滤
│   │
│   └── utils/                  # 工具函数
│       ├── index.ts
│       ├── path-utils.ts       # 路径工具
│       └── closure-utils.ts    # 闭包表工具
│
├── tests/
│   ├── tree-store.test.ts
│   ├── path-utils.test.ts
│   └── builders.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

**依赖**：
- `@ai-stack/memory-store-sqlite`
- `better-sqlite3`

**核心功能**：
- Closure Table + Path Enumeration 混合架构
- O(1) 祖先/后代查询
- 四种树类型：code, doc, event, task
- 与 SemanticStore 双向链接
- 树感知搜索和子树过滤

---

### 2.8 @ai-stack/knowledge

知识索引。

```
packages/libs/knowledge/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── errors.ts               # 错误类
│   ├── manager.ts              # KnowledgeManager
│   │
│   ├── stores/                 # 持久化存储
│   │   ├── index.ts
│   │   ├── code-index-store.ts # 代码索引状态
│   │   └── doc-registry-store.ts # 文档注册表
│   │
│   ├── code/                   # 代码索引
│   │   ├── index.ts
│   │   ├── indexer.ts          # CodeIndexer
│   │   ├── chunker.ts          # 代码切分
│   │   ├── watcher.ts          # 文件监听
│   │   └── languages/
│   │       ├── index.ts
│   │       ├── typescript.ts
│   │       └── generic.ts
│   │
│   ├── doc/                    # 文档索引
│   │   ├── index.ts
│   │   ├── indexer.ts          # DocIndexer
│   │   ├── crawler.ts          # URL 爬取
│   │   ├── parser.ts           # HTML 解析
│   │   └── registry.ts         # 文档源管理
│   │
│   └── retriever/              # 统一检索
│       ├── index.ts
│       └── hybrid-search.ts
│
├── tests/
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `@ai-stack/memory-store-sqlite`
- `@ai-stack/memory`
- `node-html-markdown`
- `glob`
- `chokidar`

---

### 2.8 @ai-stack/tui

终端 UI 组件。

```
packages/libs/tui/
├── src/
│   ├── index.ts                # 包入口
│   │
│   ├── core/                   # 非 React 核心
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── colors.ts           # 主题颜色
│   │   ├── terminal.ts         # 终端检测
│   │   ├── spinner.ts          # 加载动画
│   │   ├── diff.ts             # Diff 计算
│   │   ├── render.ts           # 渲染工具
│   │   └── stream.ts           # 流式输出
│   │
│   ├── components/             # Ink 组件
│   │   ├── index.ts
│   │   ├── layout/
│   │   │   ├── Panel.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Divider.tsx
│   │   ├── display/
│   │   │   ├── Message.tsx
│   │   │   ├── ToolCall.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── StatusSpinner.tsx
│   │   ├── input/
│   │   │   ├── Confirm.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── TextInput.tsx
│   │   │   └── CommandPalette.tsx
│   │   └── code/
│   │       ├── DiffView.tsx
│   │       ├── TaskBoard.tsx
│   │       └── HistoryBrowser.tsx
│   │
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── useTheme.ts
│   │   ├── useInput.ts
│   │   └── useStreaming.ts
│   │
│   ├── theme/
│   │   ├── types.ts
│   │   ├── default.ts
│   │   └── provider.tsx
│   │
│   └── adapters/               # 环境适配
│       ├── index.ts
│       ├── detect.ts
│       ├── tty.ts
│       └── classic.ts
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `ink`, `@inkjs/ui`
- `chalk`, `boxen`, `ora`
- `diff`
- `react`

---

### 2.9 @ai-stack/agent

Agent 核心实现。

```
packages/libs/agent/
├── src/
│   ├── index.ts                # 包入口
│   ├── types.ts                # 类型定义
│   ├── agent.ts                # createAgent()
│   ├── config.ts               # 配置加载
│   ├── cli.ts                  # CLI 入口
│   │
│   ├── tools/                  # 工具系统
│   │   ├── index.ts
│   │   ├── description.ts      # 工具文档生成
│   │   ├── executor.ts         # 工具执行器
│   │   └── builtin/            # 内置工具
│   │       └── ask-user.ts
│   │
│   ├── permission/             # 权限管控
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── policy.ts
│   │
│   ├── orchestration/          # 编排层
│   │   ├── index.ts
│   │   ├── state-machine.ts    # 状态机
│   │   ├── recovery.ts         # 恢复策略
│   │   ├── plan-dag.ts         # 计划 DAG
│   │   └── planner.ts          # 规划器
│   │
│   ├── evaluation/             # 评估层
│   │   ├── index.ts
│   │   └── evaluator.ts
│   │
│   ├── routing/                # 模型路由
│   │   ├── index.ts
│   │   └── router.ts
│   │
│   ├── observability/          # 可观测性
│   │   ├── index.ts
│   │   └── metrics.ts
│   │
│   ├── guardrail/              # 安全检查
│   │   ├── index.ts
│   │   ├── guardrail.ts
│   │   └── rules/
│   │       ├── pii.ts
│   │       ├── secrets.ts
│   │       ├── dangerous.ts
│   │       └── injection.ts
│   │
│   ├── sub-agent/              # 子 Agent
│   │   ├── index.ts
│   │   └── manager.ts
│   │
│   └── ui/                     # UI 辅助
│       ├── index.ts
│       ├── colors.ts
│       ├── spinner.ts
│       ├── stream.ts
│       ├── message.ts
│       ├── layout.ts
│       └── box.ts
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `@ai-stack/provider`
- `@ai-stack/mcp`
- `@ai-stack/skill`
- `@ai-stack/memory`
- `@ai-stack/knowledge`
- `@ai-stack/tui`
- `commander`
- `zod`

---

### 2.10 @ai-stack/assistant

个人 AI 助手。

```
packages/libs/assistant/
├── src/
│   ├── index.ts                # 包入口
│   ├── cli.ts                  # CLI 入口
│   ├── types.ts                # 类型定义
│   ├── config.ts               # 配置加载
│   │
│   ├── assistant/              # 核心助手
│   │   ├── index.ts
│   │   └── assistant.ts
│   │
│   ├── memory/                 # Markdown Memory
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── markdown-memory.ts
│   │   ├── markdown-parser.ts
│   │   ├── markdown-writer.ts
│   │   ├── sqlite-index.ts     # 派生索引
│   │   └── sync-engine.ts
│   │
│   ├── gateway/                # 多通道网关
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── gateway.ts
│   │   ├── router.ts
│   │   ├── session.ts
│   │   └── adapters/
│   │       ├── index.ts
│   │       ├── base.ts
│   │       ├── cli.ts
│   │       ├── telegram.ts
│   │       └── discord.ts
│   │
│   ├── scheduler/              # 调度器
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── scheduler.ts
│   │   ├── cron-job.ts
│   │   ├── reminder.ts
│   │   ├── watcher.ts
│   │   └── task-queue.ts
│   │
│   └── daemon/                 # 守护进程
│       ├── index.ts
│       ├── types.ts
│       └── daemon.ts
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `@ai-stack/agent`
- `@ai-stack/memory`
- `@ai-stack/memory-store-sqlite`
- `@ai-stack/tui`
- `chokidar`
- `cron-parser`
- `gray-matter`
- `telegraf` (可选)
- `discord.js` (可选)

---

### 2.11 @ai-stack/code

代码编辑 Agent。

```
packages/libs/code/
├── src/
│   ├── index.ts                # 包入口
│   ├── cli.ts                  # CLI 入口
│   ├── types.ts                # 类型定义
│   ├── errors.ts               # 错误类
│   ├── config.ts               # 配置加载
│   ├── config-schema.ts        # Zod Schema
│   │
│   ├── code-agent/             # 核心 Agent
│   │   ├── index.ts
│   │   └── code-agent.ts
│   │
│   ├── tools/                  # 内置工具
│   │   ├── index.ts
│   │   ├── read.ts             # Read 工具
│   │   ├── write.ts            # Write 工具
│   │   ├── edit.ts             # Edit 工具
│   │   ├── glob.ts             # Glob 工具
│   │   ├── grep.ts             # Grep 工具
│   │   ├── undo.ts             # Undo 工具
│   │   ├── redo.ts             # Redo 工具
│   │   └── task.ts             # Task 工具
│   │
│   ├── file-history/           # Undo/Redo 系统
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── store.ts            # SQLite 存储
│   │   └── diff-engine.ts
│   │
│   ├── task/                   # 任务管理
│   │   ├── index.ts
│   │   └── store.ts
│   │
│   ├── safety/                 # 安全控制
│   │   ├── index.ts
│   │   ├── path-validator.ts   # 路径验证
│   │   └── content-validator.ts # 内容验证
│   │
│   └── prompts/
│       └── code-prompt.ts
│
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**依赖**：
- `@ai-stack/agent`
- `@ai-stack/mcp`
- `@ai-stack/provider`
- `@ai-stack/tui`
- `better-sqlite3`
- `diff`
- `glob`
- `picomatch`
- `zod`

---

## 3. 技能包 (packages/skills/)

### 3.1 @ai-stack-skill/memory

```
packages/skills/memory/
├── skill.json                  # Skill 定义
├── handlers.cjs                # 编译后处理函数
├── src/
│   ├── handlers.ts             # search/upsert/delete
│   ├── schema.ts               # JSON Schema
│   └── store-context.ts        # 数据库连接
├── tests/
│   └── schema.test.ts
├── scripts/
│   └── copy-handlers.js
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `search` - 搜索记忆
- `upsert` - 创建/更新
- `delete` - 删除

---

### 3.2 @ai-stack-skill/knowledge

```
packages/skills/knowledge/
├── skill.json
├── handlers.cjs
├── src/
│   ├── handlers.ts
│   └── store-context.ts
├── scripts/
│   └── copy-handlers.js
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `search_code` - 搜索代码
- `search_docs` - 搜索文档
- `index_code` - 索引代码库
- `add_doc_source` - 添加文档源
- `crawl_docs` - 爬取文档
- `get_knowledge_stats` - 获取统计

---

## 4. MCP 服务器 (packages/mcp-servers/)

### 4.1 @ai-stack-mcp/time

时间和时区转换。

```
packages/mcp-servers/time/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── timezone.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `get_current_time` - 获取当前时间
- `convert_time` - 时区转换

---

### 4.2 @ai-stack-mcp/fetch

Web 内容获取。

```
packages/mcp-servers/fetch/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── fetcher.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `fetch_url` - 获取 URL 内容 (转 Markdown)

---

### 4.3 @ai-stack-mcp/git

Git 仓库操作。

```
packages/mcp-servers/git/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── git-operations.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `git_status` - 工作区状态
- `git_diff_unstaged` - 未暂存差异
- `git_diff_staged` - 已暂存差异
- `git_diff` - 分支比较
- `git_commit` - 提交
- `git_add` - 暂存
- `git_reset` - 取消暂存
- `git_log` - 提交历史
- `git_create_branch` - 创建分支
- `git_checkout` - 切换分支
- `git_show` - 显示提交
- `git_branch` - 列出分支

---

### 4.4 @ai-stack-mcp/bash

Shell 命令执行。

```
packages/mcp-servers/bash/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── bash-operations.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `bash_execute` - 执行命令
- `bash_script` - 执行脚本
- `bash_background` - 后台进程
- `bash_kill` - 终止进程
- `bash_processes` - 列出进程
- `bash_read_output` - 读取输出
- `bash_which` - 查找命令
- `bash_env` - 环境变量
- `bash_pwd` - 当前目录
- `bash_cd` - 切换目录

---

### 4.5 @ai-stack-mcp/lsp

语言服务器协议。

```
packages/mcp-servers/lsp/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── language-client.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**工具**：
- `lsp_get_diagnostics` - 诊断信息
- `lsp_go_to_definition` - 定义跳转
- `lsp_find_references` - 引用查找
- `lsp_get_completions` - 代码补全
- `lsp_get_hover` - 悬停信息
- `lsp_get_document_symbols` - 文档符号
- `lsp_get_workspace_symbols` - 工作区符号
- `lsp_format_document` - 格式化
- `lsp_rename_symbol` - 重命名
- `lsp_get_code_actions` - 代码操作
- `lsp_start_server` - 启动服务器
- `lsp_stop_server` - 停止服务器
- `lsp_list_servers` - 列出服务器

---

### 4.6 @ai-stack-mcp/electron-cdp

Chrome DevTools 集成。

```
packages/mcp-servers/electron-cdp/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── cdp-client.ts
│   ├── server.ts
│   └── cli.ts
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## 5. 示例项目 (packages/examples/)

### 5.1 @ai-stack-example/agent

```
packages/examples/agent/
├── package.json
├── agent.json                  # Agent 配置
├── mcp.json                    # MCP 配置
├── skills/                     # 自定义 Skill
│   └── search-skill/
├── .ai-stack/                  # 数据目录
│   ├── memory/sqlite.db        # Memory 数据
│   └── knowledge/sqlite.db     # Knowledge 数据
└── README.md
```

**命令**：
```bash
pnpm start        # 交互对话
pnpm run tools    # 列出工具
```

---

### 5.2 @ai-stack-example/assistant

```
packages/examples/assistant/
├── package.json
├── assistant.json              # Assistant 配置
├── mcp.json                    # MCP 配置
└── README.md

# 数据存储于 ~/.ai-stack/ (用户目录):
~/.ai-stack/
├── memory/
│   ├── MEMORY.md               # Markdown 记忆
│   ├── sqlite.db               # 搜索索引
│   └── logs/                   # 每日日志
│       └── YYYY-MM-DD.md
└── scheduler/
    └── jobs.json               # 调度任务
```

**命令**：
```bash
pnpm start              # 交互对话
pnpm run daemon         # 守护进程
pnpm run memory:sync    # 同步记忆
pnpm run scheduler:list # 调度任务
```

---

### 5.3 @ai-stack-example/code

```
packages/examples/code/
├── package.json
├── code.json                   # Code Agent 配置
├── mcp.json                    # MCP 配置
├── .ai-stack/                  # 数据目录
│   ├── history/sqlite.db       # 文件历史
│   └── tasks/sqlite.db         # 任务管理
└── README.md
```

**命令**：
```bash
pnpm start          # 交互对话
pnpm run undo       # 撤销
pnpm run redo       # 重做
pnpm run history    # 历史
pnpm run tasks      # 任务
```

---

## 6. Rush 配置 (common/)

```
common/
├── config/rush/
│   ├── .npmrc
│   ├── command-line.json       # 自定义命令
│   ├── common-versions.json    # 共享版本
│   ├── pnpm-config.json
│   └── pnpm-lock.yaml          # 依赖锁
│
└── scripts/
    ├── install-run.js
    ├── install-run-rush.js
    ├── install-run-rushx.js
    └── install-run-rush-pnpm.js
```

---

## 7. 包命名约定

| 前缀 | 位置 | 用途 |
|------|------|------|
| `@ai-stack/*` | packages/libs/ | 核心库 |
| `@ai-stack-skill/*` | packages/skills/ | 技能包 |
| `@ai-stack-mcp/*` | packages/mcp-servers/ | MCP 服务器 |
| `@ai-stack-example/*` | packages/examples/ | 示例项目 |

---

## 8. 文件组织约定

每个包遵循统一的文件组织：

```
package-name/
├── src/
│   ├── index.ts        # 公共导出
│   ├── types.ts        # 类型定义
│   ├── errors.ts       # 错误类 (可选)
│   └── *.ts            # 实现文件
├── tests/              # 测试文件 (可选)
├── dist/               # 构建输出
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

**导入约定**：
```typescript
// 本地导入使用 .js 扩展名 (ESM)
import { foo } from './foo.js';

// Workspace 依赖
import { createAgent } from '@ai-stack/agent';
```

---

## 9. 数据存储目录结构

所有 AI Stack 应用统一使用 `.ai-stack` 作为数据存储目录名。

### 9.1 存储位置规范

| 包 | 定位 | 默认根目录 | 说明 |
|----|------|-----------|------|
| `@ai-stack/agent` | 项目级工具 | `./.ai-stack/` | 数据跟随项目 |
| `@ai-stack/code` | 项目级工具 | `./.ai-stack/` | 数据跟随项目 |
| `@ai-stack/assistant` | 个人助手 | `~/.ai-stack/` | 跨项目共享 |

### 9.2 Agent 存储结构

```
.ai-stack/                              # 项目根目录下
├── memory/
│   └── sqlite.db                       # Memory 数据库 (记忆系统)
│       ├── events                      # 事件表 - 对话历史
│       ├── profiles                    # 用户画像表
│       ├── task_states                 # 任务状态表
│       ├── summaries                   # 摘要表
│       ├── semantic_chunks             # 语义分块表
│       └── embedding_cache             # 嵌入缓存表
│
└── knowledge/
    └── sqlite.db                       # Knowledge 数据库 (知识库)
        ├── code_chunks                 # 代码分块表
        ├── code_index_state            # 代码索引状态表
        ├── doc_sources                 # 文档源注册表
        ├── doc_chunks                  # 文档分块表
        └── semantic_chunks             # 语义搜索表
```

**配置示例** (`agent.json`):
```json
{
  "memory": {
    "enabled": true,
    "dbPath": ".ai-stack/memory/sqlite.db"
  },
  "knowledge": {
    "enabled": true,
    "dbPath": ".ai-stack/knowledge/sqlite.db"
  }
}
```

### 9.3 Code 存储结构

```
.ai-stack/                              # 项目根目录下
├── history/
│   └── sqlite.db                       # 文件历史数据库 (Undo/Redo)
│       ├── changes                     # 文件变更记录表
│       │   ├── id                      # 变更 ID
│       │   ├── file_path               # 文件路径
│       │   ├── old_content             # 原内容
│       │   ├── new_content             # 新内容
│       │   ├── operation               # 操作类型 (create/modify/delete)
│       │   └── timestamp               # 时间戳
│       └── checkpoints                 # 检查点表
│
├── tasks/
│   └── sqlite.db                       # 任务管理数据库
│       ├── tasks                       # 任务表
│       │   ├── id                      # 任务 ID
│       │   ├── subject                 # 任务标题
│       │   ├── description             # 任务描述
│       │   ├── status                  # 状态 (pending/in_progress/completed)
│       │   ├── owner                   # 所有者
│       │   └── metadata                # 元数据 JSON
│       └── task_blocks                 # 任务依赖关系表
│           ├── task_id                 # 任务 ID
│           └── blocks_id               # 被阻塞的任务 ID
│
└── knowledge/                          # Agent Knowledge (新增)
    └── sqlite.db                       # 知识索引数据库
        ├── code_chunks                 # 代码分块表
        ├── code_index_state            # 代码索引状态表
        ├── doc_sources                 # 文档源注册表
        ├── doc_chunks                  # 文档分块表
        └── semantic_chunks             # 语义搜索表
```

**配置示例** (`code.json`):
```json
{
  "history": {
    "enabled": true,
    "dbPath": ".ai-stack/history/sqlite.db",
    "maxChanges": 1000
  },
  "tasks": {
    "enabled": true,
    "dbPath": ".ai-stack/tasks/sqlite.db"
  },
  "knowledge": {
    "enabled": false,
    "code": {
      "enabled": true,
      "autoIndex": false
    },
    "doc": {
      "enabled": true,
      "autoIndex": false
    }
  }
}
```

### 9.4 Assistant 存储结构

Assistant 采用**双层记忆架构**:
- **Markdown Memory** = Source of Truth（用户可编辑的事实、待办、笔记）
- **Agent Memory** = 对话记忆（自动管理的事件、摘要、语义搜索）
- **Agent Knowledge** = 知识索引（代码和文档的语义搜索）

```
~/.ai-stack/                            # 用户主目录下 (跨项目共享)
├── memory/
│   ├── MEMORY.md                       # Markdown Memory (Source of Truth)
│   │   ├── ## Profile                  # 用户画像
│   │   │   ├── Name                    # 姓名
│   │   │   ├── Timezone                # 时区
│   │   │   └── Language                # 语言
│   │   ├── ## Facts                    # 事实列表
│   │   ├── ## Todos                    # 待办事项
│   │   └── ## Notes                    # 笔记
│   │
│   ├── markdown-index.db               # Markdown 派生索引数据库 (用于搜索)
│   │   ├── facts                       # 事实索引表
│   │   ├── todos                       # 待办索引表
│   │   ├── notes                       # 笔记索引表
│   │   └── log_entries                 # 日志条目索引表
│   │
│   ├── agent.db                        # Agent Memory 数据库 (新增)
│   │   ├── events                      # 事件表 - 对话历史
│   │   ├── profiles                    # 用户画像表 (从 Markdown 同步)
│   │   ├── task_states                 # 任务状态表
│   │   ├── summaries                   # 摘要表
│   │   ├── semantic_chunks             # 语义分块表
│   │   └── embedding_cache             # 嵌入缓存表
│   │
│   └── logs/                           # 每日日志目录
│       ├── 2026-02-23.md               # 每日日志文件
│       │   ├── ## Conversations        # 对话记录
│       │   ├── ## Events               # 事件记录
│       │   └── ## Notes                # 当日笔记
│       ├── 2026-02-22.md
│       └── ...
│
├── knowledge/                          # Agent Knowledge (新增)
│   └── sqlite.db                       # 知识索引数据库
│       ├── code_chunks                 # 代码分块表
│       ├── code_index_state            # 代码索引状态表
│       ├── doc_sources                 # 文档源注册表
│       ├── doc_chunks                  # 文档分块表
│       └── semantic_chunks             # 语义搜索表
│
└── scheduler/
    └── jobs.json                       # 调度任务持久化文件
        ├── jobs[]                      # 任务列表
        │   ├── id                      # 任务 ID
        │   ├── name                    # 任务名称
        │   ├── schedule                # 调度配置
        │   │   ├── type                # 类型 (cron/once/interval)
        │   │   ├── cron                # Cron 表达式
        │   │   ├── runAt               # 一次性运行时间
        │   │   └── interval            # 间隔毫秒数
        │   ├── action                  # 执行动作
        │   ├── nextRun                 # 下次运行时间
        │   └── status                  # 状态 (active/paused/completed)
        └── watchers[]                  # 文件监听器列表
            ├── id                      # 监听器 ID
            ├── path                    # 监听路径
            ├── events                  # 监听事件类型
            └── action                  # 触发动作
```

**配置示例** (`assistant.json`):
```json
{
  "memory": {
    "enabled": true,
    "syncOnStartup": true,
    "watchFiles": true
  },
  "agentMemory": {
    "enabled": true,
    "syncFromMarkdown": true
  },
  "agentKnowledge": {
    "enabled": false
  },
  "scheduler": {
    "enabled": true,
    "allowAgentControl": true
  }
}
```

> **注意**: Assistant 的路径配置相对于 `baseDir`（默认 `~/.ai-stack`），通常不需要显式指定路径，使用默认值即可。启动时 Markdown Memory 会自动同步到 Agent Memory。

### 9.5 存储汇总对比

| 包 | 根目录 | 存储文件 | 格式 | 说明 |
|---|--------|----------|------|------|
| **Agent** | `./.ai-stack/` | `memory/sqlite.db` | SQLite | Memory 数据库 |
| | | `knowledge/sqlite.db` | SQLite | Knowledge 数据库 |
| **Code** | `./.ai-stack/` | `history/sqlite.db` | SQLite | 文件历史 |
| | | `tasks/sqlite.db` | SQLite | 任务管理 |
| | | `knowledge/sqlite.db` | SQLite | 知识索引 (新增) |
| **Assistant** | `~/.ai-stack/` | `memory/MEMORY.md` | Markdown | Markdown Memory |
| | | `memory/markdown-index.db` | SQLite | Markdown 派生索引 |
| | | `memory/agent.db` | SQLite | Agent Memory (新增) |
| | | `memory/logs/*.md` | Markdown | 每日日志 |
| | | `knowledge/sqlite.db` | SQLite | Agent Knowledge (新增) |
| | | `scheduler/jobs.json` | JSON | 调度任务 |

### 9.6 .gitignore 配置

项目级 `.gitignore` 应包含：

```gitignore
# AI Stack 数据目录
.ai-stack/

# 数据库文件
*.db
*.db-wal
*.db-shm
```
