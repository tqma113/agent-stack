# AI Stack

> **TypeScript AI Agent 开发框架** - 构建强大、可扩展的 AI Agent 应用

AI Stack 是一个功能完整的 AI Agent 开发框架，提供多模型 LLM 抽象、MCP 协议支持、技能系统、记忆系统、知识索引、权限管控和终端 UI 组件。采用 Rush Monorepo 架构，模块化设计，开箱即用。

---

## 核心特性

| 特性 | 描述 |
|------|------|
| **多模型支持** | OpenAI、Anthropic Claude、Google Gemini、OpenAI 兼容 API (Ollama, Groq 等) |
| **MCP 协议** | Model Context Protocol 支持，连接外部工具服务器 (stdio/http/sse) |
| **技能系统** | 动态加载本地技能，热插拔工具扩展 |
| **记忆系统** | 五层记忆架构，持久化对话和任务状态 (SQLite + FTS5 + 向量搜索) |
| **知识索引** | 代码库和文档索引，混合搜索 (FTS + Vector) |
| **权限管控** | 工具执行前确认、审计日志、规则引擎 |
| **终端 UI** | Ink + 直接输出混合架构，流式渲染、Diff 视图、任务看板 |
| **高级编排** | 状态机、恢复策略、计划 DAG、评估器、模型路由 |

---

## 项目结构

```
ai-stack/
├── packages/
│   ├── libs/                    # 核心库 (@ai-stack/*)
│   │   ├── provider/            # 多模型 LLM 抽象层
│   │   ├── mcp/                 # MCP 协议支持
│   │   ├── skill/               # 技能系统
│   │   ├── memory/              # 记忆策略层
│   │   ├── memory-store-sqlite/ # SQLite 存储实现
│   │   ├── memory-store-json/   # JSON 轻量存储
│   │   ├── knowledge/           # 代码和文档索引
│   │   ├── tui/                 # 终端 UI 组件
│   │   ├── agent/               # Agent 核心实现
│   │   ├── assistant/           # 个人 AI 助手
│   │   └── code/                # 代码编辑 Agent
│   │
│   ├── skills/                  # 技能包 (@ai-stack-skill/*)
│   │   ├── memory/              # 记忆操作技能
│   │   └── knowledge/           # 知识搜索技能
│   │
│   ├── mcp-servers/             # MCP 服务器 (@ai-stack-mcp/*)
│   │   ├── time/                # 时间和时区
│   │   ├── fetch/               # Web 内容获取
│   │   ├── git/                 # Git 操作
│   │   ├── bash/                # Shell 命令执行
│   │   ├── lsp/                 # 语言服务器协议
│   │   └── electron-cdp/        # Chrome DevTools
│   │
│   └── examples/                # 示例项目
│       ├── agent/               # Agent 基础示例
│       ├── assistant/           # 个人助手示例
│       └── code/                # 代码 Agent 示例
│
├── spec/                        # 项目文档
├── rush.json                    # Rush 配置
└── CLAUDE.md                    # Claude Code 配置
```

---

## 快速开始

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/anthropics/ai-stack.git
cd ai-stack

# 安装依赖
rush update

# 构建所有包
rush build
```

### 运行示例

```bash
# Agent 示例
cd packages/examples/agent
pnpm start

# 个人助手示例
cd packages/examples/assistant
pnpm start

# 代码 Agent 示例
cd packages/examples/code
pnpm start
```

### 基础用法

```typescript
import { createAgent } from '@ai-stack/agent';

// 创建 Agent
const agent = createAgent({
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
});

// 对话
const response = await agent.chat('Hello!');
console.log(response.content);

// 流式对话
await agent.stream('Tell me a story', {
  onToken: (token) => process.stdout.write(token),
  onComplete: () => console.log('\nDone!'),
});
```

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | ~5.7.2 |
| 运行时 | Node.js | >=20.0.0 |
| 包管理 | pnpm + Rush | 9.15.9 / 5.165.0 |
| 构建工具 | tsup | ^8.3.5 |
| LLM SDK | openai, @anthropic-ai/sdk, @google/generative-ai | ^4.77.0 |
| MCP SDK | @modelcontextprotocol/sdk | ^1.0.0 |
| 数据库 | better-sqlite3 + sqlite-vec | ^11.7.0 |
| TUI | ink + chalk + ora | ^5.0.1 |
| 验证 | zod | ^3.24.0 |

---

## 文档导航

| 文档 | 描述 |
|------|------|
| [快速开始](./getting-started.md) | 安装、配置和第一个 Agent |
| [架构设计](./architecture.md) | 整体架构、设计理念和模块关系 |
| [技术栈详解](./tech-stack.md) | 依赖版本、构建配置和开发工具 |
| [项目结构详解](./project-structure.md) | 包结构、文件组织和依赖关系 |
| [业务逻辑详解](./business-logic.md) | 核心流程、数据流和集成模式 |
| [API 参考](./api-reference.md) | 公共 API、类型定义和使用示例 |
| [Knowledge 设计](./knowledge-design.md) | 知识索引系统设计文档 |

---

## 设计理念

### 函数式编程风格

项目采用工厂函数替代传统类：

```typescript
// 工厂函数模式
export function createAgent(config: AgentConfig): AgentInstance {
  // 闭包封装私有状态
  let state = initialState;

  // 返回公共接口
  return {
    chat: async (input) => { ... },
    stream: async (input, callbacks) => { ... },
    registerTool: (tool) => { ... },
  };
}
```

**命名约定**：
- 工厂函数: `createXxx()`
- 返回类型: `XxxInstance`
- 配置类型: `XxxConfig`

### 模块化架构

```
Provider (LLM 抽象)
    │
    ├── MCP (外部工具)
    ├── Skill (本地技能)
    ├── Memory (持久记忆)
    └── Knowledge (知识索引)
           │
           └── Agent (核心编排)
                  │
                  ├── Assistant (个人助手)
                  └── Code (代码编辑)
```

---

## 许可证

MIT License

---

## 相关链接

- [GitHub 仓库](https://github.com/anthropics/ai-stack)
- [问题反馈](https://github.com/anthropics/ai-stack/issues)
- [MCP 协议规范](https://modelcontextprotocol.io/)
