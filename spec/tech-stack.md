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
```json
{
  "rushVersion": "5.165.0",
  "pnpmVersion": "9.15.9",
  "nodeSupportedVersionRange": ">=20.0.0 <23.0.0",
  "projects": [
    { "packageName": "@agent-stack/provider", "projectFolder": "packages/provider" },
    { "packageName": "@agent-stack/mcp", "projectFolder": "packages/mcp" },
    { "packageName": "@agent-stack/skill", "projectFolder": "packages/skill" },
    { "packageName": "@agent-stack/index", "projectFolder": "packages/index" }
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
