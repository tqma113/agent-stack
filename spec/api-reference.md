# API 参考

本文档提供 AI Stack 所有公共 API 的详细参考。

---

## 目录

| 包 | 描述 |
|---|------|
| [1. @ai-stack/provider](#1-ai-stackprovider) | 多模型 LLM 抽象层 |
| [2. @ai-stack/mcp](#2-ai-stackmcp) | MCP 协议支持 |
| [3. @ai-stack/skill](#3-ai-stackskill) | 技能系统 |
| [4. @ai-stack/memory-store-sqlite](#4-ai-stackmemory-store-sqlite) | SQLite 存储层 |
| [5. @ai-stack/memory](#5-ai-stackmemory) | 记忆策略层 |
| [6. @ai-stack/knowledge](#6-ai-stackknowledge) | 知识索引 |
| [7. @ai-stack/tui](#7-ai-stacktui) | 终端 UI 组件 |
| [8. @ai-stack/agent](#8-ai-stackagent) | Agent 核心 |
| [9. @ai-stack/assistant](#9-ai-stackassistant) | 个人助手 |
| [10. @ai-stack/code](#10-ai-stackcode) | 代码 Agent |

---

## 1. @ai-stack/provider

### 1.1 createProvider() 统一工厂函数 (推荐)

创建统一的多模型 Provider 实例，支持 OpenAI、Anthropic、Google Gemini 和 OpenAI 兼容 API。

#### 创建实例

```typescript
const provider = createProvider(config: ProviderConfig): ProviderInstance
```

**ProviderConfig** (联合类型):

```typescript
// OpenAI 配置
interface OpenAIProviderConfig {
  provider: 'openai';
  apiKey?: string;          // 默认 process.env.OPENAI_API_KEY
  baseURL?: string;
  organization?: string;
  project?: string;
  timeout?: number;         // 默认 60000ms
  maxRetries?: number;      // 默认 2
}

// Anthropic 配置
interface AnthropicProviderConfig {
  provider: 'anthropic';
  apiKey?: string;          // 默认 process.env.ANTHROPIC_API_KEY
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultMaxTokens?: number; // 默认 4096
}

// Google Gemini 配置
interface GoogleProviderConfig {
  provider: 'google';
  apiKey?: string;          // 默认 process.env.GOOGLE_API_KEY
  timeout?: number;
}

// OpenAI 兼容配置 (Ollama, Groq, Together.ai 等)
interface OpenAICompatibleProviderConfig {
  provider: 'openai-compatible';
  apiKey?: string;          // 默认 'ollama' (用于本地)
  baseURL?: string;         // 必需 (如 http://localhost:11434/v1)
  name?: string;            // 提供商标识
  timeout?: number;
  maxRetries?: number;
}
```

---

#### ProviderInstance 接口

```typescript
interface ProviderInstance {
  readonly type: ProviderType;
  readonly capabilities: ProviderCapabilities;

  setDefaultModel(model: string): void;
  getDefaultModel(): string;

  chat(messages: UnifiedMessage[], options?: UnifiedChatOptions): Promise<UnifiedChatResult>;
  chatStream(messages: UnifiedMessage[], options?: UnifiedStreamOptions): AsyncGenerator<string, UnifiedChatResult>;
  embed?(input: string | string[], options?: UnifiedEmbeddingOptions): Promise<UnifiedEmbeddingResult[]>;
  getNativeClient(): unknown;
}
```

---

#### chat()

创建聊天补全 (所有提供商)。

```typescript
async chat(
  messages: UnifiedMessage[],
  options?: UnifiedChatOptions
): Promise<UnifiedChatResult>
```

**UnifiedMessage**:

```typescript
type UnifiedMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: UnifiedToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };
```

**UnifiedChatOptions**:

| 参数 | 类型 | 描述 |
|------|------|------|
| `model` | `string` | 使用的模型 |
| `temperature` | `number` | 温度 (0-2) |
| `maxTokens` | `number` | 最大输出 token |
| `topP` | `number` | Top-p 采样 |
| `stop` | `string \| string[]` | 停止序列 |
| `tools` | `UnifiedTool[]` | 可用工具 |
| `toolChoice` | `'none' \| 'auto' \| 'required' \| {...}` | 工具选择策略 |
| `responseFormat` | `{ type: 'text' \| 'json_object' }` | 响应格式 |
| `seed` | `number` | 随机种子 |
| `user` | `string` | 用户标识 |

**UnifiedChatResult**:

```typescript
{
  id: string;
  content: string | null;
  toolCalls?: UnifiedToolCall[];
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

流式聊天补全 (所有提供商)。

```typescript
async *chatStream(
  messages: UnifiedMessage[],
  options?: UnifiedStreamOptions
): AsyncGenerator<string, UnifiedChatResult, unknown>
```

**UnifiedStreamOptions** (继承 UnifiedChatOptions):

| 参数 | 类型 | 描述 |
|------|------|------|
| `onToken` | `(token: string) => void` | 每个 token 的回调 |
| `onToolCall` | `(toolCall: Partial<UnifiedToolCall>) => void` | 工具调用回调 |
| `signal` | `AbortSignal` | 取消信号 |

---

#### embed()

创建文本嵌入 (仅 OpenAI 和 Google 支持)。

```typescript
async embed?(
  input: string | string[],
  options?: UnifiedEmbeddingOptions
): Promise<UnifiedEmbeddingResult[]>
```

---

#### 使用示例

```typescript
import { createProvider } from '@ai-stack/provider';

// OpenAI
const openai = createProvider({ provider: 'openai' });
openai.setDefaultModel('gpt-4o');

// Anthropic
const claude = createProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
});
claude.setDefaultModel('claude-3-5-sonnet-20241022');

// Google Gemini
const gemini = createProvider({
  provider: 'google',
  apiKey: process.env.GOOGLE_API_KEY,
});
gemini.setDefaultModel('gemini-1.5-pro');

// Ollama (本地)
const ollama = createProvider({
  provider: 'openai-compatible',
  baseURL: 'http://localhost:11434/v1',
});
ollama.setDefaultModel('llama3.2');

// 统一调用
const result = await provider.chat([
  { role: 'user', content: 'Hello!' }
], { temperature: 0.7 });
```

---

### 1.2 createOpenAIClient() 工厂函数 (传统 API)

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
| `toolExecution` | `ToolExecutionConfig` | - | 工具执行配置 (并行/超时) |
| `telemetry` | `TelemetryConfig` | - | 遥测/可观测性配置 |
| `stopConditions` | `StopConditions` | - | 停止条件配置 |
| `planning` | `PlanningConfig` | - | 规划/透明度配置 |
| `superLoop` | `SuperLoopConfig` | - | Super Loop 配置 (无限循环) |
| `selfReflection` | `AgentSelfReflectionConfig` | - | 自我反思配置 |
| `compaction` | `AgentCompactionConfig` | - | 上下文压缩配置 |
**SuperLoopConfig** (Super Agent 增强):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `infiniteLoop` | `boolean` | `false` | 启用无限循环模式 |
| `qualityThreshold` | `number` | `0.7` | 任务完成质量阈值 |
| `detectTaskCompletion` | `boolean` | `true` | 启用任务完成检测 |
| `completionPatterns` | `(string \| RegExp)[]` | 默认模式 | 完成模式匹配 |
| `checkpointInterval` | `number` | `5` | 检查点创建间隔 |
| `enableProgressReporting` | `boolean` | `true` | 启用进度报告 |

**AgentSelfReflectionConfig** (Super Agent 增强):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 启用自我反思 |
| `passThreshold` | `number` | `0.7` | 通过阈值 |
| `maxRetries` | `number` | `1` | 最大重试次数 |
| `enableSelfCheck` | `boolean` | `true` | 启用一致性自检 |
| `evalModel` | `string` | - | 评估使用的模型 |
| `includeFeedback` | `boolean` | `true` | 重试时包含反馈 |

**AgentCompactionConfig** (Super Agent 增强):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 启用自动压缩 |
| `softThreshold` | `number` | `0.6` | 软阈值 (警告) |
| `hardThreshold` | `number` | `0.8` | 硬阈值 (压缩) |
| `maxContextTokens` | `number` | `128000` | 最大上下文 tokens |
| `reserveTokens` | `number` | `4000` | 预留响应 tokens |
| `onCompaction` | `(result) => void` | - | 压缩完成回调 |

**ToolExecutionConfig** (新增):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxConcurrentTools` | `number` | `Infinity` | 最大并发工具数 |
| `toolTimeout` | `number` | `30000` | 单个工具超时 (ms) |
| `parallelExecution` | `boolean` | `true` | 是否并行执行工具 |

**TelemetryConfig** (新增):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用事件发射 |
| `onEvent` | `AgentEventListener` | - | 事件监听回调 |
| `logLevel` | `'none' \| 'error' \| 'warn' \| 'info' \| 'debug'` | `'none'` | 日志级别 |

**StopConditions** (新增，基于 Anthropic 最佳实践):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `maxIterations` | `number` | `10` | 最大 LLM 调用迭代 |
| `maxToolCalls` | `number` | - | 最大工具调用次数 |
| `maxTotalTokens` | `number` | - | 最大总 token 数 |
| `maxCompletionTokens` | `number` | - | 最大输出 token 数 |
| `maxDurationMs` | `number` | `300000` | 最大执行时间 (5分钟) |
| `maxCost` | `number` | - | 最大成本 (USD) |
| `pricing` | `{ promptTokenCost, completionTokenCost }` | - | 定价配置 |
| `stopPatterns` | `(string \| RegExp)[]` | - | 停止模式匹配 |
| `stopOnTools` | `string[]` | - | 调用特定工具时停止 |
| `maxConsecutiveFailures` | `number` | `3` | 连续失败次数限制 |
| `customCondition` | `(ctx) => boolean` | - | 自定义停止条件 |
| `onStopCondition` | `(result, ctx) => Promise<boolean>` | - | 停止条件触发回调 |
| `onProgress` | `(ctx) => void` | - | 进度回调 |

**PlanningConfig** (新增，透明度支持):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用规划 |
| `mode` | `'implicit' \| 'explicit' \| 'tool'` | `'implicit'` | 规划模式 |
| `showPlanBeforeExecution` | `boolean` | `false` | 执行前显示计划 |
| `requireApproval` | `boolean` | `false` | 需要用户批准 |
| `allowDynamicReplanning` | `boolean` | `true` | 允许动态调整计划 |
| `planningPrompt` | `string` | - | 自定义规划提示词 |

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

**AgentStateMachineConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用状态机 |
| `checkpointPath` | `string` | - | 检查点存储路径 |
| `autoCheckpoint` | `boolean` | `false` | 是否自动检查点 |
| `checkpointInterval` | `number` | `5` | 检查点间隔 (步数) |
| `onStateChange` | `(state, transition) => void` | - | 状态变化回调 |

**AgentRecoveryConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用恢复策略 |
| `maxRetries` | `number` | `3` | 最大重试次数 |
| `backoffStrategy` | `'none' \| 'fixed' \| 'linear' \| 'exponential' \| 'fibonacci'` | `'exponential'` | 退避策略 |
| `initialDelayMs` | `number` | `1000` | 初始延迟 |
| `maxDelayMs` | `number` | `30000` | 最大延迟 |
| `circuitBreaker` | `{ failureThreshold, resetTimeoutMs }` | - | 熔断器配置 |
| `onError` | `(error, operation, attempt) => void` | - | 错误回调 |
| `onRecovered` | `(error, operation, attempt) => void` | - | 恢复回调 |

**AgentGuardrailConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Guardrail |
| `enableBuiltInRules` | `boolean` | `true` | 启用内置规则 |
| `blockOnViolation` | `boolean` | `true` | 违规时阻止 |
| `onViolation` | `(ruleId, message, content) => void` | - | 违规回调 |

**AgentRouterConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用模型路由 |
| `fast` | `AgentModelTier` | - | 快速模型配置 |
| `standard` | `AgentModelTier` | - | 标准模型配置 |
| `strong` | `AgentModelTier` | - | 强力模型配置 |
| `costOptimization` | `boolean` | `false` | 成本优化 |
| `dailyCostLimit` | `number` | - | 每日成本限制 |
| `onCostWarning` | `(totalCost, limit) => void` | - | 成本警告回调 |
| `onCostLimitReached` | `(totalCost) => void` | - | 成本限制达到回调 |

**AgentMetricsConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用指标收集 |
| `retentionPeriodMs` | `number` | `3600000` | 保留时间 |
| `onExport` | `(metrics) => void` | - | 导出回调 |
| `autoExportIntervalMs` | `number` | - | 自动导出间隔 |
| `alerts` | `AlertCondition[]` | - | 告警条件 |
| `onAlert` | `(alert) => void` | - | 告警回调 |

**AgentEvaluatorConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用评估器 |
| `passThreshold` | `number` | `0.7` | 通过阈值 |
| `maxRetries` | `number` | `1` | 最大重试 |
| `useLLMEval` | `boolean` | `false` | 使用 LLM 评估 |
| `evalModel` | `string` | - | 评估模型 |
| `enableSelfCheck` | `boolean` | `false` | 启用自检 |

**AgentPlannerConfig** (架构模块):

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用规划器 |
| `mode` | `'react' \| 'plan-execute' \| 'hybrid'` | `'react'` | 规划模式 |
| `maxSteps` | `number` | `10` | 最大步骤数 |
| `allowDynamicReplanning` | `boolean` | `true` | 允许动态重规划 |
| `model` | `string` | - | 规划模型 |

---

#### 架构模块方法 (AgentInstance)

```typescript
// State Machine (Orchestrator layer)
getStateMachine(): StateMachineInstance | null
getAgentState(): AgentState | null
pauseExecution(): void
resumeExecution(): void
createCheckpoint(name?: string): Promise<string | null>
restoreCheckpoint(checkpointId: string): Promise<boolean>

// Recovery Policy
getRecoveryPolicy(): RecoveryPolicyInstance | null

// Metrics (Observability layer)
getMetricsAggregator(): MetricsAggregatorInstance | null
getMetrics(): AggregatedMetrics | null
resetMetrics(): void

// Guardrail (Safety layer)
getGuardrail(): GuardrailInstance | null
addGuardrailRule(rule: GuardrailRule): void
removeGuardrailRule(ruleId: string): void

// Model Router
getModelRouter(): ModelRouterInstance | null
getCostStats(): CostStats | null
resetCostStats(): void

// Evaluator
getEvaluator(): EvaluatorInstance | null

// Planner
getPlanner(): PlannerInstance | null
getCurrentPlan(): PlanDAGInstance | null
```

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

**Tool 接口** (增强版，基于 Anthropic "Poka-yoke your tools" 原则):

```typescript
interface Tool {
  // 基础字段
  name: string;                                    // 工具名称 (snake_case)
  description: string;                             // 工具描述
  parameters: Record<string, unknown>;             // JSON Schema 参数
  execute: (args: Record<string, unknown>) => Promise<string>;

  // 增强文档字段 (可选)
  examples?: ToolExample[];                        // 使用示例
  edgeCases?: string[];                            // 边界情况说明
  hints?: string[];                                // 使用提示
  returnFormat?: string;                           // 返回格式说明
  constraints?: string[];                          // 约束条件
  relatedTools?: string[];                         // 相关工具
  antiPatterns?: string[];                         // 何时不使用此工具
}

interface ToolExample {
  input: Record<string, unknown>;                  // 示例输入
  output: string;                                  // 示例输出
  description?: string;                            // 示例说明
}
```

**工具文档生成器**:

```typescript
import { generateToolDescription, toolToFunctionDef } from '@ai-stack/agent';

// 生成增强的工具描述
const description = generateToolDescription(tool);

// 转换为 OpenAI 函数定义
const functionDef = toolToFunctionDef(tool, true);  // enhanced=true
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

**StreamCallbacks** (增强版，支持透明度):

```typescript
{
  // 基础回调
  onToken?: (token: string) => void;
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
  onComplete?: (response: AgentResponse) => void;
  onError?: (error: Error) => void;

  // 透明度回调 (新增)
  onThinkingStart?: () => void;
  onThinking?: (thought: string, category?: 'analysis' | 'planning' | 'decision' | 'reflection') => void;
  onThinkingEnd?: (summary?: string) => void;
  onPlan?: (plan: AgentPlan) => void;
  onPlanStepStart?: (step: PlanStep) => void;
  onPlanStepComplete?: (stepId: string, result: string) => void;
  onPlanStepFail?: (stepId: string, error: string) => void;
  onPlanUpdate?: (update: { reason: string; steps: PlanStep[] }) => void;
}
```

**PlanStep**:

```typescript
interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  toolsToUse?: string[];
  estimatedDuration?: string;
  result?: string;
  error?: string;
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

### 2.2 工具文档生成器

基于 Anthropic "Building Effective Agents" 文章的 "Poka-yoke your tools" 原则。

#### generateToolDescription()

生成增强的工具描述，包含示例、提示、边界情况等。

```typescript
function generateToolDescription(tool: Tool): string
```

#### toolToFunctionDef()

转换为 OpenAI 函数定义。

```typescript
function toolToFunctionDef(tool: Tool, enhanced?: boolean): OpenAIFunctionDef
```

#### optimizeToolsForBudget()

优化工具描述以适应 token 预算。

```typescript
function optimizeToolsForBudget(
  tools: Tool[],
  maxTokens: number
): { tools: Tool[]; enhanced: boolean }
```

---

### 2.3 停止条件检查器

提供灵活的执行控制。

#### createStopChecker()

创建停止条件检查器实例。

```typescript
function createStopChecker(conditions?: StopConditions): StopCheckerInstance

interface StopCheckerInstance {
  check(context: ExecutionContext): Promise<StopCheckResult>;
  handleStop(result: StopCheckResult, context: ExecutionContext): Promise<boolean>;
  getElapsed(): number;
  recordFailure(failed: boolean): void;
}
```

**使用示例**:

```typescript
const checker = createStopChecker({
  maxIterations: 20,
  maxCost: 1.00,
  pricing: { promptTokenCost: 0.01, completionTokenCost: 0.03 },
  onStopCondition: async (result, ctx) => {
    console.log(`Stop condition: ${result.reason}`);
    return result.type === 'soft'; // Override soft stops
  },
});
```

---

### 2.4 计划解析器

支持透明度，从 LLM 响应中提取执行计划。

#### parsePlan()

从内容中解析 [PLAN]...[/PLAN] 块。

```typescript
function parsePlan(content: string): AgentPlan | null
```

#### createPlanTracker()

创建计划跟踪器实例。

```typescript
function createPlanTracker(): PlanTrackerInstance

interface PlanTrackerInstance {
  getPlan(): AgentPlan | null;
  setPlan(plan: AgentPlan): void;
  processContent(content: string): { stepStarted?: string; stepsCompleted: StepCompletion[] };
  getProgress(): { total: number; completed: number; failed: number; pending: number };
  isComplete(): boolean;
}
```

---

### 2.5 配置函数

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

按优先级搜索：`agent.json`、`agent.json`

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
  createProvider,
  createOpenAIClient,
  type ProviderInstance,
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

  // 错误类
  ProviderError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ModelNotFoundError,
  ContentFilterError,
  APIConnectionError,
  StreamError,

  // 类型
  type ProviderConfig,
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
  validateConfig,
  formatValidationErrors,

  // 错误类
  AIStackError,
  AgentInitError,
  AgentNotInitializedError,
  AgentIterationLimitError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderAPIError,
  ProviderTimeoutError,
  ToolNotFoundError,
  ToolExecutionError,
  ToolPermissionDeniedError,
  ConfigNotFoundError,
  ConfigValidationError,

  // 工具文档生成器 (Anthropic Poka-yoke)
  generateToolDescription,
  toolToFunctionDef,
  toolsToFunctionDefs,
  optimizeToolsForBudget,

  // 停止条件检查器
  createStopChecker,
  createExecutionContext,
  type StopCheckerInstance,

  // 计划解析器 (透明度)
  parsePlan,
  detectStepCompletion,
  detectStepStart,
  createPlanTracker,
  DEFAULT_PLANNING_PROMPT,
  type PlanTrackerInstance,

  // 类型
  type AgentConfig,
  type AgentStackConfig,
  type SkillConfigSection,
  type MCPConfigSection,
  type SecurityConfigSection,
  type LoadConfigResult,
  type Tool,
  type ToolExample,
  type AgentResponse,
  type ToolCallResult,
  type StreamCallbacks,
  type ConversationOptions,
  type Message,
  type ToolExecutionConfig,
  type TelemetryConfig,
  type StopConditions,
  type ExecutionContext,
  type StopCheckResult,
  type PlanningConfig,
  type PlanStep,
  type AgentPlan,
  type AgentEvent,
  type AgentEventType,
  type AgentEventListener,

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

---

## 8. @ai-stack/assistant

### 8.1 Markdown Memory

`@ai-stack/assistant` 提供基于 Markdown 文件的持久化记忆系统，支持 BM25 全文搜索和可选的向量语义搜索。

#### createMarkdownMemory() 工厂函数

```typescript
const memory = createMarkdownMemory(config: MarkdownMemoryConfig): MarkdownMemoryInstance
```

**MarkdownMemoryConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用记忆系统 |
| `memoryFile` | `string` | `'MEMORY.md'` | 记忆文件路径 |
| `logsDir` | `string` | `'memory'` | 日志目录路径 |
| `dbPath` | `string` | `'index.db'` | SQLite 索引路径 |
| `syncOnStartup` | `boolean` | `true` | 启动时同步 |
| `watchFiles` | `boolean` | `true` | 监听文件变化 |
| `enableVectorSearch` | `boolean` | `false` | 启用向量搜索 |
| `embeddingProvider` | `'openai' \| 'google' \| 'openai-compatible'` | `'openai'` | Embedding 提供者 |
| `embeddingModel` | `string` | `'text-embedding-3-small'` | Embedding 模型 |
| `vectorDimensions` | `number` | `1536` | 向量维度 |
| `embeddingBaseURL` | `string` | - | 自定义 API 端点 |
| `searchWeights` | `{ fts: number; vector: number }` | `{ fts: 0.3, vector: 0.7 }` | 混合搜索权重 |

---

#### 搜索方法

```typescript
// BM25 全文搜索
async search(query: string, options?: MemoryQueryOptions): Promise<MemorySearchResult[]>

// 混合搜索 (BM25 + 向量)
async searchHybrid(query: string, options?: HybridSearchOptions): Promise<MemorySearchResult[]>
```

**HybridSearchOptions**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `mode` | `'bm25' \| 'vector' \| 'hybrid'` | `'hybrid'` | 搜索模式 |
| `weights` | `{ fts: number; vector: number }` | 配置默认 | 混合搜索权重 |
| `limit` | `number` | `10` | 最大结果数 |
| `types` | `('fact' \| 'todo' \| 'log' \| 'note')[]` | 全部 | 过滤类型 |
| `minScore` | `number` | - | 最小分数阈值 |

**MemorySearchResult**:

```typescript
{
  type: 'fact' | 'todo' | 'log' | 'note';
  content: string;
  score: number;
  source: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}
```

---

#### 向量搜索配置

```typescript
// 设置自定义 Embedding 函数
setEmbedFunction(fn: EmbedFunction): void

// 检查向量搜索是否就绪
isVectorSearchReady(): boolean

// 获取 SemanticStore (高级用法)
getSemanticStore(): SemanticStoreInstance | null
```

**EmbedFunction**:

```typescript
type EmbedFunction = (text: string) => Promise<number[]>;
```

---

#### 使用示例

```typescript
import { createMarkdownMemory } from '@ai-stack/assistant';

// 纯 BM25 模式
const memory = createMarkdownMemory({
  memoryFile: './MEMORY.md',
  dbPath: './index.db',
});

await memory.initialize();
const results = await memory.search('user preferences');

// 启用混合搜索
const hybridMemory = createMarkdownMemory({
  memoryFile: './MEMORY.md',
  dbPath: './index.db',
  enableVectorSearch: true,
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',
  searchWeights: { fts: 0.3, vector: 0.7 },
});

await hybridMemory.initialize();

// 混合搜索 (自动选择最佳模式)
const hybridResults = await hybridMemory.searchHybrid('what does the user like');

// 强制向量模式
const vectorResults = await hybridMemory.searchHybrid('semantic query', {
  mode: 'vector',
  limit: 5,
});
```

---

#### CLI 搜索命令

```bash
# BM25 搜索
ai-assistant memory search "query" --mode bm25

# 向量搜索
ai-assistant memory search "query" --mode vector

# 混合搜索 (默认)
ai-assistant memory search "query" --mode hybrid

# 限制结果数
ai-assistant memory search "query" -n 5
```

---

### 8.2 配置示例

```json
{
  "memory": {
    "enabled": true,
    "enableVectorSearch": true,
    "embeddingProvider": "openai",
    "embeddingModel": "text-embedding-3-small",
    "vectorDimensions": 1536,
    "searchWeights": {
      "fts": 0.3,
      "vector": 0.7
    }
  }
}
```

---

### 8.3 createAssistant() 工厂函数

创建 Assistant 实例，支持双层记忆架构和知识索引。

```typescript
import { createAssistant, type AssistantInstance } from '@ai-stack/assistant';

const assistant = createAssistant(config?: AssistantConfig | string): AssistantInstance
```

**AssistantConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `name` | `string` | `'Assistant'` | 助手名称 |
| `agent` | `AgentConfigSection` | - | 底层 Agent 配置 |
| `memory` | `MarkdownMemoryConfig` | `{ enabled: true }` | Markdown Memory 配置 |
| `agentMemory` | `AgentMemoryConfigSection` | `{ enabled: true }` | Agent Memory 配置 |
| `agentKnowledge` | `AgentKnowledgeConfigSection` | `{ enabled: false }` | Agent Knowledge 配置 |
| `gateway` | `GatewayConfig` | - | 多通道网关配置 |
| `scheduler` | `SchedulerConfig` | - | 调度器配置 |

**AgentMemoryConfigSection**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用 Agent Memory |
| `dbPath` | `string` | `'memory/agent.db'` | SQLite 数据库路径 |
| `syncFromMarkdown` | `boolean` | `true` | 是否从 Markdown 同步 |
| `debug` | `boolean` | `false` | 调试模式 |

**AgentKnowledgeConfigSection**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Knowledge |
| `dbPath` | `string` | `'knowledge/sqlite.db'` | SQLite 数据库路径 |
| `code.enabled` | `boolean` | `true` | 启用代码索引 |
| `code.autoIndex` | `boolean` | `false` | 自动索引代码 |
| `doc.enabled` | `boolean` | `true` | 启用文档索引 |
| `doc.autoIndex` | `boolean` | `false` | 自动索引文档 |

---

#### AssistantInstance 方法

**基础方法**:

```typescript
// 初始化
async initialize(options?: InitializeOptions): Promise<void>

// 关闭
async close(): Promise<void>

// 对话
async chat(input: string): Promise<string>

// 流式对话
async stream(input: string, onToken?: (token: string) => void): Promise<string>
```

**获取器方法**:

```typescript
// 获取底层 Agent
getAgent(): AgentInstance

// 获取 Markdown Memory
getMemory(): MarkdownMemoryInstance | null

// 获取 Agent Memory Manager
getAgentMemory(): MemoryManagerInstance | null

// 获取 Knowledge Manager
getKnowledge(): KnowledgeManagerInstance | null

// 获取配置
getConfig(): AssistantConfig

// 获取名称
getName(): string
```

**Agent Memory 方法**:

```typescript
// 检索 Agent Memory bundle
async retrieveAgentMemory(query?: string): Promise<MemoryBundle | null>

// 获取 Agent Memory 上下文字符串
async getAgentMemoryContext(query?: string): Promise<string>

// 手动触发 Markdown → Agent Memory 同步
async syncMarkdownToAgentMemory(): Promise<SyncResult | null>
```

**Knowledge 方法**:

```typescript
// 搜索知识库
async searchKnowledge(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>

// 手动索引代码
async indexCode(options?: { force?: boolean }): Promise<IndexSummary | null>

// 添加文档源
async addDocSource(source: DocSourceInput): Promise<void>

// 手动爬取文档
async crawlDocs(options?: { force?: boolean }): Promise<CrawlSummary | null>

// 获取知识库统计
async getKnowledgeStats(): Promise<KnowledgeStats | null>
```

---

#### 使用示例

```typescript
import { createAssistant, loadConfig } from '@ai-stack/assistant';

// 从配置文件加载
const { config } = loadConfig('./assistant.json');
const assistant = createAssistant(config);

await assistant.initialize();

// 使用 Agent Memory
const agentMemory = assistant.getAgentMemory();
if (agentMemory) {
  const context = await assistant.getAgentMemoryContext('user preferences');
  console.log('Memory context:', context);
}

// 使用 Knowledge (如果启用)
const knowledge = assistant.getKnowledge();
if (knowledge) {
  await assistant.indexCode({ force: true });
  const results = await assistant.searchKnowledge('useEffect hook');
  console.log('Search results:', results);
}

// 对话
const response = await assistant.chat('What are my preferences?');
console.log(response);

await assistant.close();
```

---

### 8.4 从 @ai-stack/assistant 导出

```typescript
export {
  // Assistant 工厂函数
  createAssistant,
  type AssistantInstance,
  type InitializeOptions,

  // 配置
  loadConfig,
  loadConfigFile,
  findConfigFile,
  resolveConfig,
  getDefaultConfig,
  type AssistantConfig,
  type AgentConfigSection,

  // Memory 工厂函数
  createMarkdownMemory,
  type MarkdownMemoryInstance,

  // 搜索辅助函数
  mergeHybridResults,
  mergeWithRRF,

  // 类型
  type MarkdownMemoryConfig,
  type AgentMemoryConfigSection,
  type AgentKnowledgeConfigSection,
  type MemorySearchResult,
  type MemoryQueryOptions,
  type HybridSearchOptions,
  type SearchMode,
  type SyncStatus,
  type MemoryDocument,
  type FactItem,
  type TodoItem,
  type DailyLogEntry,
};
```

---

## 9. 新增 Agent 架构模块

### 9.1 状态机 (State Machine)

提供 Agent 执行状态管理，支持暂停/恢复和检查点功能。

```typescript
import { createStateMachine, type StateMachineInstance } from '@ai-stack/agent';

const stateMachine = createStateMachine({
  checkpointPath: './checkpoints',
  autoCheckpoint: true,
  checkpointInterval: 5,
  onStateChange: (state, transition) => {
    console.log(`State: ${state.status}, Transition: ${transition.type}`);
  },
});

// 状态转换
stateMachine.transition({ type: 'START', input: 'user message' });
stateMachine.transition({ type: 'PLAN_CREATED', plan: planDAGRef });
stateMachine.transition({ type: 'COMPLETE', result: 'final result' });

// 检查点操作
const checkpointId = await stateMachine.checkpoint('before_risky_op');
await stateMachine.restore(checkpointId);

// 状态订阅
const unsubscribe = stateMachine.subscribe((state) => {
  console.log('State updated:', state.status);
});
```

**AgentStatus 状态**:
- `idle` - 空闲，等待输入
- `planning` - 规划中
- `executing` - 执行中
- `waiting` - 等待用户/外部输入
- `paused` - 暂停
- `error` - 错误
- `completed` - 完成

---

### 9.2 恢复策略 (Recovery Policy)

提供错误恢复策略，支持多种退避算法和熔断器模式。

```typescript
import { createRecoveryPolicy, createApiRecoveryPolicy } from '@ai-stack/agent';

const recovery = createRecoveryPolicy({
  maxRetries: 3,
  backoffStrategy: 'exponential', // none, fixed, linear, exponential, fibonacci
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 30000,
  },
});

// 执行带恢复策略的操作
const result = await recovery.execute('api_call', async () => {
  return await fetch('/api/data');
});

// 预设配置
const apiRecovery = createApiRecoveryPolicy({ maxRetries: 3 });
const toolRecovery = createToolRecoveryPolicy({ maxRetries: 2 });
```

---

### 9.3 计划 DAG (Plan DAG)

提供 DAG 风格的任务分解和依赖管理。

```typescript
import { createPlanDAG, createPlanner, type PlanDAGInstance } from '@ai-stack/agent';

// 手动创建 DAG
const dag = createPlanDAG('Analyze and summarize document');

dag.addNode({
  id: 'step_1',
  description: 'Read the document',
  tool: 'read_file',
  args: { path: 'doc.md' },
  dependsOn: [],
  parallel: true,
});

dag.addNode({
  id: 'step_2',
  description: 'Summarize content',
  dependsOn: ['step_1'],
});

// 获取可执行的节点
const readyNodes = dag.getReadyNodes();
const parallelBatch = dag.getParallelBatch(3);

// 进度跟踪
const progress = dag.getProgress();
console.log(`Progress: ${progress.percentage}%`);

// LLM 驱动的计划生成
const planner = createPlanner(
  { mode: 'plan-execute', maxSteps: 20 },
  async (prompt) => llm.chat(prompt)
);

const plan = await planner.plan('Build a REST API', {
  availableTools: [{ name: 'write_file', description: '...' }],
});
```

---

### 9.4 评估器 (Evaluator)

提供输出质量评估和自检功能。

```typescript
import { createEvaluator, createSimpleEvaluator } from '@ai-stack/agent';

const evaluator = createEvaluator(
  {
    passThreshold: 0.7,
    useLLMEval: true,
    evalModel: 'gpt-4o-mini', // 可用更便宜的模型
    criteria: {
      accuracy: 0.3,
      completeness: 0.3,
      relevance: 0.2,
      safety: 0.2,
    },
  },
  async (prompt, model) => llm.chat(prompt, { model })
);

// 评估输出
const result = await evaluator.evaluate(output, {
  originalRequest: userQuestion,
  toolResults: [...],
});

console.log(`Score: ${result.score}, Passed: ${result.passed}`);
console.log(`Issues: ${result.issues.join(', ')}`);

// 自检
const selfCheck = await evaluator.selfCheck(response, context);
if (!selfCheck.consistent) {
  console.log('Problems:', selfCheck.problems);
}
```

---

### 9.5 模型路由器 (Model Router)

智能模型路由，基于任务类型和成本优化。

```typescript
import { createModelRouter, createOpenAIRouter, createAnthropicRouter } from '@ai-stack/agent';

const router = createModelRouter({
  fast: { model: 'gpt-4o-mini', inputCostPer1K: 0.00015, ... },
  standard: { model: 'gpt-4o', inputCostPer1K: 0.0025, ... },
  strong: { model: 'gpt-4o', inputCostPer1K: 0.0025, ... },
  costOptimization: true,
  dailyCostLimit: 10.0,
});

// 基于任务类型路由
const decision = router.route('code_generation', {
  estimatedTokens: 5000,
  canDowngrade: true,
});
console.log(`Using: ${decision.model} (${decision.tier})`);

// 基于复杂度路由
const simpleTask = router.routeByComplexity('simple');
const complexTask = router.routeByComplexity('complex');

// 成本跟踪
router.recordUsage('standard', { input: 1000, output: 500 });
const stats = router.getCostStats();
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);

// 预设配置
const openaiRouter = createOpenAIRouter({ dailyCostLimit: 5.0 });
const anthropicRouter = createAnthropicRouter({ costOptimization: true });
```

---

### 9.6 指标聚合器 (Metrics Aggregator)

收集和聚合执行指标，支持告警。

```typescript
import { createMetricsAggregator } from '@ai-stack/agent';

const metrics = createMetricsAggregator({
  enabled: true,
  retentionPeriodMs: 3600000, // 1 hour
  autoExportIntervalMs: 60000,
  onExport: (aggregated) => sendToMonitoring(aggregated),
  onAlert: (alert) => notifyTeam(alert),
  alerts: [
    { name: 'high_error_rate', metric: 'error_rate', operator: 'gt', threshold: 0.1, severity: 'critical' },
    { name: 'high_latency', metric: 'latency_p95', operator: 'gt', threshold: 5000, severity: 'warning' },
  ],
});

// 记录指标
metrics.recordLatency('chat', 1500);
metrics.recordCost('gpt-4o', 'chat', 0.05, 1000, 500);
metrics.recordToolCall('read_file', 200, true);
metrics.recordError('chat', 'rate_limit');

// 获取聚合指标
const aggregated = metrics.getMetrics();
console.log(`P95 Latency: ${aggregated.latency.p95}ms`);
console.log(`Error Rate: ${aggregated.errors.rate}`);
console.log(`Top Tools:`, aggregated.tools.topTools);

// 启动自动导出
metrics.startAutoExport();
```

---

### 9.7 Guardrail (安全检查)

提供输入/输出内容的安全检查。

```typescript
import { createGuardrail, getBuiltInRules } from '@ai-stack/agent';

const guardrail = createGuardrail({
  enableBuiltInRules: true,
  blockOnViolation: true,
  onViolation: (result, content) => {
    console.log(`Violation: ${result.ruleId} - ${result.message}`);
  },
});

// 检查输入
const inputResults = await guardrail.checkInput(userInput);
if (guardrail.shouldBlock(inputResults)) {
  throw new Error('Input blocked');
}

// 检查输出
const outputResults = await guardrail.checkOutput(agentOutput);

// 检查工具调用
const toolResults = await guardrail.checkToolCall('bash', { command: 'rm -rf /' });

// 自定义规则
guardrail.addRule({
  id: 'custom_check',
  name: 'Custom validation',
  type: 'output',
  severity: 'warn',
  check: (content) => ({
    passed: !content.includes('TODO'),
    ruleId: 'custom_check',
    message: 'Output contains TODO',
  }),
});
```

**内置规则**:
- `builtin_pii` - PII 检测 (邮箱、电话、SSN、信用卡)
- `builtin_secrets` - 密钥检测 (API keys, passwords, tokens)
- `builtin_dangerous_commands` - 危险命令检测
- `builtin_injection` - Prompt 注入检测
- `builtin_length` - 内容长度限制

---

### 9.8 子 Agent 管理器 (Sub-Agent Manager)

编排多个子 Agent 的执行。

```typescript
import { createSubAgentManager, type SubAgentConfig } from '@ai-stack/agent';

// 创建管理器
const manager = createSubAgentManager(
  (config) => createAgent({ systemPrompt: config.systemPrompt, model: config.model }),
  { maxConcurrent: 5, defaultTimeoutMs: 60000 }
);

// 注册子 Agent
manager.register({
  id: 'researcher',
  name: 'Research Agent',
  systemPrompt: 'You are a research assistant...',
  tools: ['web_search', 'read_url'],
  model: 'gpt-4o-mini',
});

manager.register({
  id: 'writer',
  name: 'Writer Agent',
  systemPrompt: 'You are a technical writer...',
  model: 'gpt-4o',
});

// 执行单个任务
const result = await manager.execute({
  agentId: 'researcher',
  input: 'Research the latest AI trends',
});

// 并行执行
const results = await manager.executeParallel([
  { agentId: 'researcher', input: 'Research topic A' },
  { agentId: 'researcher', input: 'Research topic B' },
]);

// DAG 编排
const dagResults = await manager.orchestrate({
  id: 'report_generation',
  tasks: [
    { agentId: 'researcher', input: 'Research AI trends' },
    { agentId: 'writer', input: 'Write report', dependsOn: ['task_1'] },
  ],
  edges: [{ from: 'task_1', to: 'task_2' }],
});
```

---

## 10. @ai-stack/code

### 10.1 createCodeAgent() 工厂函数

创建 Code Agent 实例，支持文件操作、搜索、Undo/Redo 和知识索引。

```typescript
import { createCodeAgent, type CodeAgentInstance } from '@ai-stack/code';

const code = createCodeAgent(config?: CodeConfig | string): CodeAgentInstance
```

**CodeConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `model` | `string` | `'gpt-4o'` | 使用的模型 |
| `temperature` | `number` | `0.7` | 温度参数 |
| `maxTokens` | `number` | `8192` | 最大 token 数 |
| `maxIterations` | `number` | `50` | 最大迭代次数 |
| `apiKey` | `string` | `process.env.OPENAI_API_KEY` | API 密钥 |
| `baseURL` | `string` | - | 自定义 API 端点 |
| `safety` | `SafetyConfig` | - | 安全配置 |
| `history` | `HistoryConfig` | - | 文件历史配置 |
| `tasks` | `TaskConfig` | - | 任务管理配置 |
| `mcp` | `MCPConfig` | - | MCP 配置 |
| `knowledge` | `CodeKnowledgeConfig` | - | 知识索引配置 |

**SafetyConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `workingDir` | `string` | `process.cwd()` | 工作目录 |
| `allowedPaths` | `string[]` | `['**/*']` | 允许的路径模式 |
| `blockedPaths` | `string[]` | `['**/node_modules/**', '**/.git/**']` | 阻止的路径模式 |
| `maxFileSize` | `number` | `1048576` | 最大文件大小 (字节) |
| `blockSecrets` | `boolean` | `true` | 阻止包含密钥的文件 |
| `confirmDestructive` | `boolean` | `true` | 确认破坏性操作 |

**CodeKnowledgeConfig**:

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `enabled` | `boolean` | `false` | 是否启用 Knowledge |
| `dbPath` | `string` | `'.ai-stack/knowledge/sqlite.db'` | 数据库路径 |
| `code.enabled` | `boolean` | `true` | 启用代码索引 |
| `code.rootDir` | `string` | `workingDir` | 代码根目录 |
| `code.autoIndex` | `boolean` | `false` | 自动索引 |
| `doc.enabled` | `boolean` | `true` | 启用文档索引 |
| `doc.autoIndex` | `boolean` | `false` | 自动索引 |
| `search.minScore` | `number` | `0.5` | 最小相关性分数 |
| `search.maxResults` | `number` | `10` | 最大结果数 |

---

#### CodeAgentInstance 方法

**基础方法**:

```typescript
// 初始化
async initialize(): Promise<void>

// 关闭
async close(): Promise<void>

// 对话
async chat(input: string): Promise<string>

// 流式对话
async stream(input: string, callbacks?: StreamCallbacks): Promise<string>

// 获取底层 Agent
getAgent(): AgentInstance

// 获取配置
getConfig(): CodeConfig

// 获取所有工具
getTools(): Tool[]

// 注册自定义工具
registerTool(tool: Tool): void
```

**Undo/Redo 方法**:

```typescript
// 撤销上一次文件更改
async undo(): Promise<UndoResult | null>

// 重做上一次撤销的更改
async redo(): Promise<RedoResult | null>

// 创建命名检查点
async createCheckpoint(name: string): Promise<void>

// 恢复到检查点
async restoreCheckpoint(name: string): Promise<void>
```

**Knowledge 方法**:

```typescript
// 获取 Knowledge Manager (如果未启用则为 null)
getKnowledge(): KnowledgeManagerInstance | null

// 搜索知识库
async searchKnowledge(query: string, options?: CodeKnowledgeSearchOptions): Promise<CodeKnowledgeSearchResult[]>

// 手动索引代码
async indexCode(options?: { force?: boolean }): Promise<CodeIndexSummary | null>

// 添加文档源
async addDocSource(source: { name: string; type: string; url: string; tags?: string[]; enabled: boolean }): Promise<void>

// 手动爬取文档
async crawlDocs(options?: { force?: boolean }): Promise<CodeCrawlSummary | null>

// 获取知识库统计
async getKnowledgeStats(): Promise<CodeKnowledgeStats | null>
```

---

#### 使用示例

```typescript
import { createCodeAgent, loadConfig } from '@ai-stack/code';

// 从配置文件加载
const { config } = loadConfig('./code.json');
const code = createCodeAgent(config);

await code.initialize();

// 基本对话
const response = await code.chat('Read the package.json file');
console.log(response);

// 流式输出
await code.stream('Explain the main function', {
  onToken: (token) => process.stdout.write(token),
  onComplete: (full) => console.log('\n--- Done ---'),
});

// Undo/Redo
await code.chat('Add a console.log to index.ts');
const undoResult = await code.undo();
console.log('Undone:', undoResult?.file_path);

// Knowledge (如果启用)
const knowledge = code.getKnowledge();
if (knowledge) {
  await code.indexCode({ force: true });
  const results = await code.searchKnowledge('error handling');
  console.log('Found:', results.length, 'matches');
}

await code.close();
```

---

### 10.2 从 @ai-stack/code 导出

```typescript
export {
  // Code Agent 工厂函数
  createCodeAgent,
  type CodeAgentInstance,

  // 配置
  loadConfig,
  loadConfigFile,
  findConfigFile,
  resolveConfig,
  getDefaultConfig,
  generateConfigTemplate,
  type CodeConfig,
  type SafetyConfig,
  type HistoryConfig,
  type TaskConfig,
  type CodeKnowledgeConfig,

  // 类型
  type ReadParams,
  type WriteParams,
  type EditParams,
  type GlobParams,
  type GrepParams,
  type TaskItem,
  type TaskStatus,
  type UndoResult,
  type RedoResult,
  type CodeKnowledgeSearchOptions,
  type CodeKnowledgeSearchResult,
  type CodeIndexSummary,
  type CodeCrawlSummary,
  type CodeKnowledgeStats,
  type StreamCallbacks,
};
```
