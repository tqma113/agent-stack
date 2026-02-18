# Agent Stack 项目文档

## 项目概述

Agent Stack 是一个基于 TypeScript 的 AI Agent 开发框架，采用 Rush monorepo 架构管理多个包。项目旨在提供一个简洁、易用的 OpenAI API 封装、MCP 协议支持、Skill 系统、Memory 系统和 AI Agent 实现。

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
├── packages/                    # 所有包目录
│   ├── libs/                   # 核心业务库 (@agent-stack/*)
│   │   ├── provider/           # @agent-stack/provider - OpenAI API 封装
│   │   ├── mcp/                # @agent-stack/mcp - MCP 协议支持
│   │   ├── skill/              # @agent-stack/skill - Skill 系统
│   │   ├── memory/             # @agent-stack/memory - Memory 策略层
│   │   ├── memory-store/       # @agent-stack/memory-store - Memory 存储层
│   │   └── index/              # @agent-stack/index - Agent 实现 + CLI
│   │
│   ├── skills/                 # 自定义 Skills (@agent-stack-skill/*)
│   │   └── memory/             # @agent-stack-skill/memory - Memory Skill
│   │
│   └── mcp-servers/            # 自定义 MCP 服务器 (@agent-stack-mcp/*)
│       ├── fetch/              # @agent-stack-mcp/fetch - Web 内容获取
│       ├── time/               # @agent-stack-mcp/time - 时间和时区转换
│       └── git/                # @agent-stack-mcp/git - Git 仓库操作
│
├── example/                     # 示例项目
│   ├── .agent-stack.json       # Agent 配置示例
│   ├── .mcp.json               # MCP 配置示例
│   └── skills/                 # 示例 Skills
│       ├── file-skill/         # 文件操作
│       ├── shell-skill/        # Shell 命令
│       └── search-skill/       # 文件搜索
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
@agent-stack/provider  (OpenAI API 封装)
        │
        └── openai (^4.77.0)

@agent-stack/mcp       (MCP 协议支持)
        │
        └── @modelcontextprotocol/sdk (^1.0.0)

@agent-stack/skill     (Skill 系统)
        │
        └── (无外部依赖)

@agent-stack/memory-store (存储层)
        │
        ├── better-sqlite3 (^11.7.0)
        └── sqlite-vec (^0.1.6)

@agent-stack/memory    (策略层)
        │
        └── @agent-stack/memory-store (workspace:*)

@agent-stack-skill/memory (Memory Skill)
        │
        └── @agent-stack/memory-store (workspace:*)

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
