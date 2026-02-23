# 快速开始

本指南帮助你快速上手 AI Stack，从安装到创建第一个 Agent。

---

## 1. 环境要求

| 要求 | 版本 |
|------|------|
| Node.js | >=20.0.0 <23.0.0 |
| pnpm | >=9.0.0 |

---

## 2. 安装

### 2.1 克隆项目

```bash
git clone https://github.com/anthropics/ai-stack.git
cd ai-stack
```

### 2.2 安装依赖

```bash
# 安装 Rush (如果未安装)
npm install -g @microsoft/rush

# 安装项目依赖
rush update

# 构建所有包
rush build
```

### 2.3 配置 API Key

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# 或 Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# 或 Google
export GOOGLE_API_KEY="..."
```

---

## 3. 第一个 Agent

### 3.1 创建项目

```bash
mkdir my-agent
cd my-agent
npm init -y
npm install @ai-stack/agent
```

### 3.2 基础示例

```typescript
// index.ts
import { createAgent } from '@ai-stack/agent';

async function main() {
  // 创建 Agent
  const agent = createAgent({
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful assistant.',
  });

  // 同步对话
  const response = await agent.chat('Hello! What can you do?');
  console.log(response.content);

  // 流式对话
  await agent.stream('Tell me a short story about a robot.', {
    onToken: (token) => process.stdout.write(token),
    onComplete: () => console.log('\n--- Done ---'),
  });
}

main().catch(console.error);
```

### 3.3 运行

```bash
npx tsx index.ts
```

---

## 4. 添加工具

### 4.1 注册自定义工具

```typescript
import { createAgent } from '@ai-stack/agent';

const agent = createAgent({
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant with access to tools.',
});

// 注册工具
agent.registerTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name, e.g., "Tokyo"',
      },
    },
    required: ['location'],
  },
  execute: async (args) => {
    // 模拟 API 调用
    return `Weather in ${args.location}: Sunny, 25°C`;
  },
});

// 使用工具
const response = await agent.chat('What is the weather in Tokyo?');
console.log(response.content);
```

### 4.2 工具增强文档

```typescript
agent.registerTool({
  name: 'search_database',
  description: 'Search the database for records',
  parameters: { ... },
  execute: async (args) => { ... },

  // 增强文档 - 帮助 LLM 更好地使用工具
  examples: [
    {
      input: { query: 'active users' },
      output: 'Found 150 active users...',
    },
  ],
  hints: [
    'Use specific keywords for better results',
    'Supports wildcards: user*',
  ],
  edgeCases: [
    'Empty query returns all records (limited to 100)',
  ],
});
```

---

## 5. 集成 MCP

### 5.1 配置 MCP 服务器

创建 `mcp.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/fetch"]
    }
  }
}
```

### 5.2 使用 MCP 工具

```typescript
import { createAgent } from '@ai-stack/agent';

const agent = createAgent({
  model: 'gpt-4o',
  mcp: {
    configPath: './mcp.json',
    autoConnect: true,
  },
});

// MCP 工具自动加载
const response = await agent.chat('List files in the current directory');
console.log(response.content);

// 清理
await agent.close();
```

---

## 6. 使用 Memory

### 6.1 启用 Memory

```typescript
import { createAgent } from '@ai-stack/agent';

const agent = createAgent({
  model: 'gpt-4o',
  memory: {
    enabled: true,
    dbPath: './memory/sqlite.db',
    autoInitialize: true,
    autoInject: true,
  },
});

// 对话自动记录到 Memory
await agent.chat('My name is Alice');
await agent.chat('I prefer concise answers');

// 后续对话会自动注入相关记忆
const response = await agent.chat('What is my name?');
console.log(response.content); // 会记得你的名字

await agent.close();
```

### 6.2 任务管理

```typescript
// 创建任务
const task = await agent.createTask('Implement user authentication', {
  plan: [
    { id: '1', description: 'Design database schema', status: 'pending' },
    { id: '2', description: 'Implement login API', status: 'pending' },
    { id: '3', description: 'Add JWT tokens', status: 'pending' },
  ],
});

// 更新任务进度
await agent.completeTaskStep('1', 'Schema created with users table');

// 获取进度
const progress = await agent.getTaskProgress();
console.log(`Progress: ${progress.percentage}%`);
```

---

## 7. 使用 Knowledge

### 7.1 索引代码

```typescript
import { createAgent } from '@ai-stack/agent';

const agent = createAgent({
  model: 'gpt-4o',
  knowledge: {
    enabled: true,
    code: {
      enabled: true,
      rootDir: './src',
      include: ['**/*.ts', '**/*.tsx'],
      watch: true,
    },
    search: {
      autoSearch: true,
      autoInject: true,
    },
  },
});

// 首次对话时自动索引代码
const response = await agent.chat('How does the authentication system work?');
console.log(response.content);

await agent.close();
```

### 7.2 添加文档

```typescript
// 添加文档源
await agent.addDocSource({
  name: 'React Docs',
  type: 'url',
  url: 'https://react.dev/reference/react',
  tags: ['react', 'frontend'],
});

// 抓取文档
await agent.crawlDocs();

// 搜索文档
const results = await agent.searchDocs('useEffect cleanup');
```

---

## 8. 权限管控

### 8.1 启用权限检查

```typescript
import { createAgent } from '@ai-stack/agent';
import * as readline from 'readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const agent = createAgent({
  model: 'gpt-4o',
  permission: {
    enabled: true,
    defaultLevel: 'confirm',
    rules: [
      // 读操作自动批准
      { tool: '*_read*', level: 'auto' },
      { tool: '*_get*', level: 'auto' },
      // 写操作需要确认
      { tool: '*_write*', level: 'confirm' },
      // 删除操作禁止
      { tool: '*_delete*', level: 'deny' },
    ],
    onConfirm: async (request) => {
      console.log(`\nTool: ${request.toolName}`);
      console.log(`Args: ${JSON.stringify(request.args, null, 2)}`);
      const answer = await rl.question('Allow? (y/n/a): ');
      return {
        allowed: answer.toLowerCase() !== 'n',
        rememberForSession: answer.toLowerCase() === 'a',
      };
    },
  },
});
```

---

## 9. 流式响应与 UI

### 9.1 流式回调

```typescript
await agent.stream('Explain quantum computing', {
  // Token 回调
  onToken: (token) => process.stdout.write(token),

  // 工具调用回调
  onToolCall: (toolName, args) => {
    console.log(`\n🔧 Calling: ${toolName}`);
  },

  // 工具结果回调
  onToolResult: (toolName, result) => {
    console.log(`✅ Result: ${result.substring(0, 100)}...`);
  },

  // 完成回调
  onComplete: (response) => {
    console.log(`\n\n--- Completed ---`);
    console.log(`Tokens: ${response.usage?.totalTokens}`);
  },

  // 错误回调
  onError: (error) => {
    console.error(`Error: ${error.message}`);
  },
});
```

### 9.2 使用 TUI 组件

```typescript
import { showConfirm, showSelect, createStreamRenderer } from '@ai-stack/tui';

// 确认对话框
const confirmed = await showConfirm('Apply changes?');

// 选择菜单
const choice = await showSelect('Choose model:', [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3.5', value: 'claude-3-5-sonnet' },
  { label: 'Gemini Pro', value: 'gemini-pro' },
]);

// 流式渲染器
const renderer = createStreamRenderer();
renderer.startThinking();
// ... LLM 调用
renderer.addToken('Hello');
renderer.addToken(' World');
renderer.complete();
```

---

## 10. 运行示例项目

### 10.1 Agent 示例

```bash
cd packages/examples/agent
pnpm start
```

### 10.2 个人助手示例

```bash
cd packages/examples/assistant
pnpm start

# 守护进程模式
pnpm run daemon
```

### 10.3 代码 Agent 示例

```bash
cd packages/examples/code
pnpm start

# 查看历史
pnpm run history

# 撤销操作
pnpm run undo
```

---

## 11. 配置文件

### 11.1 agent.json

```json
{
  "name": "My Agent",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful assistant.",
  "mcp": {
    "configPath": "./mcp.json",
    "autoConnect": true
  },
  "skill": {
    "directories": ["./skills"],
    "autoLoad": true
  },
  "memory": {
    "enabled": true,
    "dbPath": "./memory/sqlite.db"
  },
  "permission": {
    "enabled": true,
    "defaultLevel": "confirm"
  }
}
```

### 11.2 assistant.json

```json
{
  "name": "My Personal Assistant",
  "agent": {
    "model": "gpt-4o",
    "temperature": 0.7,
    "systemPrompt": "You are a helpful personal AI assistant."
  },
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
    "enabled": true
  }
}
```

### 11.3 code.json

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 8192,
  "safety": {
    "workingDir": ".",
    "allowedPaths": ["**/*"],
    "blockedPaths": ["**/node_modules/**", "**/.git/**"],
    "confirmDestructive": true
  },
  "history": {
    "enabled": true
  },
  "tasks": {
    "enabled": true
  },
  "knowledge": {
    "enabled": false,
    "code": { "enabled": true, "autoIndex": false },
    "doc": { "enabled": true, "autoIndex": false }
  }
}
```

### 11.4 mcp.json

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/fetch"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/git"]
    },
    "bash": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/bash"]
    }
  }
}
```

---

## 12. 下一步

- 阅读 [架构设计](./architecture.md) 了解系统设计
- 查看 [API 参考](./api-reference.md) 了解详细 API
- 探索 [业务逻辑](./business-logic.md) 了解核心流程
- 参考 [项目结构](./project-structure.md) 了解代码组织

---

## 13. 常见问题

### Q: 如何切换模型提供商?

```typescript
// OpenAI
const agent = createAgent({ model: 'gpt-4o' });

// Anthropic
const agent = createAgent({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
});

// Google
const agent = createAgent({
  provider: 'google',
  model: 'gemini-1.5-pro',
});

// 本地 Ollama
const agent = createAgent({
  provider: 'openai-compatible',
  baseURL: 'http://localhost:11434/v1',
  model: 'llama2',
});
```

### Q: 如何处理长对话?

启用 Memory 系统，自动管理上下文窗口：

```typescript
const agent = createAgent({
  memory: {
    enabled: true,
    autoInject: true,
    tokenBudget: {
      total: 4000, // 为记忆预留的 token
    },
  },
});
```

### Q: 如何并行执行工具?

```typescript
const agent = createAgent({
  toolExecution: {
    parallelExecution: true,
    maxConcurrentTools: 5,
    toolTimeout: 30000,
  },
});
```

### Q: 如何调试工具调用?

```typescript
const agent = createAgent({
  telemetry: {
    enabled: true,
    logLevel: 'debug',
    onEvent: (event) => {
      if (event.type === 'tool:start') {
        console.log(`[TOOL] ${event.toolName} started`);
      }
      if (event.type === 'tool:end') {
        console.log(`[TOOL] ${event.toolName} completed in ${event.durationMs}ms`);
      }
    },
  },
});
```
