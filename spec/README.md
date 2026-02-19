# AI Stack 项目文档

## 项目概述

AI Stack 是一个基于 TypeScript 的 AI Agent 开发框架，采用 Rush monorepo 架构管理多个包。项目旨在提供一个简洁、易用的多模型 LLM 抽象层（支持 OpenAI、Anthropic Claude、Google Gemini 和 OpenAI 兼容 API）、MCP 协议支持、Skill 系统、Memory 系统、Knowledge 知识库系统、权限管控系统和 AI Agent 实现。

### 设计理念

项目采用**函数式编程风格**，使用工厂函数替代传统类：

- **工厂函数**: `createXxx()` 替代 `new Xxx()`
- **闭包封装**: 私有状态通过闭包隐藏
- **组合优于继承**: 共享功能通过组合实现
- **类型安全**: 返回 `XxxInstance` 接口类型

---

## 技术栈

### 核心技术

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | ~5.7.2 |
| 运行时 | Node.js | >=20.0.0 <23.0.0 |
| 包管理 | pnpm | 9.15.9 |
| Monorepo 工具 | Rush | 5.165.0 |
| 构建工具 | tsup | ^8.3.5 |
| AI SDK | openai | ^4.77.0 |
| AI SDK (可选) | @anthropic-ai/sdk | ^0.39.0 |
| AI SDK (可选) | @google/generative-ai | ^0.21.0 |
| MCP SDK | @modelcontextprotocol/sdk | ^1.0.0 |
| 数据库 | better-sqlite3 | ^11.7.0 |
| 向量搜索 | sqlite-vec | ^0.1.6 |
| 配置校验 | zod | ^3.24.0 |

### 开发依赖

- `@types/node`: ^22.10.0 - Node.js 类型定义
- `rimraf`: ^6.0.1 - 跨平台文件删除工具

### 构建配置

- **模块格式**: CJS + ESM 双格式输出
- **类型声明**: 自动生成 `.d.ts` 文件
- **Source Map**: 启用
- **Tree Shaking**: 启用

---

## 项目结构

```
ai-stack/
├── packages/                    # 所有包目录
│   ├── libs/                   # 核心业务库 (@ai-stack/*)
│   │   ├── provider/           # @ai-stack/provider - 多模型 LLM 抽象层
│   │   ├── mcp/                # @ai-stack/mcp - MCP 协议支持
│   │   ├── skill/              # @ai-stack/skill - Skill 系统
│   │   ├── memory/             # @ai-stack/memory - Memory 策略层
│   │   ├── memory-store-sqlite/# @ai-stack/memory-store-sqlite - SQLite 存储
│   │   ├── memory-store-json/  # @ai-stack/memory-store-json - JSON 存储
│   │   ├── knowledge/          # @ai-stack/knowledge - 代码和文档索引
│   │   ├── agent/              # @ai-stack/agent - Agent 实现 + CLI
│   │   ├── assistant/          # @ai-stack/assistant - 个人 AI 助手
│   │   └── code/               # @ai-stack/code - 代码编辑 Agent
│   │
│   ├── skills/                 # 自定义 Skills (@ai-stack-skill/*)
│   │   ├── memory/             # @ai-stack-skill/memory - Memory Skill
│   │   └── knowledge/          # @ai-stack-skill/knowledge - Knowledge Skill
│   │
│   └── mcp-servers/            # 自定义 MCP 服务器 (@ai-stack-mcp/*)
│       ├── fetch/              # @ai-stack-mcp/fetch - Web 内容获取
│       ├── time/               # @ai-stack-mcp/time - 时间和时区转换
│       ├── git/                # @ai-stack-mcp/git - Git 仓库操作
│       ├── bash/               # @ai-stack-mcp/bash - Bash 命令执行
│       └── lsp/                # @ai-stack-mcp/lsp - LSP 代码智能
│
├── packages/examples/           # 示例项目
│   ├── agent/                  # @ai-stack-example/agent - Agent 示例
│   │   ├── agent.json          # Agent 配置
│   │   ├── mcp.json            # MCP 配置
│   │   └── skills/             # 示例 Skills
│   ├── assistant/              # @ai-stack-example/assistant - Assistant 示例
│   │   ├── assistant.json      # Assistant 配置
│   │   ├── mcp.json            # MCP 配置
│   │   └── MEMORY.md           # 记忆文件
│   └── code/                   # @ai-stack-example/code - Code Agent 示例
│       ├── code.json           # Code Agent 配置
│       └── mcp.json            # MCP 配置 (bash, git, lsp)
│
├── common/                      # Rush 公共配置
├── .github/workflows/           # CI/CD 配置
├── .mcp.json                    # MCP 服务器配置
├── rush.json                    # Rush 主配置
└── spec/                        # 项目文档
```

---

## 包依赖关系

```
@ai-stack/provider  (多模型 LLM 抽象层)
        │
        ├── openai (^4.77.0)
        ├── @anthropic-ai/sdk (^0.39.0) [可选]
        └── @google/generative-ai (^0.21.0) [可选]

@ai-stack/mcp       (MCP 协议支持)
        │
        └── @modelcontextprotocol/sdk (^1.0.0)

@ai-stack/skill     (Skill 系统)
        │
        └── (无外部依赖)

@ai-stack/memory-store-sqlite (SQLite 存储层)
        │
        ├── better-sqlite3 (^11.7.0)
        └── sqlite-vec (^0.1.6)

@ai-stack/memory-store-json (JSON 存储层)
        │
        └── @ai-stack/memory-store-sqlite (workspace:*) - 类型定义

@ai-stack/memory    (策略层 - 接受注入的 stores)
        │
        └── @ai-stack/memory-store-sqlite (workspace:*) - 类型定义

@ai-stack-skill/memory (Memory Skill)
        │
        └── @ai-stack/memory-store-sqlite (workspace:*)

@ai-stack/knowledge (代码和文档索引，复用 memory-store-sqlite 的 SQLite/sqlite-vec)
        │
        ├── @ai-stack/memory-store-sqlite (workspace:*) - 提供 createDatabase(), SemanticStore
        ├── @ai-stack/memory (workspace:*)
        ├── node-html-markdown (^1.3.0)
        ├── glob (^11.0.0)
        └── chokidar (^4.0.0)

@ai-stack-skill/knowledge (Knowledge Skill)
        │
        ├── @ai-stack/knowledge (workspace:*)
        └── @ai-stack/memory-store-sqlite (workspace:*)

@ai-stack/agent     (Agent 实现 + CLI，内置 MCP、Skill、Memory、Knowledge 和 Permission 支持)
        │
        ├── @ai-stack/provider (workspace:*)
        ├── @ai-stack/mcp (workspace:*)
        ├── @ai-stack/skill (workspace:*)
        ├── @ai-stack/memory (workspace:*)
        ├── @ai-stack/knowledge (workspace:*)
        ├── commander (^12.1.0) - CLI 框架
        └── zod (^3.24.0) - 配置校验

@ai-stack/assistant (个人 AI 助手，Markdown 记忆 + 多通道 + 调度)
        │
        ├── @ai-stack/agent (workspace:*)
        ├── @ai-stack/memory (workspace:*)
        ├── @ai-stack/memory-store-sqlite (workspace:*)
        ├── commander (^12.1.0) - CLI 框架
        ├── chokidar (^4.0.0) - 文件监听
        ├── cron-parser (^4.9.0) - Cron 表达式解析
        ├── gray-matter (^4.0.3) - Markdown frontmatter 解析
        └── (可选) telegraf, discord.js - 消息平台适配器

@ai-stack/code      (代码编辑 Agent，文件操作 + 搜索 + Undo/Redo)
        │
        ├── @ai-stack/agent (workspace:*)
        ├── @ai-stack/mcp (workspace:*)
        ├── @ai-stack/provider (workspace:*)
        ├── better-sqlite3 (^11.7.0)
        ├── commander (^12.1.0) - CLI 框架
        ├── diff (^7.0.0) - Diff 计算
        ├── glob (^11.0.0) - 文件模式匹配
        ├── picomatch (^4.0.0) - 路径匹配
        └── zod (^3.23.0) - 配置校验

@ai-stack-mcp/bash  (Bash 命令执行 MCP 服务器)
        │
        ├── @modelcontextprotocol/sdk (^1.0.0)
        └── zod (^3.24.0)

@ai-stack-mcp/lsp   (语言服务器协议 MCP 服务器)
        │
        ├── @modelcontextprotocol/sdk (^1.0.0)
        ├── vscode-jsonrpc (^8.2.0)
        ├── vscode-languageserver-protocol (^3.17.5)
        └── zod (^3.24.0)
```

---

## 核心功能

| 功能 | 描述 |
|------|------|
| **Provider** | 多模型 LLM 封装，支持 OpenAI、Anthropic、Google Gemini 和 OpenAI 兼容 API |
| **MCP** | Model Context Protocol 支持，连接外部工具服务器 |
| **Skill** | 本地技能系统，动态加载和执行工具 |
| **Memory** | 五层记忆架构，持久化对话和任务状态 |
| **Knowledge** | 代码库和文档索引，混合搜索 (FTS + Vector) |
| **Permission** | 权限管控系统，工具执行前确认和审计 |
| **Assistant** | 个人 AI 助手，Markdown 记忆 + 多通道网关 + 调度器 |
| **Code Agent** | 代码编辑 Agent，文件操作 + 搜索 + Undo/Redo + 任务管理 |
| **Error Handling** | 统一错误处理系统，可恢复错误自动重试 |
| **Telemetry** | 可观测性系统，工具/LLM 调用事件追踪 |
| **Parallel Tools** | 并行工具执行，可配置并发数和超时 |
| **Config Validation** | Zod Schema 配置校验，友好错误提示 |

---

## 详细文档

- [技术栈详解](./tech-stack.md)
- [项目结构详解](./project-structure.md)
- [业务逻辑详解](./business-logic.md)
- [API 参考](./api-reference.md)
- [Knowledge 设计文档](./knowledge-design.md)
