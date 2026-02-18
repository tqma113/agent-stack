# 技术栈详解

## 1. 核心语言与运行时

### TypeScript (~5.7.2)

项目使用 TypeScript 作为主要开发语言，配置如下：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "isolatedModules": true
  }
}
```

**关键配置说明**：
- `target: ES2022` - 目标 ES2022，支持现代 JS 特性
- `moduleResolution: bundler` - 适配 tsup 等现代打包工具
- `strict: true` - 启用严格类型检查

### Node.js (>=20.0.0 <23.0.0)

- 要求 Node.js 20+ LTS 版本
- 支持原生 ESM 模块

---

## 2. Monorepo 架构

### Rush (5.165.0)

Rush 是微软开源的 Monorepo 管理工具，主要特点：

- **确定性安装**: 通过 shrinkwrap 文件锁定依赖版本
- **增量构建**: 只构建变更的项目
- **项目隔离**: 每个项目独立的 node_modules

**关键配置** (`rush.json`):

项目分为三类，统一放在 `packages/` 目录下：
- **核心库** (`packages/libs/`): `@ai-stack/*`
- **自定义 Skills** (`packages/skills/`): `@ai-stack-skill/*`
- **自定义 MCP 服务器** (`packages/mcp-servers/`): `@ai-stack-mcp/*`

```json
{
  "rushVersion": "5.165.0",
  "pnpmVersion": "9.15.9",
  "nodeSupportedVersionRange": ">=20.0.0 <23.0.0",
  "projectFolderMinDepth": 1,
  "projectFolderMaxDepth": 3,
  "projects": [
    { "packageName": "@ai-stack/provider", "projectFolder": "packages/libs/provider" },
    { "packageName": "@ai-stack/mcp", "projectFolder": "packages/libs/mcp" },
    { "packageName": "@ai-stack/skill", "projectFolder": "packages/libs/skill" },
    { "packageName": "@ai-stack/memory", "projectFolder": "packages/libs/memory" },
    { "packageName": "@ai-stack/memory-store-sqlite", "projectFolder": "packages/libs/memory-store-sqlite" },
    { "packageName": "@ai-stack/memory-store-json", "projectFolder": "packages/libs/memory-store-json" },
    { "packageName": "@ai-stack/agent", "projectFolder": "packages/libs/index" },
    { "packageName": "@ai-stack-skill/memory", "projectFolder": "packages/skills/memory" },
    { "packageName": "@ai-stack-mcp/fetch", "projectFolder": "packages/mcp-servers/fetch" },
    { "packageName": "@ai-stack-mcp/time", "projectFolder": "packages/mcp-servers/time" },
    { "packageName": "@ai-stack-mcp/git", "projectFolder": "packages/mcp-servers/git" }
  ]
}
```

### pnpm (9.15.9)

Rush 使用 pnpm 作为底层包管理器：

- **硬链接**: 节省磁盘空间
- **严格模式**: 防止幽灵依赖
- **Workspace 协议**: `workspace:*` 引用本地包

---

## 3. 构建工具

### tsup (^8.3.5)

tsup 是一个零配置的 TypeScript 打包工具，基于 esbuild：

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],    // 双格式输出
  dts: true,                  // 生成类型声明
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

**输出格式**：
- `dist/index.js` - CommonJS 格式
- `dist/index.mjs` - ESM 格式
- `dist/index.d.ts` - TypeScript 类型声明

---

## 4. AI/LLM 集成

### OpenAI SDK (^4.77.0)

官方 OpenAI Node.js SDK，支持：

- Chat Completions API (GPT-4o, GPT-4, GPT-3.5)
- Embeddings API
- Image Generation (DALL-E)
- Audio API (Whisper, TTS)
- Moderation API

**支持的模型**:
| 类型 | 模型 |
|------|------|
| 聊天 | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini |
| 嵌入 | text-embedding-3-small, text-embedding-3-large |
| 图像 | dall-e-3, dall-e-2 |
| 语音 | tts-1, tts-1-hd, whisper-1 |

### Commander (^12.1.0)

Node.js 命令行框架，用于 CLI 实现：

```bash
# CLI 命令结构
ai-stack chat       # 交互式聊天
ai-stack run        # 单次执行任务
ai-stack tools      # 工具管理
ai-stack config     # 配置管理
```

### 终端 UI 库

CLI 使用现代化终端 UI 库提供美观的交互体验：

| 库 | 版本 | 用途 |
|---|------|------|
| chalk | ^5.4.0 | 终端颜色样式 (ESM 原生) |
| boxen | ^8.0.1 | 绘制消息框边框 |
| ora | ^8.1.0 | 优雅的 spinner 动画 |
| strip-ansi | ^7.1.0 | 计算字符串真实长度 |
| cli-truncate | ^4.0.0 | 智能文本截断 |
| terminal-size | ^4.0.0 | 获取终端尺寸 |

**CLI 选项**：
- `--classic` - 使用经典 (legacy) 终端 UI
- `--compact` - 使用紧凑的工具调用显示

**UI 特性**：
- 彩色消息框 (User: 绿色, Agent: 蓝色, Tool: 紫色)
- Header 显示版本、模型、工具数量
- 工具调用显示执行状态和耗时
- 流式输出和 thinking spinner
- 非 TTY 环境自动降级

### MCP SDK (@modelcontextprotocol/sdk ^1.0.0)

Model Context Protocol SDK，支持连接 MCP 服务器：

- **传输类型**：Stdio (本地进程)、HTTP (远程服务)
- **协议功能**：Tools (工具)、Resources (资源)、Prompts (提示词)
- **配置格式**：兼容 Claude Code 的 `.mcp.json` 格式

**配置示例** (`.mcp.json`):
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "remote-api": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

---

## 5. CI/CD

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: 16 }
      - run: node common/scripts/install-run-rush.js change --verify
      - run: node common/scripts/install-run-rush.js install
      - run: node common/scripts/install-run-rush.js rebuild --verbose --production
```

**CI 流程**：
1. 验证变更日志
2. 安装依赖
3. 构建所有项目

---

## 6. 开发工具集成

### Claude Code (.claude/)

项目集成了 Claude Code 开发助手：
- 自定义命令 (`commands/`)
- 技能定义 (`skills/`)
- 项目配置 (`settings.json`)

### TTADK (.ttadk/)

TikTok Agent Development Kit 插件系统，提供：
- 模板资源
- MCP 服务配置
- 辅助脚本

---

## 7. 数据存储

### better-sqlite3 (^11.7.0)

同步的 SQLite3 绑定库，用于 `@ai-stack/memory-store-sqlite` 包：

- **同步 API**: 简化异步处理
- **预编译语句**: 提高性能
- **事务支持**: 原子操作

**存储层**：
- EventStore - 事件日志存储
- TaskStateStore - 任务状态存储
- ProfileStore - 用户偏好存储
- SummaryStore - 对话摘要存储
- SemanticStore - 语义检索 (FTS5 + Vector)
- EmbeddingCache - 嵌入向量缓存 (LRU + TTL)

### SQLite FTS5

全文搜索扩展，用于语义检索：

```sql
-- 全文搜索表
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  content='semantic_chunks',
  content_rowid='rowid',
  tokenize='unicode61'
);
```

### sqlite-vec (^0.1.6)

向量搜索扩展，支持向量相似度检索：

```sql
-- 向量索引
CREATE VIRTUAL TABLE vec_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[1536]
);
```

### 嵌入缓存 (Embedding Cache)

基于 SQLite 的嵌入向量缓存，避免重复 API 调用：

- **缓存键**: SHA-256(text) + provider + model
- **淘汰策略**: LRU (访问时间排序) + TTL (过期时间)
- **批量操作**: `getBatch()`, `setBatch()` 支持批量查询/存储
- **默认配置**: 50000 条目上限，7 天 TTL

### 搜索结果排序算法

Memory 系统内置搜索结果后处理管道：

**时间衰减 (Temporal Decay)**:
- 公式: `score × e^(-λ × ageInDays)`, λ = ln(2) / halfLifeDays
- 支持指数/线性/阶梯三种衰减模式
- 默认 30 天半衰期，最低保留 10% 分数

**MMR 多样性去重 (Maximal Marginal Relevance)**:
- 公式: `MMR = λ × relevance - (1-λ) × max_similarity`
- 支持 Jaccard/Overlap/Cosine 相似度函数
- 默认 λ=0.7 (70% 相关性, 30% 多样性)

**组合管道**:
```typescript
const pipeline = createRankingPipeline({
  temporalDecay: { enabled: true, halfLifeDays: 30 },
  mmr: { enabled: true, lambda: 0.7 },
  limit: 10,
  minScore: 0.1,
});
```

---

## 8. 测试框架

### Vitest (^2.1.0)

用于 Memory 子系统的单元测试和集成测试：

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
```

**测试覆盖**：
- `@ai-stack/memory`: 220 个测试用例 (11 个测试文件)
- `@ai-stack/memory-store-sqlite`: 87 个测试用例 (6 个测试文件)
- `@ai-stack/memory-store-json`: 通过
- `@ai-stack-skill/memory`: 28 个测试用例 (1 个测试文件)
- **总计**: 335+ 测试用例

**测试模块**：
- 存储层测试 (Event, TaskState, Summary, Profile, Semantic, EmbeddingCache)
- 排序测试 (Temporal Decay, MMR, Pipeline)
- Compaction 测试 (Memory Flush, Compaction Manager)
- Transcript 测试 (Session Transcript, Transcript Indexer)
- Pipeline 测试 (Memory Pipeline)
- 集成测试 (长对话模拟, 性能测试)

---

## 9. 设计模式

### 函数式编程风格

项目采用函数式编程风格，使用工厂函数替代类：

```typescript
// 工厂函数模式
export function createOpenAIClient(config = {}): OpenAIClientInstance {
  // 闭包封装私有状态
  const client = new OpenAI({ apiKey: config.apiKey });
  let defaultModel: ChatModel = 'gpt-4o';

  // 返回公共接口对象
  return {
    getClient: () => client,
    setDefaultModel: (model) => { defaultModel = model; },
    chat: async (messages, options) => { ... },
    chatStream: async function* (messages, options) { ... },
  };
}
```

**设计原则**：
- **工厂函数替代类**: `createXxx()` 返回 `XxxInstance` 接口
- **闭包封装状态**: 私有状态通过闭包隐藏，返回对象只暴露方法
- **组合替代继承**: 共享功能通过 `createDbOperations()` 等组合函数实现
- **纯函数分离**: 业务逻辑提取为纯函数，副作用隔离到最外层
