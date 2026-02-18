# API 参考

## 1. @ai-stack/provider

### 1.1 createOpenAIClient() 工厂函数

#### 创建实例

```typescript
const client = createOpenAIClient(config?: OpenAIClientConfig): OpenAIClientInstance
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

## 2. @ai-stack/agent

### 2.1 createAgent() 工厂函数

#### 创建实例

```typescript
const agent = createAgent(config?: AgentConfig): AgentInstance
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
| `skill` | `AgentSkillConfig` | - | Skill 配置 |

**AgentMCPConfig**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `configPath` | `string` | MCP 配置文件路径 |
| `servers` | `Record<string, MCPServerConfig>` | 内联服务器配置 |
| `toolOptions` | `MCPToolBridgeOptions` | 工具桥接选项 |
| `autoConnect` | `boolean` | 是否自动连接 |

**AgentSkillConfig**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `configPath` | `string` | Skill 配置文件路径 |
| `directories` | `string[]` | 自动发现目录列表 |
| `skills` | `Record<string, SkillEntry>` | 内联 Skill 配置 |
| `toolOptions` | `SkillToolBridgeOptions` | 工具桥接选项 |
| `autoLoad` | `boolean` | 是否自动加载 |

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
getMCPManager(): MCPClientManagerInstance | null

// 获取 MCP 工具提供者
getMCPToolProvider(): MCPToolProviderInstance | null

// 刷新 MCP 工具
async refreshMCPTools(): Promise<void>

// 关闭 MCP 连接
async closeMCP(): Promise<void>
```

---

#### Skill 方法

```typescript
// 初始化 Skill
async initializeSkills(): Promise<void>

// 获取 Skill 管理器
getSkillManager(): SkillManagerInstance | null

// 获取 Skill 工具提供者
getSkillToolProvider(): SkillToolProviderInstance | null

// 刷新 Skill 工具
async refreshSkillTools(): Promise<void>

// 关闭 Skill
async closeSkills(): Promise<void>
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
| `onMaxIterations` | `OnMaxIterationsCallback` | - | 达到最大迭代时的回调 |

**OnMaxIterationsCallback**:

当达到 `maxIterations` 限制时触发的回调。返回 `true` 继续执行（重置计数器），返回 `false` 优雅停止。

```typescript
type OnMaxIterationsCallback = (info: MaxIterationsInfo) => Promise<boolean>;

interface MaxIterationsInfo {
  currentIterations: number;  // 当前迭代次数
  maxIterations: number;      // 最大迭代限制
  toolCallCount: number;      // 已执行的工具调用次数
}
```

**使用示例**:

```typescript
const response = await agent.chat('复杂任务', {
  maxIterations: 10,
  onMaxIterations: async (info) => {
    console.log(`已执行 ${info.currentIterations} 次迭代`);
    const answer = await readline.question('是否继续? (y/n): ');
    return answer.toLowerCase() === 'y';
  },
});
```

**注意**: 如果不提供 `onMaxIterations` 回调，达到限制时将抛出 `Error: Max iterations (N) reached`（保持向后兼容）。

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

### 2.2 配置函数

#### loadConfig()

加载配置文件。

```typescript
function loadConfig(configPath?: string): LoadConfigResult
```

**参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `configPath` | `string` | 可选，配置文件路径。不指定则自动查找 |

**返回值**:

```typescript
{
  config: AgentStackConfig;   // 加载的配置
  configPath?: string;        // 配置文件路径 (如果找到)
}
```

---

#### findConfigFile()

查找配置文件。

```typescript
function findConfigFile(startDir?: string): string | undefined
```

按优先级搜索：`.ai-stack.json`、`ai-stack.config.json`

---

#### toAgentConfig()

将 AgentStackConfig 转换为 AgentConfig。

```typescript
function toAgentConfig(
  stackConfig: AgentStackConfig,
  baseDir?: string
): AgentConfig
```

---

#### generateConfigTemplate()

生成默认配置模板。

```typescript
function generateConfigTemplate(): AgentStackConfig
```

---

### 2.3 配置类型

**AgentStackConfig**:

```typescript
interface AgentStackConfig {
  model?: string;              // 模型名称
  temperature?: number;        // 温度
  maxTokens?: number;          // 最大 token
  systemPrompt?: string;       // 系统提示词
  apiKey?: string;             // API 密钥
  baseURL?: string;            // 自定义 API 端点
  skill?: SkillConfigSection;  // Skill 配置
  mcp?: MCPConfigSection;      // MCP 配置
  security?: SecurityConfigSection;  // 安全配置
}
```

**SkillConfigSection**:

```typescript
interface SkillConfigSection {
  directories?: string[];      // 自动发现目录
  skills?: Record<string, {    // 单独 skill 配置
    path?: string;
    package?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  }>;
  autoLoad?: boolean;          // 是否自动加载
}
```

**MCPConfigSection**:

```typescript
interface MCPConfigSection {
  configPath?: string;         // MCP 配置文件路径
  autoConnect?: boolean;       // 是否自动连接
}
```

---

## 3. @ai-stack/mcp

### 3.1 createMCPClientManager() 工厂函数

管理多个 MCP 服务器连接。

#### 创建实例

```typescript
const manager = createMCPClientManager(options?: MCPClientManagerOptions): MCPClientManagerInstance
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

### 3.2 createMCPToolProvider() 工厂函数

将 MCP 工具桥接为 Agent Tool 接口。

#### 创建实例

```typescript
const provider = createMCPToolProvider(manager: MCPClientManagerInstance, options?: MCPToolBridgeOptions): MCPToolProviderInstance
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

## 4. @ai-stack/skill

### 4.1 createSkillManager() 工厂函数

管理 Skill 生命周期和状态。

#### 创建实例

```typescript
const manager = createSkillManager(options?: SkillManagerOptions): SkillManagerInstance
```

**SkillManagerOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `onStateChange` | `(skillName, state, error?) => void` | 状态变化回调 |
| `onToolsChange` | `(skillName, tools) => void` | 工具列表变化回调 |

---

#### 生命周期方法

```typescript
// 初始化配置
async initialize(config?: SkillConfig | string): Promise<void>

// 加载所有 skill
async loadAll(): Promise<void>

// 加载单个 skill
async load(skillName: string): Promise<void>

// 卸载 skill
async unload(skillName: string): Promise<void>

// 激活 skill
async activate(skillName: string): Promise<void>

// 停用 skill
async deactivate(skillName: string): Promise<void>

// 关闭所有
async close(): Promise<void>
```

---

#### 目录发现

```typescript
// 发现并加载目录中的 skills
async discoverAndLoad(directory: string): Promise<void>
```

---

#### 工具方法

```typescript
// 获取所有工具
getTools(): AgentTool[]

// 获取特定 skill 的工具
getToolsFromSkill(skillName: string): AgentTool[]
```

---

#### 状态查询

```typescript
// 获取 skill 名称列表
getSkillNames(): string[]

// 获取 skill 信息
getSkill(name: string): LoadedSkill | undefined

// 获取 skill 状态
getState(name: string): SkillState

// 检查是否已加载
isLoaded(name: string): boolean

// 检查是否激活
isActive(name: string): boolean
```

---

### 4.2 createSkillToolProvider() 工厂函数

将 Skill 工具桥接为 Agent Tool 接口。

#### 创建实例

```typescript
const provider = createSkillToolProvider(manager: SkillManagerInstance, options?: SkillToolBridgeOptions): SkillToolProviderInstance
```

**SkillToolBridgeOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `namePrefix` | `string` | 工具名前缀，如 `"skill_"` |
| `includeSkillName` | `boolean` | 是否在名称中包含 skill 名 |
| `nameTransformer` | `(skill, tool) => string` | 自定义名称转换函数 |
| `filter` | `(skill, tool) => boolean` | 工具过滤函数 |

---

#### 方法

```typescript
// 获取所有桥接工具
getTools(): AgentTool[]

// 获取特定 skill 的工具
getToolsFromSkill(skillName: string): AgentTool[]

// 刷新工具列表
async refresh(): Promise<void>

// 查找工具
findTool(name: string): BridgedSkillTool | undefined
```

---

### 4.3 配置函数

```typescript
// 加载配置文件
async loadConfig(configPath: string): Promise<SkillConfig>

// 从默认位置加载配置
async loadConfigFromDefaults(startDir?: string): Promise<SkillConfig | null>

// 发现目录中的 skills
async discoverSkills(directory: string): Promise<Array<{
  name: string;
  path: string;
  definition: SkillDefinition;
}>>
```

---

### 4.4 Skill 类型定义

```typescript
// Skill 状态
type SkillState = 'unloaded' | 'loading' | 'loaded' | 'active' | 'error';

// Skill 配置文件
interface SkillConfig {
  skills: Record<string, SkillEntry>;
  autoLoad?: boolean;
}

interface SkillEntry {
  path?: string;      // 本地路径
  package?: string;   // npm 包名
  enabled?: boolean;  // 是否启用
  config?: Record<string, unknown>; // skill 特定配置
}

// Skill 定义 (skill.json)
interface SkillDefinition {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tools?: SkillToolDefinition[];
  prompts?: SkillPromptDefinition[];
  resources?: SkillResourceDefinition[];
  hooks?: {
    onLoad?: string;
    onActivate?: string;
    onDeactivate?: string;
    onUnload?: string;
  };
  dependencies?: string[];
}

// Skill 工具定义
interface SkillToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: string;  // 如 './handlers.js#myTool'
}

// 已加载的 Skill
interface LoadedSkill {
  name: string;
  definition: SkillDefinition;
  state: SkillState;
  path: string;
  tools: ResolvedTool[];
  error?: Error;
}

// 桥接的工具
interface BridgedSkillTool extends AgentTool {
  skillName: string;
  originalToolName: string;
}
```

---

### 4.5 错误类

```typescript
class SkillError extends Error {
  code: string;
  skillName?: string;
}

class SkillConfigurationError extends SkillError {}
class SkillLoadError extends SkillError {}
class SkillHandlerError extends SkillError {}
class SkillToolExecutionError extends SkillError {}
class SkillNotFoundError extends SkillError {}
```

---

## 5. @ai-stack/memory

### 5.1 createMemoryManager() 工厂函数

管理五层记忆存储和检索。

#### 创建实例

```typescript
const manager = createMemoryManager(config?: Partial<MemoryConfig>): MemoryManagerInstance
```

**MemoryConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `dbPath` | `string` | `memory/sqlite.db` | SQLite 数据库路径 |
| `tokenBudget` | `TokenBudget` | 默认配置 | Token 预算配置 |
| `writePolicy` | `WritePolicyConfig` | 默认配置 | 写入策略配置 |
| `retrieval` | `RetrievalConfig` | 默认配置 | 检索配置 |
| `debug` | `boolean` | `false` | 调试模式 |

---

#### 生命周期方法

```typescript
// 初始化
async initialize(): Promise<void>

// 关闭
async close(): Promise<void>
```

---

#### 事件操作

```typescript
// 记录事件
async recordEvent(event: EventInput): Promise<MemoryEvent>

// 批量记录事件
async recordEvents(events: EventInput[]): Promise<MemoryEvent[]>

// 订阅事件
onEvent(callback: ObserverCallback): () => void

// 获取 Observer
getObserver(): IMemoryObserver
```

**EventInput**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `type` | `EventType` | 事件类型 |
| `summary` | `string` | 事件摘要 |
| `payload` | `Record<string, unknown>` | 事件数据 |
| `sessionId` | `string` | 会话 ID |
| `tags` | `string[]` | 标签 |
| `entities` | `EventEntity[]` | 提取的实体 |

**EventType**:

- `USER_MSG` - 用户消息
- `ASSISTANT_MSG` - 助手回复
- `TOOL_CALL` - 工具调用
- `TOOL_RESULT` - 工具结果
- `DECISION` - 重要决策
- `STATE_CHANGE` - 状态变更
- `ERROR` - 错误事件

---

#### 任务操作

```typescript
// 创建任务
async createTask(task: Omit<TaskState, 'id' | 'version' | 'updatedAt'>): Promise<TaskState>

// 更新任务
async updateTask(id: UUID, update: TaskStateUpdate): Promise<TaskState>

// 获取当前任务
async getCurrentTask(sessionId?: string): Promise<TaskState | null>
```

**TaskState**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | `UUID` | 任务 ID |
| `goal` | `string` | 任务目标 |
| `status` | `TaskStatus` | 任务状态 |
| `constraints` | `TaskConstraint[]` | 约束条件 |
| `plan` | `PlanStep[]` | 计划步骤 |
| `done` | `string[]` | 已完成步骤 ID |
| `blocked` | `string[]` | 被阻塞步骤 ID |
| `nextAction` | `string` | 下一步操作 |
| `version` | `number` | 版本号 (乐观锁) |

---

#### Profile 操作

```typescript
// 设置偏好
async setProfile(item: ProfileItemInput): Promise<ProfileItem>

// 获取偏好
async getProfile(key: string): Promise<ProfileItem | null>

// 获取所有偏好
async getAllProfiles(): Promise<ProfileItem[]>
```

**ProfileItem**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `key` | `string` | 偏好键 |
| `value` | `unknown` | 偏好值 |
| `confidence` | `number` | 置信度 (0-1) |
| `explicit` | `boolean` | 是否显式设置 |
| `sourceEventId` | `UUID` | 来源事件 ID |

---

#### 语义检索

```typescript
// 添加语义块
async addChunk(chunk: SemanticChunkInput): Promise<SemanticChunk>

// 搜索语义块
async searchChunks(
  query: string,
  options?: {
    tags?: string[];
    sessionId?: string;
    limit?: number;
  }
): Promise<SemanticSearchResult[]>
```

---

#### 记忆检索与注入

```typescript
// 检索记忆 Bundle
async retrieve(options?: {
  sessionId?: string;
  query?: string;
  taskId?: UUID;
}): Promise<MemoryBundle>

// 注入 Bundle 到 Prompt
inject(bundle: MemoryBundle, options?: { template?: string }): string
```

**MemoryBundle**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `profile` | `ProfileItem[]` | 用户偏好 |
| `taskState` | `TaskState` | 当前任务状态 |
| `recentEvents` | `MemoryEvent[]` | 最近事件 |
| `retrievedChunks` | `SemanticSearchResult[]` | 检索的语义块 |
| `summary` | `Summary` | 对话摘要 |
| `warnings` | `MemoryWarning[]` | 警告信息 |
| `totalTokens` | `number` | 总 token 数 |

---

#### 会话管理

```typescript
// 设置会话 ID
setSessionId(sessionId: string): void

// 获取会话 ID
getSessionId(): string

// 创建新会话
newSession(): string
```

---

#### Embedding 配置

```typescript
// 设置 Embedding 函数 (启用自动混合搜索)
setEmbedFunction(fn: EmbedFunction): void

// 检查是否设置了 Embedding 函数
hasEmbedFunction(): boolean

// 检查向量搜索是否可用
isVectorSearchEnabled(): boolean

// 获取 SemanticStore 进行高级操作
getSemanticStore(): SemanticStoreInstance
```

**EmbedFunction**:

```typescript
type EmbedFunction = (text: string) => Promise<number[]>;
```

**使用示例**:

```typescript
// 使用 @ai-stack/provider
const client = createOpenAIClient();
memory.setEmbedFunction(async (text) => {
  const result = await client.embed(text);
  return result[0].embedding;
});

// 或使用 OpenAI SDK
const openai = new OpenAI();
memory.setEmbedFunction(async (text) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
});
```

设置 `setEmbedFunction()` 后：
- `addChunk()` 会自动生成 embedding
- `searchChunks()` 会自动使用混合搜索 (FTS + Vector)
- 默认权重: FTS 0.3, Vector 0.7

---

### 5.2 createMemoryObserver() 工厂函数

事件创建辅助函数。

```typescript
// 创建用户消息事件
createUserMessageEvent(content: string): EventInput

// 创建助手消息事件
createAssistantMessageEvent(content: string): EventInput

// 创建工具调用事件
createToolCallEvent(name: string, args: Record<string, unknown>): EventInput

// 创建工具结果事件
createToolResultEvent(name: string, result: string, parentId?: string): EventInput

// 创建决策事件
createDecisionEvent(decision: string, reasoning?: string): EventInput
```

---

### 5.3 TaskStateReducer (纯函数)

不可变任务状态更新。

```typescript
// 应用 action
reduce(state: TaskState, action: TaskAction): ReducerResult

// 检查是否完成
isCompleted(state: TaskState): boolean

// 获取进度百分比
getProgress(state: TaskState): number

// 获取下一步
getNextStep(state: TaskState): TaskStep | null

// 验证状态
validate(state: TaskState): string[]
```

**TaskActions**:

```typescript
TaskActions.setGoal(goal: string)
TaskActions.setStatus(status: TaskStatus)
TaskActions.addStep(step: TaskStep)
TaskActions.updateStep(stepId: string, updates: Partial<TaskStep>)
TaskActions.completeStep(stepId: string, result?: string)
TaskActions.blockStep(stepId: string, reason: string)
TaskActions.unblockStep(stepId: string)
TaskActions.addConstraint(constraint: TaskConstraint)
TaskActions.removeConstraint(constraintId: string)
TaskActions.resetProgress()
TaskActions.batch(...actions: TaskAction[])
```

---

### 5.4 Store 工厂函数

#### createEventStore()

```typescript
// 添加事件
async add(event: EventInput): Promise<MemoryEvent>

// 批量添加
async addBatch(events: EventInput[]): Promise<MemoryEvent[]>

// 获取事件
async get(id: UUID): Promise<MemoryEvent | null>

// 查询事件
async query(options: EventQueryOptions): Promise<MemoryEvent[]>

// 获取最近事件
async getRecent(limit: number, sessionId?: string): Promise<MemoryEvent[]>

// 删除事件
async delete(id: UUID): Promise<boolean>

// 批量删除
async deleteBatch(ids: UUID[]): Promise<number>

// 按会话删除
async deleteBySession(sessionId: string): Promise<number>

// 按时间删除
async deleteBeforeTimestamp(timestamp: number): Promise<number>
```

#### createTaskStateStore()

```typescript
// 创建任务
async create(task): Promise<TaskState>

// 更新任务 (幂等)
async update(id: UUID, update: TaskStateUpdate): Promise<TaskState>

// 回滚版本
async rollback(taskId: UUID, version: number): Promise<TaskState>

// 获取快照
async getSnapshots(taskId: UUID, limit?: number): Promise<TaskStateSnapshot[]>
```

#### createSemanticStore()

```typescript
// 全文搜索
async searchFts(query: string, options?): Promise<SemanticSearchResult[]>

// 向量搜索
async searchVector(embedding: number[], options?): Promise<SemanticSearchResult[]>

// 混合搜索
async search(query: string, options?): Promise<SemanticSearchResult[]>
```

---

### 5.5 配置类型

**TokenBudget**:

```typescript
interface TokenBudget {
  profile: number;        // 默认 200
  taskState: number;      // 默认 300
  recentEvents: number;   // 默认 500
  semanticChunks: number; // 默认 800
  summary: number;        // 默认 400
  total: number;          // 默认 2200
}
```

**WritePolicyConfig**:

```typescript
interface WritePolicyConfig {
  minConfidence: number;        // 最小置信度
  autoSummarize: boolean;       // 自动摘要
  summarizeEveryNEvents: number; // 每 N 事件触发摘要
  summarizeTokenThreshold: number; // Token 阈值
  profileKeyWhitelist: string[] | null; // Profile 键白名单
  conflictStrategy: 'latest' | 'confidence' | 'explicit' | 'manual';
  timeDecayFactor: number;      // 时间衰减因子
  staleThresholdMs: number;     // 陈旧阈值
}
```

---

### 5.6 错误类

```typescript
class MemoryError extends Error {
  code: string;
}

class DatabaseError extends MemoryError {}
class EventRecordError extends MemoryError {}
class TaskStateConflictError extends MemoryError {}
class ProfileKeyNotAllowedError extends MemoryError {}
class RetrievalError extends MemoryError {}
```

---

## 6. 类型导出

### 从 @ai-stack/provider 导出

```typescript
export {
  // 工厂函数
  createOpenAIClient,
  type OpenAIClientInstance,

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

### 从 @ai-stack/agent 导出

```typescript
export {
  // 工厂函数
  createAgent,
  type AgentInstance,

  // 配置函数
  loadConfig,
  findConfigFile,
  toAgentConfig,
  generateConfigTemplate,
  serializeConfig,

  // 类型
  type AgentConfig,
  type AgentStackConfig,
  type SkillConfigSection,
  type MCPConfigSection,
  type SecurityConfigSection,
  type LoadConfigResult,
  type Tool,
  type AgentResponse,
  type ToolCallResult,
  type StreamCallbacks,
  type ConversationOptions,
  type Message,

  // 从 provider re-export
  createOpenAIClient,
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

### 从 @ai-stack/mcp 导出

```typescript
export {
  // 工厂函数
  createMCPClientManager,
  createMCPToolProvider,
  type MCPClientManagerInstance,
  type MCPToolProviderInstance,

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

### 从 @ai-stack/skill 导出

```typescript
export {
  // 工厂函数
  createSkillManager,
  createSkillToolProvider,
  type SkillManagerInstance,
  type SkillToolProviderInstance,

  // 配置函数
  loadConfig,
  loadConfigFromDefaults,
  findConfigFile,
  discoverSkills,
  discoverSkillsFromDefaults,
  loadSkillDefinition,

  // 加载函数
  loadSkill,
  loadSkillFromDirectory,
  loadSkillFromPackage,
  resolveToolHandler,

  // 桥接函数
  createSkillToolBridge,
  bridgeSkillTool,

  // 错误类
  SkillError,
  SkillConfigurationError,
  SkillLoadError,
  SkillHandlerError,
  SkillToolExecutionError,
  SkillNotFoundError,

  // 辅助函数
  sanitizeToolName,
  generateToolName,
  parseHandlerPath,
  formatErrorResult,

  // 类型
  type SkillState,
  type SkillConfig,
  type SkillEntry,
  type SkillDefinition,
  type SkillToolDefinition,
  type SkillPromptDefinition,
  type SkillResourceDefinition,
  type SkillHooks,
  type LoadedSkill,
  type ResolvedTool,
  type ToolHandler,
  type HookHandler,
  type SkillToolBridgeOptions,
  type BridgedSkillTool,
  type SkillManagerOptions,
  type AgentTool,
};
```

### 从 @ai-stack/memory 导出

```typescript
export {
  // 工厂函数
  createMemoryManager,
  createMemoryObserver,
  createMemoryRetriever,
  createMemoryInjector,
  createMemoryBudgeter,
  createMemorySummarizer,
  createWritePolicyEngine,
  TaskStateReducer,  // 纯函数对象
  TaskActions,

  // Store 工厂函数
  createEventStore,
  createTaskStateStore,
  createSummaryStore,
  createProfileStore,
  createSemanticStore,
  createEmbeddingCache,

  // Ranking 模块
  applyTemporalDecay,
  createTemporalDecayProcessor,
  calculateExponentialDecay,
  calculateLinearDecay,
  calculateStepDecay,
  getTemporalDecayStats,
  applyMMR,
  createMMRProcessor,
  needsDiversityReranking,
  getMMRStats,
  jaccardSimilarity,
  overlapSimilarity,
  cosineSimilarity,
  createRankingPipeline,

  // Compaction 模块
  createMemoryFlush,
  createCompactionManager,
  parseLLMFlushResponse,

  // Transcript 模块
  createSessionTranscript,
  formatTranscript,
  createTranscriptIndexer,
  createDebouncer,

  // Pipeline 模块
  createMemoryPipeline,

  // Instance 类型
  type MemoryManagerInstance,
  type IMemoryObserver,
  type IMemoryRetriever,
  type IMemoryInjector,
  type IMemoryBudgeter,
  type IMemorySummarizer,
  type IWritePolicyEngine,
  type EventStoreInstance,
  type TaskStateStoreInstance,
  type SummaryStoreInstance,
  type ProfileStoreInstance,
  type SemanticStoreInstance,
  type EmbeddingCacheInstance,

  // 错误类
  MemoryError,
  DatabaseError,
  EventRecordError,
  TaskStateConflictError,
  ProfileKeyNotAllowedError,
  RetrievalError,

  // 类型
  type MemoryConfig,
  type TokenBudget,
  type WritePolicyConfig,
  type RetrievalConfig,
  type MemoryBundle,
  type MemoryWarning,
  type MemoryEvent,
  type EventInput,
  type EventType,
  type EventEntity,
  type TaskState,
  type TaskStatus,
  type TaskStep,
  type TaskConstraint,
  type TaskStateUpdate,
  type TaskStateSnapshot,
  type TaskAction,
  type ProfileItem,
  type ProfileItemInput,
  type ProfileKey,
  type Summary,
  type SummaryInput,
  type SummaryDecision,
  type SummaryTodo,
  type SemanticChunk,
  type SemanticChunkInput,
  type SemanticSearchResult,
  type SemanticMatchType,
  type ObserverCallback,
  type UUID,
  type Timestamp,
  type TokenCount,
  type Confidence,
  type ConflictStrategy,
  // Ranking 类型
  type TemporalDecayConfig,
  type DecayedSearchResult,
  type TemporalDecayStats,
  type MMRConfig,
  type MMRSearchResult,
  type MMRStats,
  type RankingPipelineConfig,
  type EmbeddingCacheConfig,
  type EmbeddingCacheEntry,
  // Compaction 类型
  type MemoryFlushConfig,
  type FlushCheckResult,
  type FlushContent,
  type FlushResult,
  type FlushTriggerReason,
  type IMemoryFlush,
  type CompactionConfig,
  type CompactionState,
  type CompactionResult,
  type ICompactionManager,
  // Transcript 类型
  type ISessionTranscript,
  type TranscriptEntry,
  type TranscriptContent,
  type TranscriptMetadata,
  type TranscriptSearchOptions,
  type TranscriptSearchResult,
  type TranscriptChunk,
  type ITranscriptIndexer,
  type TranscriptIndexerConfig,
  type IndexedTranscript,
  type SyncResult,
  // Pipeline 类型
  type IMemoryPipeline,
  type WritePipelineConfig,
  type ReadPipelineConfig,
  type WriteInput,
  type WriteResult,
  type ReadInput,
  type ReadResult,
  type PipelineStores,

  // 常量
  PROFILE_KEYS,
  DEFAULT_TOKEN_BUDGET,
  DEFAULT_WRITE_POLICY,
  DEFAULT_RETRIEVAL_CONFIG,
  DEFAULT_MEMORY_CONFIG,
  DEFAULT_TEMPORAL_DECAY_CONFIG,
  DEFAULT_MMR_CONFIG,
  DEFAULT_EMBEDDING_CACHE_CONFIG,
  DEFAULT_MEMORY_FLUSH_CONFIG,
  DEFAULT_COMPACTION_CONFIG,
  DEFAULT_FLUSH_PROMPT,
  DEFAULT_INDEXER_CONFIG,
  DEFAULT_WRITE_CONFIG,
  DEFAULT_READ_CONFIG,
};
```

---

## 6. @ai-stack/knowledge

### 6.1 createKnowledgeManager() 工厂函数

管理代码和文档的索引与检索。

#### 创建实例

```typescript
const manager = createKnowledgeManager(config?: KnowledgeManagerConfig): KnowledgeManagerInstance
```

**KnowledgeManagerConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `dbPath` | `string` | `knowledge/sqlite.db` | 数据库路径 (包含索引状态和 SemanticStore) |
| `semantic` | `KnowledgeSemanticConfig` | - | SemanticStore 配置 (向量维度等) |
| `code` | `CodeIndexerConfig & { enabled?: boolean }` | - | 代码索引配置 |
| `doc` | `DocIndexerConfig & { enabled?: boolean }` | - | 文档索引配置 |
| `search` | `SearchConfig` | - | 搜索配置 |

**KnowledgeSemanticConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `vectorDimensions` | `number` | `1536` | 向量维度 |
| `enableVectorSearch` | `boolean` | `true` | 启用向量搜索 |
| `enableFtsSearch` | `boolean` | `true` | 启用全文搜索 |
| `embeddingProvider` | `string` | `'default'` | 嵌入提供者名称 |
| `embeddingModel` | `string` | - | 嵌入模型名称 |

---

#### 生命周期方法

```typescript
// 初始化
async initialize(): Promise<void>

// 关闭
async close(): Promise<void>
```

---

#### 搜索方法

```typescript
// 统一搜索 (代码 + 文档)
async search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>

// 搜索代码
async searchCode(query: string, options?: CodeSearchOptions): Promise<KnowledgeSearchResult[]>

// 搜索文档
async searchDocs(query: string, options?: DocSearchOptions): Promise<KnowledgeSearchResult[]>
```

**KnowledgeSearchOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `sources` | `('code' \| 'doc')[]` | 搜索的来源类型 |
| `languages` | `string[]` | 代码语言过滤 |
| `filePatterns` | `string[]` | 文件路径 glob 模式 |
| `urlPrefixes` | `string[]` | 文档 URL 前缀过滤 |
| `limit` | `number` | 结果数量限制 |
| `minScore` | `number` | 最小相关度分数 |
| `useVector` | `boolean` | 是否使用向量搜索 |
| `weights` | `{ fts: number; vector: number }` | 混合搜索权重 |

---

#### 索引方法

```typescript
// 索引代码库
async indexCode(options?: { force?: boolean }): Promise<IndexSummary>

// 爬取并索引文档
async crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary>
```

---

#### 文档源管理

```typescript
// 添加文档源
async addDocSource(input: DocSourceInput): Promise<DocSource>

// 移除文档源
async removeDocSource(sourceId: string): Promise<void>
```

**DocSourceInput**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `name` | `string` | 文档源名称 |
| `url` | `string` | 文档 URL |
| `type` | `'url' \| 'sitemap' \| 'github' \| 'local'` | 源类型 |
| `tags` | `string[]` | 标签 |
| `enabled` | `boolean` | 是否启用 |
| `crawlOptions` | `CrawlOptions` | 爬取选项 |

---

#### 统计和配置

```typescript
// 获取统计信息
async getStats(): Promise<KnowledgeStats>

// 获取 SemanticStore (用于外部访问)
getSemanticStore(): SemanticStoreInstance | undefined

// 设置 embedding 函数
setEmbedFunction(fn: EmbedFunction): void

// 启动文件监听
startWatching(): void

// 停止文件监听
stopWatching(): void
```

**KnowledgeStats**:

```typescript
interface KnowledgeStats {
  code: {
    enabled: boolean;
    totalFiles: number;
    totalChunks: number;
    lastIndexedAt?: number;
  };
  doc: {
    enabled: boolean;
    totalSources: number;
    totalPages: number;
    totalChunks: number;
    lastCrawledAt?: number;
  };
}
```

---

### 6.2 Agent Knowledge 集成

Agent 中的 Knowledge 相关方法：

```typescript
// 初始化知识库
async initializeKnowledge(): Promise<void>

// 获取知识管理器
getKnowledgeManager(): KnowledgeManagerInstance | null

// 搜索知识
async searchKnowledge(query: string, options?: {
  sources?: ('code' | 'doc')[];
  limit?: number;
}): Promise<KnowledgeSearchResult[]>

// 搜索代码
async searchCode(query: string, options?: {
  languages?: string[];
  limit?: number;
}): Promise<KnowledgeSearchResult[]>

// 搜索文档
async searchDocs(query: string, options?: {
  sourceIds?: string[];
  limit?: number;
}): Promise<KnowledgeSearchResult[]>

// 获取知识上下文 (用于 prompt 注入)
async getKnowledgeContext(query: string): Promise<string>

// 索引代码
async indexCode(options?: { force?: boolean }): Promise<IndexSummary>

// 添加文档源
async addDocSource(source: DocSourceInput): Promise<DocSource>

// 移除文档源
async removeDocSource(sourceId: string): Promise<void>

// 爬取文档
async crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary>

// 获取统计信息
async getKnowledgeStats(): Promise<KnowledgeStats>

// 关闭知识库
async closeKnowledge(): Promise<void>
```

---

### 6.3 AgentKnowledgeConfig

```typescript
interface AgentKnowledgeConfig {
  /** 是否启用 */
  enabled?: boolean;

  /** 代码索引配置 */
  code?: Partial<CodeIndexerConfig> & { enabled?: boolean };

  /** 文档索引配置 */
  doc?: Partial<DocIndexerConfig> & {
    enabled?: boolean;
    sources?: DocSourceInput[];
  };

  /** 搜索配置 */
  search?: {
    autoSearch?: boolean;    // 自动检索 (默认: true)
    autoInject?: boolean;    // 自动注入上下文 (默认: true)
    minScore?: number;       // 最小相关度 (默认: 0.3)
    maxResults?: number;     // 最大结果数 (默认: 5)
    weights?: { fts: number; vector: number };
  };

  /** 是否自动初始化 (默认: true) */
  autoInitialize?: boolean;

  /** 调试模式 */
  debug?: boolean;
}
```

---

### 6.4 用户交互类型

当检测到已有索引时，通过回调函数让用户选择操作：

```typescript
/** 用户选择的操作 */
type IndexAction =
  | 'reindex_all'   // 清除并重新索引全部
  | 'incremental'   // 仅索引新增/变更
  | 'skip';         // 跳过索引

/** 已存在的索引信息 */
interface ExistingIndexInfo {
  type: 'code' | 'doc';
  summary: {
    totalItems: number;
    totalChunks: number;
    lastUpdatedAt?: number;
    details: string;
  };
}

/** 用户决策回调 */
type OnExistingIndexCallback = (info: ExistingIndexInfo) => Promise<IndexAction>;
```

**CodeIndexerConfig 扩展字段**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `onExistingIndex` | `OnExistingIndexCallback` | 检测到已有索引时的回调 |
| `defaultAction` | `IndexAction` | 无回调时的默认行为 (默认: 'incremental') |

**DocIndexerConfig 扩展字段**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `onExistingIndex` | `OnExistingIndexCallback` | 检测到已有索引时的回调 |
| `defaultAction` | `IndexAction` | 无回调时的默认行为 (默认: 'incremental') |

---

### 6.5 持久化 Store

#### createCodeIndexStore()

代码索引状态持久化存储。

```typescript
const store = createCodeIndexStore(): CodeIndexStoreInstance
```

**CodeIndexStoreInstance 方法**:

| 方法 | 返回类型 | 描述 |
|------|----------|------|
| `setDatabase(db)` | `void` | 设置数据库实例 |
| `initialize()` | `Promise<void>` | 初始化表结构 |
| `get(filePath)` | `IndexStatus \| null` | 获取文件索引状态 |
| `set(status)` | `void` | 设置文件索引状态 |
| `delete(filePath)` | `boolean` | 删除文件索引状态 |
| `getByRootDir(rootDir)` | `IndexStatus[]` | 获取目录下所有状态 |
| `getSummary(rootDir?)` | `IndexStatusSummary` | 获取统计摘要 |
| `hasIndexedFiles(rootDir)` | `boolean` | 检查是否有已索引文件 |
| `clearByRootDir(rootDir)` | `number` | 清除目录下所有状态 |
| `clear()` | `Promise<void>` | 清除所有状态 |
| `close()` | `Promise<void>` | 关闭存储 |

#### createDocRegistryStore()

文档源和页面持久化存储。

```typescript
const store = createDocRegistryStore(): DocRegistryStoreInstance
```

**DocRegistryStoreInstance 方法**:

| 方法 | 返回类型 | 描述 |
|------|----------|------|
| `setDatabase(db)` | `void` | 设置数据库实例 |
| `initialize()` | `Promise<void>` | 初始化表结构 |
| `addSource(input)` | `DocSource` | 添加文档源 |
| `getSource(id)` | `DocSource \| undefined` | 获取文档源 |
| `getSourceByUrl(url)` | `DocSource \| undefined` | 按 URL 获取文档源 |
| `updateSource(id, update)` | `DocSource \| undefined` | 更新文档源 |
| `removeSource(id)` | `boolean` | 删除文档源 |
| `listSources()` | `DocSource[]` | 列出所有文档源 |
| `getEnabledSources()` | `DocSource[]` | 列出启用的文档源 |
| `addPage(page)` | `void` | 添加页面 |
| `getPage(id)` | `DocPage \| undefined` | 获取页面 |
| `getPageByUrl(url)` | `DocPage \| undefined` | 按 URL 获取页面 |
| `getPagesBySource(sourceId)` | `DocPage[]` | 获取文档源的所有页面 |
| `updatePage(id, update)` | `DocPage \| undefined` | 更新页面 |
| `removePage(id)` | `boolean` | 删除页面 |
| `removePagesBySource(sourceId)` | `number` | 删除文档源的所有页面 |
| `listPages()` | `DocPage[]` | 列出所有页面 |
| `getSummary()` | `DocRegistrySummary` | 获取统计摘要 |
| `hasIndexedSources()` | `boolean` | 检查是否有已索引源 |
| `clear()` | `Promise<void>` | 清除所有数据 |
| `close()` | `Promise<void>` | 关闭存储 |

---

### 6.6 从 @ai-stack/knowledge 导出

```typescript
export {
  // 工厂函数
  createKnowledgeManager,
  createCodeIndexer,
  createDocIndexer,
  createHybridSearch,
  createCodeIndexStore,
  createDocRegistryStore,

  // Instance 类型
  type KnowledgeManagerInstance,
  type CodeIndexerInstance,
  type DocIndexerInstance,
  type HybridSearchInstance,
  type CodeIndexStoreInstance,
  type DocRegistryStoreInstance,

  // 用户交互类型
  type IndexAction,
  type ExistingIndexInfo,
  type OnExistingIndexCallback,

  // 错误类
  KnowledgeError,
  CodeIndexError,
  CrawlError,
  ParseError,
  SearchError,
  ConfigError,

  // 类型
  type KnowledgeSourceType,
  type KnowledgeChunk,
  type KnowledgeSearchResult,
  type KnowledgeSearchOptions,
  type KnowledgeManagerConfig,
  type KnowledgeStats,
  type CodeBlock,
  type CodeSymbolType,
  type CodeIndexerConfig,
  type CodeSearchOptions,
  type IndexStatus,
  type IndexResult,
  type IndexSummary,
  type IndexStatusSummary,
  type DocSource,
  type DocSourceInput,
  type DocSourceType,
  type DocPage,
  type DocSection,
  type DocIndexerConfig,
  type DocSearchOptions,
  type CrawlOptions,
  type CrawlResult,
  type CrawlSummary,

  // 常量
  DEFAULT_CODE_INDEXER_CONFIG,
  DEFAULT_DOC_INDEXER_CONFIG,
};
```

---

## 7. 权限系统

### 7.1 createPermissionPolicy() 工厂函数

创建权限策略实例。

#### 创建实例

```typescript
const policy = createPermissionPolicy(config?: PermissionPolicyConfig): PermissionPolicyInstance
```

**PermissionPolicyConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `defaultLevel` | `PermissionLevel` | `'confirm'` | 默认权限级别 |
| `rules` | `PermissionRule[]` | 内置规则 | 权限规则列表 |
| `sessionMemory` | `boolean` | `true` | 是否记住会话内批准 |
| `categoryDefaults` | `Record<ToolCategory, PermissionLevel>` | 默认配置 | 分类默认权限 |
| `categoryPatterns` | `Array<{pattern, category}>` | 默认模式 | 自动分类模式 |

---

#### checkPermission()

检查工具的权限级别。

```typescript
checkPermission(toolName: string, args?: Record<string, unknown>): PermissionDecision
```

**PermissionDecision**:

```typescript
{
  level: PermissionLevel;      // 'auto' | 'confirm' | 'deny'
  matchedRule: PermissionRule | null;
  toolName: string;
  category?: ToolCategory;
}
```

---

#### requestConfirmation()

请求用户确认。

```typescript
async requestConfirmation(request: ConfirmationRequest): Promise<ConfirmationResponse>
```

**ConfirmationRequest**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `toolName` | `string` | 工具名称 |
| `args` | `Record<string, unknown>` | 工具参数 |
| `description` | `string` | 工具描述 |
| `rule` | `PermissionRule` | 匹配的规则 |
| `actionDescription` | `string` | 操作描述 |

**ConfirmationResponse**:

| 字段 | 类型 | 描述 |
|------|------|------|
| `allowed` | `boolean` | 是否允许执行 |
| `rememberForSession` | `boolean` | 记住本会话 |
| `rememberPermanently` | `boolean` | 永久记住 (添加规则) |
| `message` | `string` | 用户消息 |

---

#### 规则管理方法

```typescript
// 添加规则 (高优先级)
addRule(rule: PermissionRule): void

// 移除规则
removeRule(toolPattern: string): boolean

// 获取所有规则
getRules(): PermissionRule[]
```

---

#### 会话管理方法

```typescript
// 批准工具 (本会话)
approveForSession(toolName: string): void

// 检查是否已批准
isApprovedForSession(toolName: string): boolean

// 清除会话批准
clearSessionApprovals(): void
```

---

#### 审计日志方法

```typescript
// 获取审计日志
getAuditLog(): PermissionAuditEntry[]

// 记录审计
logAudit(entry: Omit<PermissionAuditEntry, 'timestamp'>): void

// 清除审计日志
clearAuditLog(): void
```

**PermissionAuditEntry**:

```typescript
{
  timestamp: number;
  toolName: string;
  args: Record<string, unknown>;
  decision: PermissionDecision;
  userResponse?: ConfirmationResponse;
  executed: boolean;
  result?: string;
  error?: string;
}
```

---

#### 其他方法

```typescript
// 设置确认回调
setConfirmationCallback(callback: PermissionCallback | null): void

// 获取工具分类
getToolCategory(toolName: string): ToolCategory

// 获取当前配置
getConfig(): PermissionPolicyConfig
```

---

### 7.2 Agent 权限集成

Agent 中的权限相关方法：

```typescript
// 获取权限策略实例
getPermissionPolicy(): PermissionPolicyInstance | null

// 添加权限规则
addPermissionRule(rule: PermissionRule): void

// 移除权限规则
removePermissionRule(toolPattern: string): boolean

// 设置确认回调
setPermissionCallback(callback: PermissionCallback | null): void

// 清除会话批准
clearSessionApprovals(): void

// 获取审计日志
getPermissionAuditLog(): PermissionAuditEntry[]
```

---

### 7.3 AgentPermissionConfig

```typescript
interface AgentPermissionConfig {
  /** 是否启用权限检查 */
  enabled?: boolean;
  /** 默认权限级别 */
  defaultLevel?: PermissionLevel;
  /** 权限规则 */
  rules?: PermissionRule[];
  /** 会话记忆 */
  sessionMemory?: boolean;
  /** 分类默认权限 */
  categoryDefaults?: Partial<Record<ToolCategory, PermissionLevel>>;
  /** 确认回调 */
  onConfirm?: (request: ConfirmationRequest) => Promise<ConfirmationResponse>;
  /** 拒绝回调 */
  onDeny?: (toolName: string, args: Record<string, unknown>, reason: string) => void;
  /** 执行回调 (审计) */
  onExecute?: (toolName: string, args: Record<string, unknown>, result: string, allowed: boolean) => void;
}
```

---

### 7.4 类型定义

```typescript
// 权限级别
type PermissionLevel = 'auto' | 'confirm' | 'deny';

// 工具分类
type ToolCategory = 'read' | 'write' | 'execute' | 'network' | 'git' | 'admin' | 'other';

// 权限规则
interface PermissionRule {
  tool: string;           // 工具名模式
  level: PermissionLevel; // 权限级别
  category?: ToolCategory;
  description?: string;
}

// 确认回调
type PermissionCallback = (request: ConfirmationRequest) => Promise<ConfirmationResponse>;
```

---

### 7.5 从 @ai-stack/agent 导出

```typescript
export {
  // 权限系统
  createPermissionPolicy,
  DEFAULT_RULES,
  DEFAULT_CATEGORY_PATTERNS,
  DEFAULT_PERMISSION_CONFIG,

  // 类型
  type PermissionLevel,
  type ToolCategory,
  type PermissionRule,
  type PermissionDecision,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type PermissionPolicyConfig,
  type PermissionCallback,
  type PermissionAuditEntry,
  type PermissionPolicyInstance,
};
```
