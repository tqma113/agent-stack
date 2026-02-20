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

### 2.7 @ai-stack/knowledge

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
├── memory/                     # Memory 数据
├── knowledge/                  # Knowledge 数据
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
├── MEMORY.md                   # Markdown 记忆
└── README.md
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
├── .ai-code/                   # 数据目录
│   ├── history.db
│   └── tasks.db
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
