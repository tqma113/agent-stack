# 业务逻辑详解

## 1. 核心业务模型

Agent Stack 的核心业务是提供一个可扩展的 AI Agent 开发框架，主要包含四层：

```
┌─────────────────────────────────────────────────────────┐
│                   @agent-stack/index                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    Agent 类                        │  │
│  │  - 对话管理                                        │  │
│  │  - 工具注册与执行                                  │  │
│  │  - 流式响应                                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ @agent-stack/    │   │ @agent-stack/mcp │   │ @agent-stack/    │
│    provider      │   │                  │   │    skill         │
│  ┌────────────┐  │   │  ┌────────────┐  │   │  ┌────────────┐  │
│  │ OpenAI    │  │   │  │ MCPClient  │  │   │  │ Skill      │  │
│  │ Client    │  │   │  │ Manager    │  │   │  │ Manager    │  │
│  └────────────┘  │   │  └────────────┘  │   │  └────────────┘  │
└──────────────────┘   └──────────────────┘   └──────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
   ┌────────────┐       ┌────────────┐       ┌────────────┐
   │ OpenAI API │       │ MCP Servers│       │ Local Skills│
   └────────────┘       └────────────┘       └────────────┘
```

---

## 2. @agent-stack/provider 业务逻辑

### 2.1 createOpenAIClient() 工厂函数

**职责**：封装 OpenAI API，提供类型安全的接口

```typescript
// 创建实例
const client = createOpenAIClient(config);

// 返回 OpenAIClientInstance 接口
interface OpenAIClientInstance {
  // 核心方法
  chat(messages, options)      // 同步聊天
  chatStream(messages, options) // 流式聊天
  embed(input, options)        // 文本嵌入
  generateImage(prompt, options) // 图像生成
  textToSpeech(input, options) // 文本转语音
  speechToText(file, options)  // 语音转文本
  moderate(input, options)     // 内容审核
  listModels()                 // 列出模型
}
```

### 2.2 消息构建辅助函数

```typescript
// 快速构建对话消息
systemMessage(content)        // 系统消息
userMessage(content)          // 用户消息
userMessageWithImage(text, url) // 带图片的用户消息
assistantMessage(content)     // 助手消息
toolMessage(toolCallId, content) // 工具结果消息
```

### 2.3 工具定义辅助函数

```typescript
// 定义 Function Calling 工具
defineTool(name, description, parameters)
defineParameters(properties, required)
```

### 2.4 文本处理工具

```typescript
// Token 估算和文本分块
estimateTokens(text)          // 估算 token 数
truncateToTokens(text, max)   // 截断到指定 token
chunkText(text, maxTokens)    // 按 token 分块
```

---

## 3. @agent-stack/index 业务逻辑

### 3.1 createAgent() 工厂函数

**职责**：提供完整的 AI Agent 功能

```typescript
// 创建实例
const agent = createAgent(config);

// 返回 AgentInstance 接口
interface AgentInstance {
  // 配置管理
  configure(config)
  getName()

  // 工具管理
  registerTool(tool)
  registerTools(tools)
  removeTool(name)
  getTools()

  // 对话管理
  clearHistory()
  getHistory()
  addMessage(message)

  // 核心对话方法
  chat(input, options)         // 同步对话
  stream(input, callbacks, options) // 流式对话
  complete(prompt, systemPrompt) // 单轮补全
}
```

### 3.2 对话流程

#### 同步对话 (`chat` 方法)

```
用户输入
    │
    ▼
┌─────────────────────┐
│ 1. 添加用户消息到历史 │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. 构建消息列表      │
│   - 系统提示词       │
│   - 对话历史        │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. 调用 OpenAI API  │
└─────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 4. 检查是否有工具调用    │
│   - 无: 返回响应        │
│   - 有: 执行工具 → 循环  │
└─────────────────────────┘
    │
    ▼
返回 AgentResponse
```

#### 流式对话 (`stream` 方法)

```
用户输入
    │
    ▼
┌─────────────────────────┐
│ 流式接收 tokens         │
│ - onToken: 每个 token   │
│ - onToolCall: 工具调用   │
│ - onToolResult: 工具结果 │
│ - onComplete: 完成      │
│ - onError: 错误         │
└─────────────────────────┘
```

### 3.3 工具系统

**Tool 接口**：

```typescript
interface Tool {
  name: string;           // 工具名称 (唯一)
  description: string;    // 工具描述
  parameters: object;     // JSON Schema 参数
  execute: (args) => Promise<string>; // 执行函数
}
```

**工具执行流程**：

```
LLM 返回 tool_calls
    │
    ▼
┌─────────────────────┐
│ 1. 解析 tool_call   │
│   - function.name   │
│   - function.args   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 2. 查找注册的工具    │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 3. 执行 execute()   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 4. 将结果添加到消息  │
│    继续对话循环      │
└─────────────────────┘
```

### 3.4 CLI 应用

**命令结构**：

```bash
# 交互式聊天
agent-stack chat [--config PATH] [--model NAME] [--mcp PATH] [--skill DIR]

# 单次执行任务
agent-stack run "<task>" [--config PATH] [--model NAME] [--yes] [--json]

# 工具管理
agent-stack tools list [--config PATH]
agent-stack tools info <name> [--config PATH]

# 配置管理
agent-stack config init [--force]
agent-stack config show [--config PATH]
```

**交互式聊天流程**：

```
启动 agent-stack chat
    │
    ▼
┌─────────────────────────┐
│ 加载配置文件            │
│ (.agent-stack.json)     │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ 初始化 Agent            │
│ - 连接 MCP 服务器       │
│ - 加载 Skills           │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐◄────┐
│ 等待用户输入            │     │
│ - /tools: 列出工具      │     │
│ - /clear: 清除历史      │     │
│ - /help: 显示帮助       │     │
│ - exit: 退出            │     │
└─────────────────────────┘     │
    │                           │
    ▼                           │
┌─────────────────────────┐     │
│ 流式输出响应            │     │
│ - onToken → stdout      │     │
│ - onToolCall → 日志     │     │
│ - onToolResult → 日志   │     │
└─────────────────────────┘     │
    │                           │
    └───────────────────────────┘
```

**配置文件格式** (`.agent-stack.json`):

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 4096,
  "systemPrompt": "You are a helpful assistant...",
  "skill": {
    "directories": ["./skills"],
    "autoLoad": true
  },
  "mcp": {
    "configPath": ".mcp.json",
    "autoConnect": true
  }
}
```

---

## 4. 配置项说明

### 4.1 AgentConfig

```typescript
interface AgentConfig {
  name?: string;          // Agent 名称，默认 'Agent'
  systemPrompt?: string;  // 系统提示词
  model?: string;         // 模型，默认 'gpt-4o'
  temperature?: number;   // 温度，默认 0.7
  maxTokens?: number;     // 最大 token，默认 4096
  apiKey?: string;        // API Key
  baseURL?: string;       // 自定义 API 地址
}
```

### 4.2 OpenAIClientConfig

```typescript
interface OpenAIClientConfig {
  apiKey?: string;        // 默认读取 OPENAI_API_KEY
  baseURL?: string;       // 自定义端点
  organization?: string;  // 组织 ID
  project?: string;       // 项目 ID
  timeout?: number;       // 超时，默认 60000ms
  maxRetries?: number;    // 重试次数，默认 2
}
```

---

## 5. 错误处理

### 5.1 工具执行错误

```typescript
try {
  const result = await tool.execute(args);
} catch (error) {
  // 错误被捕获并作为工具结果返回给 LLM
  const errorResult = `Error executing tool: ${error.message}`;
  messages.push(toolMessage(toolCall.id, errorResult));
}
```

### 5.2 迭代限制

```typescript
// 防止无限循环
if (iterations >= maxIterations) {
  throw new Error(`Max iterations (${maxIterations}) reached`);
}
```

### 5.3 请求取消

```typescript
// 支持 AbortSignal
if (signal?.aborted) {
  throw new Error('Request aborted');
}
```

---

## 6. @agent-stack/mcp 业务逻辑

### 6.1 createMCPClientManager() 工厂函数

**职责**：管理多个 MCP 服务器连接

```typescript
const manager = createMCPClientManager(options);

// 返回 MCPClientManagerInstance 接口
interface MCPClientManagerInstance {
  // 生命周期
  initialize(config)     // 初始化配置
  connectAll()           // 连接所有服务器
  connect(serverName)    // 连接单个服务器
  disconnect(serverName) // 断开连接
  close()                // 关闭所有连接

  // 工具操作
  listTools(serverName)      // 列出服务器工具
  listAllTools()             // 列出所有工具
  callTool(server, name, args) // 调用工具

  // 资源操作
  listResources(serverName)  // 列出资源
  readResource(server, uri)  // 读取资源

  // 提示词操作
  listPrompts(serverName)    // 列出提示词
  getPrompt(server, name)    // 获取提示词
}
```

### 6.2 createMCPToolProvider() 工厂函数

**职责**：将 MCP 工具桥接为 Agent Tool 接口

```typescript
const provider = createMCPToolProvider(manager, options);

// 返回 MCPToolProviderInstance 接口
interface MCPToolProviderInstance {
  getTools()                    // 获取所有桥接工具
  getToolsFromServer(server)    // 获取特定服务器工具
  refresh()                     // 刷新工具列表
  findTool(name)                // 查找工具
  getResourceAccessor()         // 获取资源访问器
}
```

### 6.3 MCP 连接流程

```
配置加载 (.mcp.json)
    │
    ▼
┌─────────────────────┐
│ 解析服务器配置       │
│ - stdio: command    │
│ - http: url         │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 创建传输层          │
│ - StdioTransport    │
│ - HttpTransport     │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 连接 MCP 服务器      │
│ - 初始化会话         │
│ - 获取能力列表       │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 刷新工具/资源/提示词  │
└─────────────────────┘
```

### 6.4 工具桥接流程

```
MCP Tool
    │
    ├─ name: "search_docs"
    ├─ description: "..."
    └─ inputSchema: {...}
    │
    ▼
┌─────────────────────────┐
│ 工具名转换              │
│ mcp__server__search_docs │
└─────────────────────────┘
    │
    ▼
Agent Tool
    │
    ├─ name: "mcp__server__search_docs"
    ├─ description: "..."
    ├─ parameters: {...}
    └─ execute: async (args) => {
         return manager.callTool(server, name, args);
       }
```

### 6.5 MCP 配置格式

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
      "env": { "DEBUG": "true" }
    },
    "remote-api": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

---

## 7. 使用示例

### 7.1 基础对话

```typescript
import { createAgent } from '@agent-stack/index';

const agent = createAgent({
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
});

const response = await agent.chat('Hello!');
console.log(response.content);
```

### 7.2 注册工具

```typescript
agent.registerTool({
  name: 'get_weather',
  description: 'Get the current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  execute: async (args) => {
    return `Weather in ${args.location}: Sunny, 25°C`;
  },
});

const response = await agent.chat('What is the weather in Tokyo?');
```

### 7.3 流式响应

```typescript
await agent.stream('Tell me a story', {
  onToken: (token) => process.stdout.write(token),
  onComplete: (response) => console.log('\nDone!'),
});
```

### 7.4 使用 MCP 工具 (内置集成)

```typescript
import { createAgent } from '@agent-stack/index';

// 方式 1: 使用配置文件，手动初始化
const agent = createAgent({
  name: 'MCP Agent',
  mcp: { configPath: './.mcp.json' }
});
await agent.initializeMCP();

// 方式 2: 使用配置文件，自动连接
const agent2 = createAgent({
  mcp: { configPath: './.mcp.json', autoConnect: true }
});
// 首次调用 chat() 时自动初始化 MCP

// 方式 3: 内联配置
const agent3 = createAgent({
  mcp: {
    servers: {
      'openai-docs': {
        type: 'http',
        url: 'https://developers.openai.com/mcp'
      }
    },
    autoConnect: true
  }
});

// 使用 Agent
const response = await agent.chat('搜索 OpenAI 文档');
console.log(response.content);

// 清理
await agent.closeMCP();
```

### 7.5 使用 MCP 工具 (手动集成)

如果需要更精细的控制，可以手动集成：

```typescript
import { createAgent, createMCPClientManager, createMCPToolProvider } from '@agent-stack/index';

const mcpManager = createMCPClientManager();
await mcpManager.initialize('./.mcp.json');
await mcpManager.connectAll();

const toolProvider = createMCPToolProvider(mcpManager, {
  nameTransformer: (server, tool) => `mcp__${server}__${tool}`,
});

const agent = createAgent({ name: 'MCP Agent' });
agent.registerTools(toolProvider.getTools());

const response = await agent.chat('搜索 OpenAI 文档');
await mcpManager.close();
```

---

## 8. @agent-stack/skill 业务逻辑

### 8.1 createSkillManager() 工厂函数

**职责**：管理 Skill 生命周期和状态

```typescript
const manager = createSkillManager(options);

// 返回 SkillManagerInstance 接口
interface SkillManagerInstance {
  // 初始化
  initialize(config)     // 初始化配置

  // 生命周期
  loadAll()              // 加载所有 skill
  load(skillName)        // 加载单个 skill
  unload(skillName)      // 卸载 skill
  activate(skillName)    // 激活 skill
  deactivate(skillName)  // 停用 skill
  close()                // 关闭所有 skill

  // 目录发现
  discoverAndLoad(directory) // 发现并加载目录中的 skills

  // 工具访问
  getTools()             // 获取所有工具
  getToolsFromSkill(name) // 获取特定 skill 的工具

  // 状态查询
  getSkillNames()        // 获取 skill 名称列表
  getSkill(name)         // 获取 skill 信息
  getState(name)         // 获取 skill 状态
  isLoaded(name)         // 检查是否已加载
  isActive(name)         // 检查是否激活
}
```

### 8.2 createSkillToolProvider() 工厂函数

**职责**：将 Skill 工具桥接为 Agent Tool 接口

```typescript
const provider = createSkillToolProvider(manager, options);

// 返回 SkillToolProviderInstance 接口
interface SkillToolProviderInstance {
  getTools()                    // 获取所有桥接工具
  getToolsFromSkill(skillName)  // 获取特定 skill 工具
  refresh()                     // 刷新工具列表
  findTool(name)                // 查找工具
}
```

### 8.3 Skill 加载流程

```
配置加载 (skills.json 或目录发现)
    │
    ▼
┌─────────────────────┐
│ 解析 skill 配置      │
│ - path: 本地路径    │
│ - package: npm 包   │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 加载 skill.json     │
│ - name             │
│ - tools[]          │
│ - hooks            │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 解析工具处理函数     │
│ - ./handler.js#fn  │
│ - 动态 import      │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 执行 onLoad 钩子    │
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ 状态: loaded        │
└─────────────────────┘
```

### 8.4 Skill 状态机

```
unloaded ──────► loading ──────► loaded ◄─────► active
    ▲               │              │               │
    │               ▼              │               │
    │            error             │               │
    │               │              │               │
    └───────────────┴──────────────┴───────────────┘
                 (unload)
```

### 8.5 Skill 配置格式

**skills.json** (配置文件):
```json
{
  "skills": {
    "web-search": {
      "path": "./skills/web-search",
      "enabled": true
    },
    "my-npm-skill": {
      "package": "@my/skill-package"
    }
  },
  "autoLoad": true
}
```

**skill.json** (Skill 定义):
```json
{
  "name": "web-search",
  "version": "1.0.0",
  "description": "Web search capabilities",
  "tools": [
    {
      "name": "search",
      "description": "Search the web",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string" }
        },
        "required": ["query"]
      },
      "handler": "./handlers.js#search"
    }
  ],
  "hooks": {
    "onLoad": "./handlers.js#onLoad"
  }
}
```

### 8.6 使用示例

```typescript
import { createAgent } from '@agent-stack/index';

// 方式 1: 使用配置文件
const agent = createAgent({
  name: 'Skill Agent',
  skill: {
    configPath: './skills.json',
    autoLoad: true
  }
});
await agent.initializeSkills();

// 方式 2: 目录自动发现
const agent2 = createAgent({
  skill: {
    directories: ['./skills/', './my-skills/'],
    autoLoad: true
  }
});

// 方式 3: 内联配置
const agent3 = createAgent({
  skill: {
    skills: {
      'web-search': { path: './skills/web-search' }
    }
  }
});
await agent3.initializeSkills();

// 使用
const response = await agent.chat('Search for TypeScript tips');

// 动态管理
const skillManager = agent.getSkillManager();
await skillManager.activate('new-skill');

// 清理
await agent.closeSkills();
```

---

## 9. @agent-stack/memory 业务逻辑

### 9.1 createMemoryManager() 工厂函数

**职责**：管理持久化记忆的完整生命周期

```typescript
const manager = createMemoryManager(config);

// 返回 MemoryManagerInstance 接口
interface MemoryManagerInstance {
  // 生命周期
  initialize()             // 初始化数据库和存储
  close()                  // 关闭连接

  // 会话管理
  getSessionId()           // 获取当前会话ID
  setSessionId(id)         // 设置会话ID
  newSession()             // 开始新会话

  // 事件操作
  recordEvent(event)       // 记录事件
  onEvent(callback)        // 订阅事件

  // 任务操作
  createTask(task)         // 创建任务
  updateTask(id, update)   // 更新任务
  getCurrentTask()         // 获取当前任务

  // 配置操作
  setProfile(item)         // 设置用户偏好
  getProfile(key)          // 获取用户偏好
  getAllProfiles()         // 获取所有偏好

  // 检索
  retrieve(options)        // 检索 MemoryBundle
  inject(bundle)           // 注入到 prompt

  // 摘要
  summarize(sessionId)     // 生成摘要

  // 语义
  addChunk(chunk)          // 添加语义块
  searchChunks(query)      // 语义搜索
}
```

### 9.2 五层记忆存储

```
┌─────────────────────────────────────────────────────────────────┐
│                        MemoryBundle                              │
├─────────────────────────────────────────────────────────────────┤
│  Profile (200 tokens)     用户偏好，优先级最高                   │
│  TaskState (300 tokens)   当前任务状态                          │
│  Summary (400 tokens)     滚动摘要                              │
│  RecentEvents (500 tokens) 最近事件                             │
│  SemanticChunks (800 tokens) 语义检索结果                       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 Agent 集成

```typescript
import { createAgent } from '@agent-stack/index';

// 启用 Memory
const agent = createAgent({
  name: 'Memory Agent',
  memory: {
    enabled: true,
    dbPath: '.agent-stack/memory.db',
    autoInitialize: true,
    autoInject: true,
  }
});

// 对话自动记录到 memory
const response = await agent.chat('Hello!');

// 手动检索 memory
const bundle = await agent.retrieveMemory('search query');
const context = await agent.getMemoryContext('search query');

// 会话管理
const sessionId = agent.newSession();

// 任务管理
const task = await agent.createTask('Implement feature X', {
  plan: [
    { id: '1', description: 'Step 1', status: 'pending' },
    { id: '2', description: 'Step 2', status: 'pending' },
  ],
});
await agent.completeTaskStep('1', 'Done');
const progress = await agent.getTaskProgress(); // { percentage: 50, done: 1, total: 2 }

// Profile 管理
await agent.setProfile('language', 'Chinese', { explicit: true });
const lang = await agent.getProfile('language'); // 'Chinese'

// 清理
await agent.close();  // 关闭所有资源 (MCP, Skill, Memory)
```

### 9.4 Memory 配置

```json
{
  "memory": {
    "enabled": true,
    "dbPath": ".agent-stack/memory.db",
    "autoInitialize": true,
    "autoInject": true,
    "tokenBudget": {
      "profile": 200,
      "taskState": 300,
      "recentEvents": 500,
      "semanticChunks": 800,
      "summary": 400,
      "total": 2200
    },
    "writePolicy": {
      "autoSummarize": true,
      "summarizeEveryNEvents": 20,
      "conflictStrategy": "latest"
    },
    "retrieval": {
      "maxRecentEvents": 10,
      "maxSemanticChunks": 5,
      "enableSemanticSearch": true
    }
  }
}
```

### 9.5 搜索结果排序

Memory 系统提供搜索结果后处理管道：

#### 9.5.1 嵌入缓存

避免重复计算嵌入向量，减少 API 调用：

```typescript
// 配置
{
  "embeddingCache": {
    "enabled": true,
    "maxEntries": 50000,
    "ttlMs": 604800000  // 7 天
  }
}

// 缓存键: hash(text) + provider + model
// 支持批量操作: getBatch, setBatch
```

#### 9.5.2 时间衰减

优先返回最近的内容：

```typescript
import { applyTemporalDecay, createRankingPipeline } from '@agent-stack/memory';

// 公式: score × e^(-λ × ageInDays)
// λ = ln(2) / halfLifeDays

const decayed = applyTemporalDecay(results, {
  enabled: true,
  halfLifeDays: 30,        // 30 天后分数减半
  minMultiplier: 0.1,      // 最低保留 10% 分数
  decayType: 'exponential' // 或 'linear', 'step'
});
```

#### 9.5.3 MMR 多样性去重

避免返回相似内容：

```typescript
import { applyMMR } from '@agent-stack/memory';

// 公式: MMR = λ × relevance - (1-λ) × max_similarity_to_selected

const diverse = applyMMR(results, 10, {
  enabled: true,
  lambda: 0.7,              // 0.7 relevance, 0.3 diversity
  similarityFunction: 'jaccard',
  duplicateThreshold: 0.8,  // 相似度超过 0.8 视为重复
  useEmbeddings: true       // 优先使用向量相似度
});
```

#### 9.5.4 组合管道

```typescript
import { createRankingPipeline, rankResults } from '@agent-stack/memory';

// 方式 1: 快速使用
const ranked = rankResults(results, {
  limit: 10,
  temporalDecay: { halfLifeDays: 30 },
  mmr: { lambda: 0.7 },
  minScore: 0.1
});

// 方式 2: 可复用管道
const pipeline = createRankingPipeline({
  temporalDecay: { enabled: true, halfLifeDays: 30 },
  mmr: { enabled: true, lambda: 0.7 },
  limit: 10,
  minScore: 0.1
});

const result = pipeline(searchResults);
// result.results: 排序后的结果
// result.metadata: { temporalDecayApplied, mmrApplied, filteredCount, ... }
```

### 9.6 Context Compaction 自动 Memory Flush

在接近上下文窗口限制时，自动将重要内容持久化到长期记忆：

#### 9.6.1 Memory Flush

```typescript
import { createMemoryFlush } from '@agent-stack/memory';

const flush = createMemoryFlush({
  enabled: true,
  softThresholdTokens: 4000,   // 触发 flush 的软阈值
  hardThresholdTokens: 8000,   // 强制 flush 的硬阈值
  minEventsSinceFlush: 5,      // 最少事件数
  includeSummary: true,
});

// 检查是否需要 flush
const check = flush.checkFlush(currentTokens, eventsSinceFlush);
if (check.shouldFlush) {
  console.log(`Flush needed: ${check.reason}, urgency: ${check.urgency}`);
}

// 提取要保存的内容
const content = await flush.extractFlushContent(events, { sessionId });
// content: { decisions, facts, todos, preferences, summary, chunks }
```

#### 9.6.2 Compaction Manager

完整的 compaction 管理：

```typescript
import { createCompactionManager } from '@agent-stack/memory';

const compaction = createCompactionManager({
  flush: { softThresholdTokens: 4000, hardThresholdTokens: 8000 },
  maxContextTokens: 128000,
  reserveTokens: 4000,
  autoCompact: true,
  onCompaction: (result) => {
    console.log(`Compacted: ${result.tokensBefore} → ${result.tokensAfter}`);
  },
});

// 每轮更新 token 使用量
compaction.updateTokenCount(tokenUsage);

// 记录事件
compaction.recordEvent(event);

// 检查上下文健康状态
const health = compaction.checkHealth();
// { healthy, usage, remaining, urgency, recommendation }

// 自动判断是否需要 compaction
if (compaction.shouldCompact()) {
  const result = await compaction.compact(events, {
    sessionId,
    writeChunks: (chunks) => semanticStore.addBatch(chunks),
    createSummary: (content) => summaryStore.add(content),
  });
}
```

#### 9.6.3 LLM 辅助提取

可以使用 LLM 进行更智能的内容提取：

```typescript
const compaction = createCompactionManager({
  llmExtractor: async (events, prompt) => {
    const response = await agent.complete(prompt + '\n\nEvents:\n' +
      events.map(e => e.summary).join('\n'));
    return response;
  },
});
```

#### 9.6.4 健康检查建议

| 使用率 | 建议 | 操作 |
|--------|------|------|
| < 60% | `none` | 正常运行 |
| 60-80% | `flush_soon` | 准备 flush |
| 80-95% | `flush_now` | 立即 flush |
| > 95% | `critical` | 强制 compaction |

### 9.7 会话转录索引

将会话对话存储为 JSONL 格式并索引到语义存储：

#### 9.7.1 Session Transcript

```typescript
import { createSessionTranscript, formatTranscript } from '@agent-stack/memory';

const transcript = createSessionTranscript('session-123');

// 从 MemoryEvent 追加
transcript.appendFromEvent(userMessageEvent);
transcript.appendFromEvent(assistantMessageEvent);

// 序列化为 JSONL
const jsonl = transcript.toJSONL();
// {"type":"message","timestamp":1234,"message":{"role":"user","content":"Hello"}}
// {"type":"message","timestamp":1235,"message":{"role":"assistant","content":"Hi!"}}

// 生成索引块
const chunks = transcript.generateChunks({
  maxTokensPerChunk: 400,
  overlapTokens: 80,
});

// 格式化显示
console.log(formatTranscript(transcript.getEntries()));
// [USER]: Hello
// [ASSISTANT]: Hi!
```

#### 9.7.2 Transcript Indexer

```typescript
import { createTranscriptIndexer } from '@agent-stack/memory';

const indexer = createTranscriptIndexer(semanticStore, {
  watchEnabled: true,
  watchDebounceMs: 1500,
  chunkTokens: 400,
  overlapTokens: 80,
});

// 索引单个转录
const result = await indexer.indexTranscript(transcript);
// { success, chunksAdded, chunksRemoved, durationMs }

// 批量同步
await indexer.syncAll(transcripts, {
  force: false,
  progress: (current, total) => console.log(`${current}/${total}`),
});

// 搜索转录
const results = await indexer.searchTranscripts('TypeScript', {
  sessionIds: ['session-1', 'session-2'],
  roles: ['user', 'assistant'],
  limit: 10,
});
```

### 9.8 完整读写流程管道

统一的读写流程，集成所有功能：

#### 9.8.1 写入流程

```
Agent 调用 → Write Pipeline
    │
    ├─ 1. 内容提取 (Event/Chunk/Transcript/Flush)
    │
    ├─ 2. 自动分块 (400 tokens, 80 overlap)
    │
    ├─ 3. 生成嵌入 (如果 embedFunction 可用)
    │
    └─ 4. 存储索引 (SemanticStore)
```

```typescript
import { createMemoryPipeline } from '@agent-stack/memory';

const pipeline = createMemoryPipeline(stores, {
  embedFunction: async (text) => openai.embed(text),
});

// 写入内容
const writeResult = await pipeline.write({
  type: 'chunk',              // 'event' | 'chunk' | 'transcript' | 'flush'
  content: 'TypeScript is a typed superset of JavaScript.',
  sessionId: 'session-123',
  tags: ['programming'],
});
// { success, chunks, chunkCount, embeddingsGenerated, durationMs }
```

#### 9.8.2 读取流程

```
查询 → Read Pipeline
    │
    ├─ 1. 混合搜索 (FTS + Vector)
    │
    ├─ 2. 结果合并 (fts: 0.3, vector: 0.7)
    │
    ├─ 3. 时间衰减 (halfLife: 30 days)
    │
    ├─ 4. MMR 去重 (lambda: 0.7)
    │
    └─ 5. 返回片段 (snippet + metadata)
```

```typescript
const readResult = await pipeline.read({
  query: 'TypeScript programming',
  sessionId: 'session-123',
  limit: 10,
});

// readResult.results[0]:
// {
//   chunk: SemanticChunk,
//   score: 0.85,
//   matchType: 'hybrid',
//   snippet: '...TypeScript is a typed superset...',
//   metadata: { originalScore, decayedScore, mmrScore, ageInDays }
// }

// readResult.stages: { fts: true, vector: true, temporalDecay: true, mmr: true }
```

#### 9.8.3 Pipeline 配置

```typescript
// 写入配置
pipeline.setWriteConfig({
  autoChunk: true,
  chunkTokens: 400,
  overlapTokens: 80,
  autoEmbed: true,
  minContentLength: 20,
});

// 读取配置
pipeline.setReadConfig({
  hybridSearch: true,
  ftsWeight: 0.3,
  vectorWeight: 0.7,
  temporalDecay: true,
  temporalDecayConfig: { halfLifeDays: 30 },
  mmrEnabled: true,
  mmrConfig: { lambda: 0.7 },
  maxResults: 10,
  minScore: 0.1,
});
```

#### 9.8.4 一体化操作

```typescript
// 写入后立即检索 (RAG 场景)
const { write, read } = await pipeline.writeAndRead(
  { type: 'chunk', content: newDocument, sessionId },
  { query: userQuestion }
);

// 索引转录
await pipeline.indexTranscript(transcript);

// 处理 Flush 内容
await pipeline.processFlush(flushContent, sessionId);
```
