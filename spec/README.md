# Agent Stack 项目文档

## 项目概述

Agent Stack 是一个基于 TypeScript 的 AI Agent 开发框架，采用 Rush monorepo 架构管理多个包。项目旨在提供一个简洁、易用的 OpenAI API 封装、MCP 协议支持、Skill 系统、Memory 系统和 AI Agent 实现。

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
| MCP SDK | @modelcontextprotocol/sdk | ^1.0.0 |
| 数据库 | better-sqlite3 | ^11.7.0 |
| 向量搜索 | sqlite-vec | ^0.1.6 |

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
agent-stack/
├── packages/                    # 子包目录
│   ├── provider/               # @agent-stack/provider - OpenAI API 封装
│   │   └── src/
│   │       ├── index.ts
│   │       └── openai/
│   │
│   ├── mcp/                    # @agent-stack/mcp - MCP 协议支持
│   │   └── src/
│   │       ├── index.ts       # 入口文件
│   │       ├── types.ts       # 类型定义
│   │       ├── config.ts      # 配置加载
│   │       ├── transport.ts   # 传输层
│   │       ├── client.ts      # MCPClientManager
│   │       ├── bridge.ts      # 工具桥接
│   │       └── helpers.ts     # 辅助函数
│   │
│   ├── skill/                  # @agent-stack/skill - Skill 系统
│   │   └── src/
│   │       ├── index.ts       # 入口文件
│   │       ├── types.ts       # 类型定义
│   │       ├── config.ts      # 配置加载
│   │       ├── loader.ts      # Skill 加载器
│   │       ├── manager.ts     # SkillManager
│   │       ├── bridge.ts      # 工具桥接
│   │       └── helpers.ts     # 辅助函数
│   │
│   ├── memory/                 # @agent-stack/memory - Memory 系统
│   │   └── src/
│   │       ├── index.ts       # 入口文件
│   │       ├── types.ts       # 类型定义
│   │       ├── errors.ts      # 错误类
│   │       ├── manager.ts     # MemoryManager
│   │       ├── stores/        # 存储层 (Event/TaskState/Summary/Profile/Semantic)
│   │       ├── observer.ts    # 事件采集
│   │       ├── retriever.ts   # 多路召回
│   │       ├── injector.ts    # 模板注入
│   │       ├── budgeter.ts    # Token 预算
│   │       ├── write-policy.ts # 写入策略
│   │       └── summarizer.ts  # 摘要生成
│   │
│   └── index/                  # @agent-stack/index - Agent 实现 + CLI
│       └── src/
│           ├── index.ts       # 包入口
│           ├── agent.ts       # Agent 核心类
│           ├── types.ts       # 类型定义
│           ├── config.ts      # 配置文件加载
│           └── cli.ts         # 命令行工具
│
├── examples/                   # 示例配置
│   ├── .agent-stack.json      # Agent 配置示例
│   ├── .mcp.json              # MCP 配置示例
│   └── skills/                # 示例 Skills
│       ├── file-skill/        # 文件操作
│       ├── shell-skill/       # Shell 命令
│       └── search-skill/      # 文件搜索
│
├── common/                     # Rush 公共配置
├── .github/workflows/          # CI/CD 配置
├── .mcp.json                   # MCP 服务器配置
├── rush.json                   # Rush 主配置
└── spec/                       # 项目文档
```

---

## 包依赖关系

```
@agent-stack/provider  (OpenAI API 封装)
        │
        └── openai (^4.77.0)

@agent-stack/mcp       (MCP 协议支持)
        │
        └── @modelcontextprotocol/sdk (^1.0.0)

@agent-stack/skill     (Skill 系统)
        │
        └── (无外部依赖)

@agent-stack/memory    (Memory 系统)
        │
        ├── better-sqlite3 (^11.7.0)
        └── sqlite-vec (^0.1.6)

@agent-stack/index     (Agent 实现 + CLI，内置 MCP、Skill 和 Memory 支持)
        │
        ├── @agent-stack/provider (workspace:*)
        ├── @agent-stack/mcp (workspace:*)
        ├── @agent-stack/skill (workspace:*)
        ├── @agent-stack/memory (workspace:*)
        └── commander (^12.1.0) - CLI 框架
```

---

## 详细文档

- [技术栈详解](./tech-stack.md)
- [项目结构详解](./project-structure.md)
- [业务逻辑详解](./business-logic.md)
- [API 参考](./api-reference.md)
