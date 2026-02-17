# 项目结构详解

## 1. 目录结构总览

```
agent-stack/
├── packages/                    # 业务包目录
│   ├── provider/               # @agent-stack/provider
│   ├── mcp/                    # @agent-stack/mcp
│   └── index/                  # @agent-stack/index
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
│   ├── agent.ts               # Agent 类实现 (371 行)
│   ├── types.ts               # 类型定义 (78 行)
│   └── cli.ts                 # CLI 入口 (78 行)
├── dist/                      # 构建输出
├── package.json
└── tsup.config.ts
```

### 3.2 文件职责

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 统一导出入口，re-export agent 和 provider |
| `src/agent.ts` | Agent 核心类，实现对话和工具调用 |
| `src/types.ts` | Agent 相关类型定义 |
| `src/cli.ts` | 命令行交互入口 |

### 3.3 package.json 关键配置

```json
{
  "name": "@agent-stack/index",
  "version": "0.0.1",
  "bin": {
    "agent-stack": "./dist/cli.js"
  },
  "dependencies": {
    "@agent-stack/provider": "workspace:*"
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

## 5. Rush 配置目录

### 4.1 common/config/rush/

```
common/config/rush/
├── .npmrc                     # npm 配置
├── command-line.json          # 自定义命令
├── common-versions.json       # 共享版本
├── pnpm-config.json          # pnpm 配置
├── pnpm-lock.yaml            # 依赖锁文件
└── ... (其他 Rush 配置)
```

### 4.2 common/scripts/

```
common/scripts/
├── install-run.js            # 通用安装运行脚本
├── install-run-rush.js       # Rush 安装运行脚本
├── install-run-rushx.js      # Rushx 安装运行脚本
└── install-run-rush-pnpm.js  # pnpm 安装运行脚本
```

---

## 6. 开发工具配置

### 5.1 .claude/ 目录

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

### 5.2 .ttadk/ 目录

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

## 7. 构建输出

### 6.1 dist/ 目录结构

每个包的 `dist/` 目录输出：

```
dist/
├── index.js           # CommonJS 入口
├── index.mjs          # ESM 入口
├── index.d.ts         # TypeScript 类型声明
├── index.d.mts        # ESM 类型声明
└── index.js.map       # Source Map
```

### 6.2 构建命令

```bash
# 单包构建
rushx build

# 全量构建
rush build

# 重新构建
rush rebuild
```
