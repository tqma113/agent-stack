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

### 2.1 OpenAIClient 类

**职责**：封装 OpenAI API，提供类型安全的接口

```typescript
class OpenAIClient {
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

### 3.1 Agent 类

**职责**：提供完整的 AI Agent 功能

```typescript
class Agent {
  // 配置管理
  constructor(config: AgentConfig)
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

### 6.1 MCPClientManager 类

**职责**：管理多个 MCP 服务器连接

```typescript
class MCPClientManager {
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

### 6.2 MCPToolProvider 类

**职责**：将 MCP 工具桥接为 Agent Tool 接口

```typescript
class MCPToolProvider {
  constructor(manager, options)

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
import { Agent } from '@agent-stack/index';

const agent = new Agent({
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
import { Agent } from '@agent-stack/index';

// 方式 1: 使用配置文件，手动初始化
const agent = new Agent({
  name: 'MCP Agent',
  mcp: { configPath: './.mcp.json' }
});
await agent.initializeMCP();

// 方式 2: 使用配置文件，自动连接
const agent2 = new Agent({
  mcp: { configPath: './.mcp.json', autoConnect: true }
});
// 首次调用 chat() 时自动初始化 MCP

// 方式 3: 内联配置
const agent3 = new Agent({
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
import { Agent, MCPClientManager, MCPToolProvider } from '@agent-stack/index';

const mcpManager = new MCPClientManager();
await mcpManager.initialize('./.mcp.json');
await mcpManager.connectAll();

const toolProvider = new MCPToolProvider(mcpManager, {
  nameTransformer: (server, tool) => `mcp__${server}__${tool}`,
});

const agent = new Agent({ name: 'MCP Agent' });
agent.registerTools(toolProvider.getTools());

const response = await agent.chat('搜索 OpenAI 文档');
await mcpManager.close();
```

---

## 8. @agent-stack/skill 业务逻辑

### 8.1 SkillManager 类

**职责**：管理 Skill 生命周期和状态

```typescript
class SkillManager {
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

### 8.2 SkillToolProvider 类

**职责**：将 Skill 工具桥接为 Agent Tool 接口

```typescript
class SkillToolProvider {
  constructor(manager, options)

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
import { Agent } from '@agent-stack/index';

// 方式 1: 使用配置文件
const agent = new Agent({
  name: 'Skill Agent',
  skill: {
    configPath: './skills.json',
    autoLoad: true
  }
});
await agent.initializeSkills();

// 方式 2: 目录自动发现
const agent2 = new Agent({
  skill: {
    directories: ['./skills/', './my-skills/'],
    autoLoad: true
  }
});

// 方式 3: 内联配置
const agent3 = new Agent({
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
