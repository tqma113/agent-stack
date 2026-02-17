# API 参考

## 1. @agent-stack/provider

### 1.1 OpenAIClient 类

#### 构造函数

```typescript
constructor(config?: OpenAIClientConfig)
```

**OpenAIClientConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `apiKey` | `string` | `process.env.OPENAI_API_KEY` | API 密钥 |
| `baseURL` | `string` | OpenAI 默认 | 自定义 API 端点 |
| `organization` | `string` | - | 组织 ID |
| `project` | `string` | - | 项目 ID |
| `timeout` | `number` | `60000` | 请求超时 (ms) |
| `maxRetries` | `number` | `2` | 最大重试次数 |

---

#### chat()

同步创建聊天补全。

```typescript
async chat(
  messages: ChatCompletionMessageParam[],
  options?: ChatCompletionOptions
): Promise<ChatCompletionResult>
```

**ChatCompletionOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `model` | `ChatModel` | 使用的模型 |
| `temperature` | `number` | 温度 (0-2) |
| `maxTokens` | `number` | 最大输出 token |
| `topP` | `number` | Top-p 采样 |
| `frequencyPenalty` | `number` | 频率惩罚 |
| `presencePenalty` | `number` | 存在惩罚 |
| `stop` | `string \| string[]` | 停止序列 |
| `tools` | `ChatCompletionTool[]` | 可用工具 |
| `toolChoice` | `ChatCompletionToolChoiceOption` | 工具选择策略 |
| `responseFormat` | `{ type: 'text' \| 'json_object' }` | 响应格式 |
| `seed` | `number` | 随机种子 |
| `user` | `string` | 用户标识 |

**ChatCompletionResult**:

```typescript
{
  id: string;
  content: string | null;
  toolCalls?: ChatCompletionMessageToolCall[];
  finishReason: string | null;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

#### chatStream()

流式创建聊天补全。

```typescript
async *chatStream(
  messages: ChatCompletionMessageParam[],
  options?: StreamingOptions
): AsyncGenerator<string, ChatCompletionResult, unknown>
```

**StreamingOptions** (继承 ChatCompletionOptions):

| 参数 | 类型 | 描述 |
|------|------|------|
| `onToken` | `(token: string) => void` | 每个 token 的回调 |
| `onToolCall` | `(toolCall) => void` | 工具调用回调 |
| `signal` | `AbortSignal` | 取消信号 |

---

#### embed()

创建文本嵌入。

```typescript
async embed(
  input: string | string[],
  options?: EmbeddingOptions
): Promise<EmbeddingResult[]>
```

**EmbeddingOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `model` | `EmbeddingModel` | `text-embedding-3-small` | 嵌入模型 |
| `dimensions` | `number` | - | 输出维度 |
| `user` | `string` | - | 用户标识 |

---

#### generateImage()

生成图像。

```typescript
async generateImage(
  prompt: string,
  options?: ImageGenerationOptions
): Promise<ImageResult[]>
```

**ImageGenerationOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `model` | `ImageModel` | `dall-e-3` | 图像模型 |
| `n` | `number` | `1` | 生成数量 |
| `size` | `string` | `1024x1024` | 图像尺寸 |
| `quality` | `standard \| hd` | - | 图像质量 |
| `style` | `vivid \| natural` | - | 图像风格 |
| `responseFormat` | `url \| b64_json` | - | 响应格式 |

---

#### textToSpeech()

文本转语音。

```typescript
async textToSpeech(
  input: string,
  options?: TTSOptions
): Promise<ArrayBuffer>
```

**TTSOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `model` | `TTSModel` | `tts-1` | TTS 模型 |
| `voice` | `TTSVoice` | `alloy` | 语音类型 |
| `speed` | `number` | - | 语速 (0.25-4.0) |
| `responseFormat` | `string` | - | 输出格式 |

---

#### speechToText()

语音转文本。

```typescript
async speechToText(
  file: Uploadable,
  options?: STTOptions
): Promise<string>
```

**STTOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `model` | `STTModel` | `whisper-1` | STT 模型 |
| `language` | `string` | - | 语言代码 |
| `prompt` | `string` | - | 提示词 |
| `responseFormat` | `string` | - | 响应格式 |
| `temperature` | `number` | - | 温度 |

---

#### moderate()

内容审核。

```typescript
async moderate(
  input: string | string[],
  options?: ModerationOptions
): Promise<ModerationResult[]>
```

---

### 1.2 辅助函数

#### 消息构建

```typescript
// 系统消息
systemMessage(content: string): ChatCompletionMessageParam

// 用户消息
userMessage(content: string): ChatCompletionMessageParam

// 带图片的用户消息
userMessageWithImage(
  text: string,
  imageUrl: string,
  detail?: 'auto' | 'low' | 'high'
): ChatCompletionMessageParam

// 助手消息
assistantMessage(content: string): ChatCompletionMessageParam

// 工具结果消息
toolMessage(
  toolCallId: string,
  content: string
): ChatCompletionMessageParam
```

#### 工具定义

```typescript
// 定义工具
defineTool(
  name: string,
  description: string,
  parameters: Record<string, unknown>
): ChatCompletionTool

// 定义参数 Schema
defineParameters(
  properties: Record<string, unknown>,
  required?: string[]
): Record<string, unknown>
```

#### 文本处理

```typescript
// 估算 token 数 (约 4 字符/token)
estimateTokens(text: string): number

// 截断文本到指定 token 数
truncateToTokens(text: string, maxTokens: number): string

// 按 token 分块文本
chunkText(text: string, maxTokensPerChunk: number): string[]
```

---

## 2. @agent-stack/index

### 2.1 Agent 类

#### 构造函数

```typescript
constructor(config?: AgentConfig)
```

**AgentConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `name` | `string` | `'Agent'` | Agent 名称 |
| `systemPrompt` | `string` | 默认提示词 | 系统提示词 |
| `model` | `string` | `'gpt-4o'` | 使用的模型 |
| `temperature` | `number` | `0.7` | 温度 |
| `maxTokens` | `number` | `4096` | 最大 token |
| `apiKey` | `string` | 环境变量 | API 密钥 |
| `baseURL` | `string` | - | 自定义端点 |
| `mcp` | `AgentMCPConfig` | - | MCP 配置 |

**AgentMCPConfig**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `configPath` | `string` | MCP 配置文件路径 |
| `servers` | `Record<string, MCPServerConfig>` | 内联服务器配置 |
| `toolOptions` | `MCPToolBridgeOptions` | 工具桥接选项 |
| `autoConnect` | `boolean` | 是否自动连接 |

---

#### 配置方法

```typescript
// 获取 Agent 名称
getName(): string

// 更新配置
configure(config: Partial<AgentConfig>): void
```

---

#### MCP 方法

```typescript
// 初始化 MCP 连接
async initializeMCP(): Promise<void>

// 获取 MCP 管理器
getMCPManager(): MCPClientManager | null

// 获取 MCP 工具提供者
getMCPToolProvider(): MCPToolProvider | null

// 刷新 MCP 工具
async refreshMCPTools(): Promise<void>

// 关闭 MCP 连接
async closeMCP(): Promise<void>
```

---

#### 工具管理

```typescript
// 注册单个工具
registerTool(tool: Tool): void

// 批量注册工具
registerTools(tools: Tool[]): void

// 移除工具
removeTool(name: string): boolean

// 获取所有工具
getTools(): Tool[]
```

**Tool 接口**:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;
}
```

---

#### 对话历史

```typescript
// 清除历史
clearHistory(): void

// 获取历史
getHistory(): ChatCompletionMessageParam[]

// 添加消息
addMessage(message: ChatCompletionMessageParam): void
```

---

#### chat()

同步对话方法。

```typescript
async chat(
  input: string,
  options?: ConversationOptions
): Promise<AgentResponse>
```

**ConversationOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxIterations` | `number` | `10` | 最大工具调用迭代 |
| `signal` | `AbortSignal` | - | 取消信号 |

**AgentResponse**:

```typescript
{
  content: string;
  toolCalls?: ToolCallResult[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

---

#### stream()

流式对话方法。

```typescript
async stream(
  input: string,
  callbacks?: StreamCallbacks,
  options?: ConversationOptions
): Promise<AgentResponse>
```

**StreamCallbacks**:

```typescript
{
  onToken?: (token: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
  onComplete?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;
}
```

---

#### complete()

单轮补全，不保存对话历史。

```typescript
async complete(
  prompt: string,
  systemPromptOverride?: string
): Promise<string>
```

---

## 3. @agent-stack/mcp

### 3.1 MCPClientManager 类

管理多个 MCP 服务器连接。

#### 构造函数

```typescript
constructor(options?: MCPClientManagerOptions)
```

**MCPClientManagerOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `onConnectionChange` | `(serverName, state, error?) => void` | 连接状态变化回调 |
| `onToolsChange` | `(serverName, tools) => void` | 工具列表变化回调 |
| `defaultTimeout` | `number` | 默认超时 (ms)，默认 30000 |

---

#### 生命周期方法

```typescript
// 初始化配置
async initialize(config?: MCPConfig | string): Promise<void>

// 连接所有服务器
async connectAll(): Promise<void>

// 连接单个服务器
async connect(serverName: string): Promise<void>

// 断开连接
async disconnect(serverName: string): Promise<void>

// 关闭所有连接
async close(): Promise<void>
```

---

#### 工具方法

```typescript
// 列出服务器工具
async listTools(serverName: string): Promise<MCPTool[]>

// 列出所有工具
async listAllTools(): Promise<Map<string, MCPTool[]>>

// 调用工具
async callTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  options?: MCPToolCallOptions
): Promise<MCPToolResult>

// 查找工具所属服务器
findToolServer(toolName: string): string | undefined
```

---

#### 资源方法

```typescript
// 列出资源
async listResources(serverName: string): Promise<MCPResource[]>

// 读取资源
async readResource(serverName: string, uri: string): Promise<MCPResourceContent>
```

---

#### 提示词方法

```typescript
// 列出提示词
async listPrompts(serverName: string): Promise<MCPPrompt[]>

// 获取提示词
async getPrompt(
  serverName: string,
  promptName: string,
  args?: Record<string, string>
): Promise<MCPPromptMessage[]>
```

---

#### 状态查询

```typescript
// 获取服务器名称列表
getServerNames(): string[]

// 获取连接信息
getConnection(serverName: string): MCPServerConnection | undefined

// 检查是否已连接
isConnected(serverName: string): boolean

// 获取连接状态
getState(serverName: string): MCPConnectionState
```

---

### 3.2 MCPToolProvider 类

将 MCP 工具桥接为 Agent Tool 接口。

#### 构造函数

```typescript
constructor(manager: MCPClientManager, options?: MCPToolBridgeOptions)
```

**MCPToolBridgeOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `namePrefix` | `string` | 工具名前缀，如 `"mcp_"` |
| `includeServerName` | `boolean` | 是否在名称中包含服务器名 |
| `nameTransformer` | `(server, tool) => string` | 自定义名称转换函数 |
| `filter` | `(server, tool) => boolean` | 工具过滤函数 |

---

#### 方法

```typescript
// 获取所有桥接工具
getTools(): AgentTool[]

// 获取特定服务器的工具
getToolsFromServer(serverName: string): AgentTool[]

// 刷新工具列表
async refresh(): Promise<void>

// 查找工具
findTool(name: string): BridgedTool | undefined

// 获取资源访问器
getResourceAccessor(): MCPResourceAccessor
```

---

### 3.3 配置函数

```typescript
// 加载配置文件
async loadConfig(configPath: string): Promise<MCPConfig>

// 从默认位置加载配置
async loadConfigFromDefaults(startDir?: string): Promise<MCPConfig | null>

// 查找配置文件
findConfigFile(startDir?: string): string | null
```

---

### 3.4 MCP 类型定义

```typescript
// 配置类型
interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

interface MCPStdioServerConfig {
  type?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

interface MCPHttpServerConfig {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

// 协议类型
interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

interface MCPToolResult {
  content: Array<{ type: 'text' | 'image'; text?: string; data?: string }>;
  isError?: boolean;
}

// 桥接类型
interface BridgedTool extends AgentTool {
  mcpToolName: string;
  mcpServerName: string;
}

// 连接状态
type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
```

---

### 3.5 错误类

```typescript
class MCPError extends Error {
  code: string;
  serverName?: string;
}

class MCPConnectionError extends MCPError {}
class MCPToolExecutionError extends MCPError {}
class MCPConfigurationError extends MCPError {}
class MCPTimeoutError extends MCPError {}
```

---

## 4. 类型导出

### 从 @agent-stack/provider 导出

```typescript
export {
  // 类
  OpenAIClient,

  // 辅助函数
  systemMessage,
  userMessage,
  userMessageWithImage,
  assistantMessage,
  toolMessage,
  defineTool,
  defineParameters,
  estimateTokens,
  truncateToTokens,
  chunkText,
  toFile,

  // 类型
  type OpenAIClientConfig,
  type ChatModel,
  type EmbeddingModel,
  type ImageModel,
  type TTSModel,
  type STTModel,
  type TTSVoice,
  type ModerationModel,
  type ChatCompletionOptions,
  type StreamingOptions,
  type EmbeddingOptions,
  type ImageGenerationOptions,
  type TTSOptions,
  type STTOptions,
  type ModerationOptions,
  type ChatCompletionResult,
  type EmbeddingResult,
  type ImageResult,
  type ModerationResult,
  type ChatCompletionMessageParam,
  type ChatCompletionTool,
};
```

### 从 @agent-stack/index 导出

```typescript
export {
  // 类
  Agent,

  // 类型
  type AgentConfig,
  type Tool,
  type AgentResponse,
  type ToolCallResult,
  type StreamCallbacks,
  type ConversationOptions,
  type Message,

  // 从 provider re-export
  OpenAIClient,
  systemMessage,
  userMessage,
  assistantMessage,
  toolMessage,
  defineTool,
  defineParameters,
  type ChatModel,
  type ChatCompletionMessageParam,
};
```

### 从 @agent-stack/mcp 导出

```typescript
export {
  // 类
  MCPClientManager,
  MCPToolProvider,

  // 配置函数
  loadConfig,
  loadConfigFromDefaults,
  findConfigFile,
  createTransport,
  createToolBridge,
  createResourceAccessor,

  // 错误类
  MCPError,
  MCPConnectionError,
  MCPToolExecutionError,
  MCPConfigurationError,
  MCPTimeoutError,

  // 辅助函数
  sanitizeToolName,
  generateToolName,
  parseToolResultContent,
  withTimeout,
  retryWithBackoff,

  // 类型
  type MCPConfig,
  type MCPServerConfig,
  type MCPStdioServerConfig,
  type MCPHttpServerConfig,
  type MCPTool,
  type MCPResource,
  type MCPResourceContent,
  type MCPPrompt,
  type MCPToolResult,
  type MCPConnectionState,
  type MCPServerConnection,
  type MCPClientManagerOptions,
  type MCPToolBridgeOptions,
  type BridgedTool,
  type MCPResourceAccessor,
};
```
