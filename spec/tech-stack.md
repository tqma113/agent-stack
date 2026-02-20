# 技术栈详解

本文档详细说明 AI Stack 使用的技术栈、依赖版本和构建配置。

---

## 1. 核心语言与运行时

### TypeScript (~5.7.2)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

**配置说明**：
- `target: ES2022` - 支持现代 JavaScript 特性
- `moduleResolution: bundler` - 适配 tsup 等现代打包工具
- `strict: true` - 启用严格类型检查

### Node.js (>=20.0.0 <23.0.0)

- 要求 Node.js 20+ LTS 版本
- 支持原生 ESM 模块
- 支持 `--experimental-vm-modules` 用于测试

---

## 2. Monorepo 架构

### Rush (5.165.0)

微软开源的 Monorepo 管理工具。

**特点**：
- 确定性安装 (shrinkwrap)
- 增量构建
- 项目隔离

**配置** (`rush.json`):
```json
{
  "rushVersion": "5.165.0",
  "pnpmVersion": "9.15.9",
  "nodeSupportedVersionRange": ">=20.0.0 <23.0.0",
  "projectFolderMinDepth": 1,
  "projectFolderMaxDepth": 3
}
```

### pnpm (9.15.9)

Rush 使用 pnpm 作为底层包管理器。

**特点**：
- 硬链接节省磁盘空间
- 严格模式防止幽灵依赖
- Workspace 协议 (`workspace:*`)

---

## 3. 构建工具

### tsup (^8.3.5)

零配置 TypeScript 打包工具，基于 esbuild。

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
});
```

**输出**：
```
dist/
├── index.js      # CommonJS
├── index.mjs     # ESM
├── index.d.ts    # TypeScript 类型
└── index.js.map  # Source Map
```

---

## 4. LLM SDK

### OpenAI SDK (^4.77.0)

官方 OpenAI Node.js SDK，**默认安装**。

**支持的模型**：
| 类型 | 模型 |
|------|------|
| 聊天 | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-4, gpt-3.5-turbo, o1, o1-mini |
| 嵌入 | text-embedding-3-small, text-embedding-3-large |
| 图像 | dall-e-3, dall-e-2 |
| 语音 | tts-1, tts-1-hd, whisper-1 |

### Anthropic SDK (^0.39.0)

Anthropic Claude API SDK，**可选依赖**。

**支持的模型**：
| 类型 | 模型 |
|------|------|
| 聊天 | claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307 |

### Google Generative AI SDK (^0.21.0)

Google Gemini API SDK，**可选依赖**。

**支持的模型**：
| 类型 | 模型 |
|------|------|
| 聊天 | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash-exp |
| 嵌入 | text-embedding-004 |

### OpenAI 兼容 API

支持任何兼容 OpenAI API 的提供商：

| 提供商 | baseURL | 说明 |
|--------|---------|------|
| Ollama | http://localhost:11434/v1 | 本地模型 |
| Groq | https://api.groq.com/openai/v1 | 高速推理 |
| Together.ai | https://api.together.xyz/v1 | 开源模型 |
| Azure OpenAI | https://{endpoint}.openai.azure.com | 企业部署 |

---

## 5. MCP 协议

### @modelcontextprotocol/sdk (^1.0.0)

Model Context Protocol SDK。

**传输类型**：
- `stdio` - 本地进程
- `http` - HTTP 服务
- `sse` - Server-Sent Events

**配置格式** (`.mcp.json`):
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

## 6. 数据存储

### better-sqlite3 (^11.7.0)

同步的 SQLite3 绑定库。

**特点**：
- 同步 API
- 预编译语句
- 事务支持

**存储层**：
| Store | 用途 |
|-------|------|
| EventStore | 事件日志 |
| TaskStateStore | 任务状态 |
| ProfileStore | 用户偏好 |
| SummaryStore | 对话摘要 |
| SemanticStore | 语义检索 |
| EmbeddingCache | 嵌入缓存 |

### SQLite FTS5

全文搜索扩展。

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  content='semantic_chunks',
  content_rowid='rowid',
  tokenize='unicode61'
);
```

### sqlite-vec (^0.1.6)

向量搜索扩展。

```sql
CREATE VIRTUAL TABLE vec_chunks USING vec0(
  chunk_id INTEGER PRIMARY KEY,
  embedding FLOAT[1536]
);
```

---

## 7. 终端 UI

### Ink (^5.0.1)

React-based 终端 UI 框架。

**组件**：
- `Confirm` - 确认对话框
- `Select` - 选择菜单
- `DiffView` - Diff 预览
- `TaskBoard` - 任务看板
- `HistoryBrowser` - 历史浏览

### @inkjs/ui (^2.0.0)

Ink 官方组件库。

### 辅助库

| 库 | 版本 | 用途 |
|---|------|------|
| chalk | ^5.4.0 | 终端颜色 |
| boxen | ^8.0.1 | 消息框 |
| ora | ^8.1.0 | 加载动画 |
| diff | ^7.0.0 | Diff 计算 |
| strip-ansi | ^7.1.0 | ANSI 清理 |
| cli-truncate | ^4.0.0 | 文本截断 |
| terminal-size | ^4.0.0 | 终端尺寸 |

---

## 8. 验证与 CLI

### Zod (^3.24.0)

TypeScript-first Schema 验证库。

```typescript
const ConfigSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
}).strict();
```

### Commander (^12.1.0)

Node.js 命令行框架。

```bash
ai-stack chat       # 交互式聊天
ai-stack run        # 单次执行
ai-stack tools      # 工具管理
ai-stack config     # 配置管理
```

---

## 9. 测试框架

### Vitest (^2.1.0)

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
| 包 | 测试数 |
|---|--------|
| @ai-stack/memory | 220 |
| @ai-stack/memory-store-sqlite | 87 |
| @ai-stack-skill/memory | 28 |
| **总计** | 335+ |

---

## 10. 其他依赖

### 文件处理

| 库 | 版本 | 用途 |
|---|------|------|
| glob | ^11.0.0 | 文件模式匹配 |
| chokidar | ^4.0.0 | 文件监听 |
| picomatch | ^4.0.0 | 路径匹配 |

### 文档处理

| 库 | 版本 | 用途 |
|---|------|------|
| node-html-markdown | ^1.3.0 | HTML 转 Markdown |
| gray-matter | ^4.0.3 | Frontmatter 解析 |

### 调度

| 库 | 版本 | 用途 |
|---|------|------|
| cron-parser | ^4.9.0 | Cron 表达式解析 |

### 可选依赖

| 库 | 版本 | 用途 |
|---|------|------|
| telegraf | ^4.16.0 | Telegram Bot |
| discord.js | ^14.14.0 | Discord Bot |

---

## 11. 开发工具

### TypeScript 类型

| 包 | 版本 |
|---|------|
| @types/node | ^22.10.0 |
| @types/better-sqlite3 | ^7.6.0 |
| @types/diff | ^5.0.0 |
| @types/react | ^18.3.0 |

### 工具

| 工具 | 版本 | 用途 |
|------|------|------|
| rimraf | ^6.0.1 | 跨平台删除 |
| tsx | ^4.7.0 | TypeScript 执行 |

---

## 12. CI/CD

### GitHub Actions

```yaml
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
        with: { node-version: 20 }
      - run: node common/scripts/install-run-rush.js change --verify
      - run: node common/scripts/install-run-rush.js install
      - run: node common/scripts/install-run-rush.js rebuild --verbose
```

---

## 13. 版本兼容性矩阵

| 依赖 | 最低版本 | 推荐版本 | 说明 |
|------|----------|----------|------|
| Node.js | 20.0.0 | 20.x LTS | <23.0.0 |
| pnpm | 9.0.0 | 9.15.9 | - |
| Rush | 5.165.0 | 5.165.0 | - |
| TypeScript | 5.5.0 | ~5.7.2 | - |
| openai | 4.50.0 | ^4.77.0 | - |
| better-sqlite3 | 11.0.0 | ^11.7.0 | - |
| ink | 5.0.0 | ^5.0.1 | - |

---

## 14. 排序算法

### 时间衰减 (Temporal Decay)

```
score × e^(-λ × ageInDays)
λ = ln(2) / halfLifeDays
```

**模式**：
- `exponential` - 指数衰减 (默认)
- `linear` - 线性衰减
- `step` - 阶梯衰减

### MMR (Maximal Marginal Relevance)

```
MMR = λ × relevance - (1-λ) × max_similarity
```

**相似度函数**：
- `jaccard` - Jaccard 系数
- `overlap` - 重叠系数
- `cosine` - 余弦相似度 (需要嵌入向量)

---

## 15. 包大小参考

| 包 | 大小 (dist) |
|---|-------------|
| @ai-stack/provider | ~50KB |
| @ai-stack/mcp | ~30KB |
| @ai-stack/skill | ~25KB |
| @ai-stack/memory | ~80KB |
| @ai-stack/memory-store-sqlite | ~40KB |
| @ai-stack/knowledge | ~60KB |
| @ai-stack/tui | ~100KB |
| @ai-stack/agent | ~150KB |

*注：不包含 node_modules 和原生模块*
