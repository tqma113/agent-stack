# 基于 Anthropic "Building Effective Agents" 的优化分析

## 📋 文章核心观点总结

| 原则 | 说明 |
|------|------|
| **Simplicity First** | 从最简单的方案开始，只在必要时增加复杂度 |
| **Transparency** | 展示 Agent 的规划步骤，让用户了解决策过程 |
| **ACI (Agent-Computer Interface)** | 像设计 API 一样精心设计工具接口 |

---

## 🔧 项目优化建议

### 1. 缺少 Workflow 模式支持

**现状**：当前只有单一的 Agent 循环模式 (chat → tool → chat)

**建议**：添加 Anthropic 推荐的 5 种工作流模式

```typescript
// 建议添加到 @ai-stack/agent
export type WorkflowType =
  | 'agent'           // 当前默认：自主循环
  | 'chain'           // Prompt Chaining：固定步骤序列
  | 'route'           // Routing：分类后路由到专门处理器
  | 'parallel'        // Parallelization：并行执行多个子任务
  | 'orchestrator'    // Orchestrator-Workers：动态分解任务
  | 'evaluator';      // Evaluator-Optimizer：生成+评估循环

interface AgentConfig {
  // ... existing
  workflow?: WorkflowType | WorkflowConfig;
}
```

### 2. 工具文档不够丰富

**现状**：Tool 接口只有 name、description、parameters

**建议**：按 Anthropic 建议增强工具定义 ("Poka-yoke your tools")

```typescript
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<string>;

  // 新增：增强的工具文档
  examples?: Array<{           // 使用示例
    input: Record<string, unknown>;
    output: string;
    description?: string;
  }>;
  edgeCases?: string[];        // 边界情况说明
  hints?: string[];            // 使用提示
  returnFormat?: string;       // 返回格式说明
  constraints?: string[];      // 约束条件
}
```

### 3. 缺少 Human-in-the-Loop 检查点机制

**现状**：只有 onMaxIterations 回调，缺少主动的检查点

**建议**：添加结构化的检查点机制

```typescript
interface ConversationOptions {
  maxIterations?: number;
  signal?: AbortSignal;
  onMaxIterations?: OnMaxIterationsCallback;

  // 新增：检查点机制
  checkpoints?: {
    /** 每 N 次工具调用后暂停确认 */
    afterToolCalls?: number;
    /** 特定工具调用前确认 */
    beforeTools?: string[];
    /** 检测到特定模式时暂停 */
    patterns?: Array<{
      match: string | RegExp;
      message: string;
    }>;
  };
  onCheckpoint?: (context: CheckpointContext) => Promise<'continue' | 'stop' | 'modify'>;
}
```

### 4. 缺少 Orchestrator-Workers 模式

**现状**：所有工作在单一 Agent 中完成

**建议**：支持动态子任务分解

```typescript
// 新增：Orchestrator 模式
interface OrchestratorConfig {
  /** Worker Agent 配置 */
  workers: Record<string, {
    systemPrompt: string;
    tools?: string[];
    model?: string;
  }>;
  /** 任务分解 prompt */
  decomposePrompt?: string;
  /** 结果聚合 prompt */
  aggregatePrompt?: string;
}

// 使用示例
const agent = createAgent({
  workflow: 'orchestrator',
  orchestrator: {
    workers: {
      researcher: { systemPrompt: '...', tools: ['search'] },
      coder: { systemPrompt: '...', tools: ['read', 'write', 'edit'] },
      reviewer: { systemPrompt: '...', tools: ['read', 'grep'] },
    },
  },
});
```

### 5. Evaluator-Optimizer 模式缺失

**建议**：添加生成-评估循环

```typescript
interface EvaluatorConfig {
  /** 评估 prompt */
  evaluatePrompt: string;
  /** 最大优化轮次 */
  maxRounds?: number;
  /** 评分阈值 (达到后停止) */
  scoreThreshold?: number;
  /** 使用不同模型评估 */
  evaluatorModel?: string;
}
```

### 6. 透明度不足 - 缺少 Planning 展示

**现状**：Agent 的决策过程对用户不透明

**建议**：添加思考/规划展示机制

```typescript
interface StreamCallbacks {
  // ... existing

  // 新增：思考过程回调
  onThinking?: (thought: string) => void;
  onPlan?: (plan: TaskStep[]) => void;
  onPlanUpdate?: (update: { stepId: string; status: 'started' | 'completed' | 'failed' }) => void;
}

// Agent 在执行前先输出计划
// "[Planning] 我会先搜索代码库，然后修改文件，最后运行测试..."
```

### 7. 工具格式优化

**Anthropic 建议**：
- 给模型足够的 tokens 来"思考"
- 避免行号计数等复杂格式
- 保持接近自然文本的格式

**建议检查**：

```typescript
// 当前 Edit 工具使用 old_string/new_string
// 考虑是否需要简化，避免模型需要精确匹配
interface EditToolParams {
  file_path: string;
  old_string: string;  // 需要精确匹配 - 可能出错
  new_string: string;
}

// 可选：添加更宽松的编辑模式
interface EditToolParamsV2 {
  file_path: string;
  instruction: string;  // 自然语言描述修改意图
  // 或
  search_pattern?: string;  // 正则/模糊匹配
  replacement: string;
}
```

### 8. 停止条件不够灵活

**现状**：只有 maxIterations 作为停止条件

**建议**：添加多种停止条件

```typescript
interface StopConditions {
  maxIterations?: number;
  maxTokens?: number;           // 总 token 消耗
  maxToolCalls?: number;        // 工具调用次数
  maxDuration?: number;         // 最大运行时间 (ms)
  maxCost?: number;             // 最大成本 (需要定价配置)
  customCondition?: (context: {
    iterations: number;
    toolCalls: ToolCallResult[];
    totalTokens: number;
    duration: number;
  }) => boolean;
}
```

### 9. Ground Truth 验证机制

**Anthropic 强调**：Agent 应从环境获取"ground truth"

**建议**：增强工具结果验证

```typescript
interface Tool {
  // ... existing

  // 新增：结果验证
  validateResult?: (result: string, args: Record<string, unknown>) => {
    valid: boolean;
    error?: string;
    suggestions?: string[];
  };

  // 新增：可验证性标记
  verifiable?: boolean;  // 是否可以通过其他方式验证结果
  verifyWith?: string;   // 用于验证的工具名
}
```

### 10. 框架透明度

**Anthropic 警告**：框架可能隐藏底层 prompt 和响应

**建议**：增强调试能力

```typescript
interface TelemetryConfig {
  enabled?: boolean;
  onEvent?: AgentEventListener;
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';

  // 新增：详细日志
  logPrompts?: boolean;        // 记录完整 prompt
  logResponses?: boolean;      // 记录完整响应
  logToolSchema?: boolean;     // 记录工具 schema
  exportFormat?: 'json' | 'markdown';  // 导出格式
}
```

---

## 📊 优先级排序

| 优先级 | 优化项 | 原因 |
|--------|--------|------|
| P0 | Tool 文档增强 | 直接影响 Agent 效果，改动小 |
| P0 | 透明度/Planning 展示 | 用户体验关键，调试必备 |
| P1 | 检查点机制 | 安全性和可控性 |
| P1 | 停止条件扩展 | 成本控制，生产必需 |
| P2 | Workflow 模式支持 | 架构扩展，需要仔细设计 |
| P2 | Orchestrator 模式 | 复杂任务支持 |
| P3 | Evaluator 模式 | 质量优化场景 |

---

# 详细实现方案

## 一、Tool 文档增强

### 1.1 扩展 Tool 接口

**文件**: `packages/libs/agent/src/types.ts`

```typescript
/**
 * Tool usage example for documentation
 */
export interface ToolExample {
  /** Example input arguments */
  input: Record<string, unknown>;
  /** Expected output */
  output: string;
  /** Description of what this example demonstrates */
  description?: string;
}

/**
 * Enhanced Tool interface with rich documentation
 *
 * Based on Anthropic's "Poka-yoke your tools" principle:
 * - Provide clear examples
 * - Document edge cases
 * - Give hints for proper usage
 */
export interface Tool {
  /** Tool name (must be unique, use snake_case) */
  name: string;

  /**
   * Description of what the tool does.
   * Should be detailed enough for LLM to understand when to use it.
   * Include: purpose, when to use, what it returns.
   */
  description: string;

  /** JSON Schema for tool parameters */
  parameters: Record<string, unknown>;

  /** Function to execute when tool is called */
  execute: (args: Record<string, unknown>) => Promise<string>;

  // ========== Enhanced Documentation (NEW) ==========

  /**
   * Usage examples showing input/output pairs.
   * LLM can learn from these examples how to use the tool correctly.
   * Recommend: 2-3 examples covering common cases.
   */
  examples?: ToolExample[];

  /**
   * Edge cases and potential pitfalls.
   * Help LLM avoid common mistakes.
   * Example: "Returns empty string if file doesn't exist"
   */
  edgeCases?: string[];

  /**
   * Usage hints and best practices.
   * Example: "Prefer glob patterns over recursive directory listing"
   */
  hints?: string[];

  /**
   * Description of return value format.
   * Example: "Returns JSON with {files: string[], count: number}"
   */
  returnFormat?: string;

  /**
   * Constraints and limitations.
   * Example: "Max file size: 10MB", "Timeout: 30s"
   */
  constraints?: string[];

  /**
   * Related tools that might be useful together.
   * Example: ["grep", "read"] for a "glob" tool
   */
  relatedTools?: string[];

  /**
   * When NOT to use this tool.
   * Help LLM choose the right tool.
   * Example: "Don't use for binary files, use read_binary instead"
   */
  antiPatterns?: string[];
}
```

### 1.2 工具描述生成器

**文件**: `packages/libs/agent/src/tool-docs.ts` (新建)

```typescript
import type { Tool } from './types.js';

/**
 * Generate enhanced tool description for LLM consumption
 */
export function generateToolDescription(tool: Tool): string {
  const sections: string[] = [];

  // Base description
  sections.push(tool.description);

  // Return format
  if (tool.returnFormat) {
    sections.push(`\n**Returns**: ${tool.returnFormat}`);
  }

  // Examples
  if (tool.examples && tool.examples.length > 0) {
    sections.push('\n**Examples**:');
    for (const example of tool.examples) {
      sections.push(`- Input: ${JSON.stringify(example.input)}`);
      sections.push(`  Output: ${example.output}`);
      if (example.description) {
        sections.push(`  (${example.description})`);
      }
    }
  }

  // Hints
  if (tool.hints && tool.hints.length > 0) {
    sections.push('\n**Tips**:');
    for (const hint of tool.hints) {
      sections.push(`- ${hint}`);
    }
  }

  // Edge cases
  if (tool.edgeCases && tool.edgeCases.length > 0) {
    sections.push('\n**Edge Cases**:');
    for (const edgeCase of tool.edgeCases) {
      sections.push(`- ${edgeCase}`);
    }
  }

  // Constraints
  if (tool.constraints && tool.constraints.length > 0) {
    sections.push('\n**Constraints**:');
    for (const constraint of tool.constraints) {
      sections.push(`- ${constraint}`);
    }
  }

  // Anti-patterns
  if (tool.antiPatterns && tool.antiPatterns.length > 0) {
    sections.push('\n**Avoid**:');
    for (const antiPattern of tool.antiPatterns) {
      sections.push(`- ${antiPattern}`);
    }
  }

  return sections.join('\n');
}

/**
 * Convert tool to OpenAI function definition with enhanced description
 */
export function toolToFunctionDef(tool: Tool, enhanced = true) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: enhanced ? generateToolDescription(tool) : tool.description,
      parameters: tool.parameters,
    },
  };
}
```

### 1.3 示例：增强后的 Read 工具

```typescript
const readTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file from the filesystem.',
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Absolute path to the file'
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read'
      },
    },
    required: ['file_path'],
  },

  // Enhanced documentation
  examples: [
    {
      input: { file_path: '/src/index.ts' },
      output: '1: import { foo } from "./foo";\n2: export { foo };',
      description: 'Read entire file with line numbers',
    },
    {
      input: { file_path: '/src/index.ts', offset: 10, limit: 5 },
      output: '10: function bar() {\n11:   return 42;\n12: }',
      description: 'Read specific line range',
    },
  ],

  hints: [
    'Always use absolute paths, not relative paths',
    'For large files, use offset/limit to read in chunks',
    'Line numbers in output help with subsequent edit operations',
  ],

  edgeCases: [
    'Returns error message if file does not exist',
    'Binary files return "[Binary file - content not displayed]"',
    'Empty files return empty string with no line numbers',
  ],

  returnFormat: 'Line-numbered content in format "N: content\\n"',

  constraints: [
    'Max file size: 10MB',
    'Max lines per request: 2000',
    'Lines longer than 2000 chars are truncated',
  ],

  relatedTools: ['write_file', 'edit_file', 'glob'],

  antiPatterns: [
    'Do not use for binary files (images, executables)',
    'Do not read entire large files - use offset/limit',
  ],

  async execute(args) {
    // ... implementation
    return '';
  },
};
```

---

## 二、透明度/Planning 展示

### 2.1 扩展事件类型

**文件**: `packages/libs/agent/src/types.ts`

```typescript
// 新增事件类型
export type AgentEventType =
  | 'tool:start'
  | 'tool:end'
  | 'tool:error'
  | 'llm:request'
  | 'llm:response'
  | 'llm:stream:start'
  | 'llm:stream:token'
  | 'llm:stream:end'
  | 'memory:retrieve'
  | 'memory:record'
  | 'iteration:start'
  | 'iteration:end'
  // NEW: Transparency events
  | 'thinking:start'
  | 'thinking:update'
  | 'thinking:end'
  | 'plan:created'
  | 'plan:step:start'
  | 'plan:step:complete'
  | 'plan:step:failed'
  | 'plan:updated';

/**
 * Agent's thinking/reasoning process
 */
export interface ThinkingStartEvent extends AgentEventBase {
  type: 'thinking:start';
}

export interface ThinkingUpdateEvent extends AgentEventBase {
  type: 'thinking:update';
  thought: string;
  category?: 'analysis' | 'planning' | 'decision' | 'reflection';
}

export interface ThinkingEndEvent extends AgentEventBase {
  type: 'thinking:end';
  summary?: string;
}

/**
 * Agent's execution plan
 */
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  toolsToUse?: string[];
  estimatedDuration?: string;
  result?: string;
  error?: string;
}

export interface PlanCreatedEvent extends AgentEventBase {
  type: 'plan:created';
  goal: string;
  steps: PlanStep[];
  reasoning?: string;
}

export interface PlanStepStartEvent extends AgentEventBase {
  type: 'plan:step:start';
  stepId: string;
  description: string;
}

export interface PlanStepCompleteEvent extends AgentEventBase {
  type: 'plan:step:complete';
  stepId: string;
  result: string;
}

export interface PlanStepFailedEvent extends AgentEventBase {
  type: 'plan:step:failed';
  stepId: string;
  error: string;
  willRetry: boolean;
}

export interface PlanUpdatedEvent extends AgentEventBase {
  type: 'plan:updated';
  reason: string;
  addedSteps?: PlanStep[];
  removedStepIds?: string[];
  modifiedSteps?: Array<{ id: string; changes: Partial<PlanStep> }>;
}
```

### 2.2 扩展 StreamCallbacks

```typescript
export interface StreamCallbacks {
  /** Called for each token received */
  onToken?: (token: string) => void;
  /** Called when a tool is being called */
  onToolCall?: (name: string, args: Record<string, unknown>) => void;
  /** Called when a tool returns a result */
  onToolResult?: (name: string, result: string) => void;
  /** Called when streaming completes */
  onComplete?: (response: AgentResponse) => void;
  /** Called on error */
  onError?: (error: Error) => void;

  // NEW: Transparency callbacks

  /** Called when agent starts thinking/reasoning */
  onThinkingStart?: () => void;
  /** Called with agent's thought process */
  onThinking?: (thought: string, category?: string) => void;
  /** Called when thinking phase ends */
  onThinkingEnd?: (summary?: string) => void;

  /** Called when agent creates an execution plan */
  onPlan?: (plan: { goal: string; steps: PlanStep[]; reasoning?: string }) => void;
  /** Called when a plan step starts */
  onPlanStepStart?: (step: PlanStep) => void;
  /** Called when a plan step completes */
  onPlanStepComplete?: (stepId: string, result: string) => void;
  /** Called when a plan step fails */
  onPlanStepFail?: (stepId: string, error: string) => void;
  /** Called when plan is modified */
  onPlanUpdate?: (update: { reason: string; steps: PlanStep[] }) => void;
}
```

### 2.3 Planning 模式配置

```typescript
export interface PlanningConfig {
  /** Enable explicit planning phase before execution */
  enabled?: boolean;

  /**
   * Planning mode:
   * - 'implicit': Extract plan from model's natural response
   * - 'explicit': Request structured plan via system prompt
   * - 'tool': Use a dedicated planning tool
   */
  mode?: 'implicit' | 'explicit' | 'tool';

  /** Show plan to user before execution */
  showPlanBeforeExecution?: boolean;

  /** Require user approval before executing plan */
  requireApproval?: boolean;

  /** Allow plan modification during execution */
  allowDynamicReplanning?: boolean;

  /** System prompt addition for planning */
  planningPrompt?: string;
}

// Default planning prompt
const DEFAULT_PLANNING_PROMPT = `
Before taking any action, first create a brief plan:

1. **Analyze** the request to understand what's needed
2. **Plan** the steps you'll take (list them as: Step 1, Step 2, etc.)
3. **Execute** each step, updating progress as you go
4. **Verify** the result meets the requirements

Format your plan as:
[PLAN]
Goal: <one-line description>
Steps:
1. <step description> [tools: <tool1>, <tool2>]
2. <step description> [tools: <tool1>]
...
[/PLAN]

Then proceed with execution, noting when each step completes.
`;
```

### 2.4 Plan 解析器

**文件**: `packages/libs/agent/src/plan-parser.ts` (新建)

```typescript
import type { PlanStep } from './types.js';

/**
 * Parse plan from LLM response
 */
export function parsePlan(content: string): {
  goal: string;
  steps: PlanStep[];
} | null {
  // Match [PLAN]...[/PLAN] block
  const planMatch = content.match(/\[PLAN\]([\s\S]*?)\[\/PLAN\]/);
  if (!planMatch) return null;

  const planContent = planMatch[1];

  // Extract goal
  const goalMatch = planContent.match(/Goal:\s*(.+)/);
  const goal = goalMatch?.[1]?.trim() || 'Execute task';

  // Extract steps
  const steps: PlanStep[] = [];
  const stepRegex = /(\d+)\.\s*(.+?)(?:\[tools?:\s*([^\]]+)\])?$/gm;

  let match;
  while ((match = stepRegex.exec(planContent)) !== null) {
    const [, num, description, toolsStr] = match;
    steps.push({
      id: `step-${num}`,
      description: description.trim(),
      status: 'pending',
      toolsToUse: toolsStr?.split(',').map(t => t.trim()),
    });
  }

  return steps.length > 0 ? { goal, steps } : null;
}

/**
 * Detect step completion markers in content
 */
export function detectStepCompletion(content: string): {
  stepId: string;
  status: 'completed' | 'failed';
  result?: string;
}[] {
  const completions: ReturnType<typeof detectStepCompletion> = [];

  // Match patterns like "✓ Step 1 completed" or "[DONE] Step 2"
  const completedRegex = /(?:✓|✅|\[DONE\]|\[COMPLETE\])\s*Step\s*(\d+)(?:\s*[-:]\s*(.+))?/gi;
  let match;
  while ((match = completedRegex.exec(content)) !== null) {
    completions.push({
      stepId: `step-${match[1]}`,
      status: 'completed',
      result: match[2]?.trim(),
    });
  }

  // Match patterns like "✗ Step 1 failed" or "[FAILED] Step 2"
  const failedRegex = /(?:✗|❌|\[FAILED\]|\[ERROR\])\s*Step\s*(\d+)(?:\s*[-:]\s*(.+))?/gi;
  while ((match = failedRegex.exec(content)) !== null) {
    completions.push({
      stepId: `step-${match[1]}`,
      status: 'failed',
      result: match[2]?.trim(),
    });
  }

  return completions;
}
```

---

## 三、停止条件扩展

### 3.1 StopConditions 接口

**文件**: `packages/libs/agent/src/types.ts`

```typescript
/**
 * Execution context for stop condition evaluation
 */
export interface ExecutionContext {
  /** Current iteration count */
  iterations: number;
  /** All tool calls executed */
  toolCalls: ToolCallResult[];
  /** Total tool call count */
  toolCallCount: number;
  /** Total tokens consumed (prompt + completion) */
  totalTokens: number;
  /** Total prompt tokens */
  promptTokens: number;
  /** Total completion tokens */
  completionTokens: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Estimated cost in USD (if pricing configured) */
  estimatedCost?: number;
  /** Current plan steps status */
  planProgress?: {
    total: number;
    completed: number;
    failed: number;
  };
  /** Last assistant response */
  lastResponse?: string;
}

/**
 * Result of stop condition check
 */
export interface StopCheckResult {
  /** Whether to stop execution */
  shouldStop: boolean;
  /** Reason for stopping (for logging/display) */
  reason?: string;
  /** Whether this is a soft stop (can be overridden) or hard stop */
  type: 'soft' | 'hard';
  /** Suggested action */
  suggestion?: 'continue' | 'pause' | 'abort';
}

/**
 * Flexible stop conditions for agent execution
 */
export interface StopConditions {
  // ========== Iteration Limits ==========

  /** Maximum LLM call iterations (default: 10) */
  maxIterations?: number;

  /** Maximum tool calls across all iterations */
  maxToolCalls?: number;

  // ========== Resource Limits ==========

  /** Maximum total tokens (prompt + completion) */
  maxTotalTokens?: number;

  /** Maximum completion tokens only */
  maxCompletionTokens?: number;

  /** Maximum execution time in milliseconds */
  maxDurationMs?: number;

  // ========== Cost Limits ==========

  /** Maximum estimated cost in USD */
  maxCost?: number;

  /** Pricing configuration for cost calculation */
  pricing?: {
    /** Cost per 1K prompt tokens */
    promptTokenCost: number;
    /** Cost per 1K completion tokens */
    completionTokenCost: number;
  };

  // ========== Content-based Conditions ==========

  /** Stop if response contains any of these patterns */
  stopPatterns?: Array<string | RegExp>;

  /** Stop if specific tool is called */
  stopOnTools?: string[];

  /** Stop if tool call fails N times consecutively */
  maxConsecutiveFailures?: number;

  // ========== Custom Conditions ==========

  /**
   * Custom stop condition function.
   * Called after each iteration.
   * Return true to stop, false to continue.
   */
  customCondition?: (context: ExecutionContext) => boolean | StopCheckResult;

  /**
   * Async custom condition (for external checks)
   */
  asyncCondition?: (context: ExecutionContext) => Promise<boolean | StopCheckResult>;

  // ========== Callbacks ==========

  /**
   * Called when a stop condition is triggered.
   * Return true to override and continue, false to stop.
   */
  onStopCondition?: (result: StopCheckResult, context: ExecutionContext) => Promise<boolean>;

  /**
   * Called periodically with execution stats (for monitoring)
   */
  onProgress?: (context: ExecutionContext) => void;
}
```

### 3.2 停止条件检查器

**文件**: `packages/libs/agent/src/stop-checker.ts` (新建)

```typescript
import type {
  StopConditions,
  ExecutionContext,
  StopCheckResult,
  ToolCallResult
} from './types.js';

/**
 * Default stop conditions
 */
export const DEFAULT_STOP_CONDITIONS: Partial<StopConditions> = {
  maxIterations: 10,
  maxDurationMs: 5 * 60 * 1000, // 5 minutes
  maxConsecutiveFailures: 3,
};

/**
 * Create a stop condition checker
 */
export function createStopChecker(conditions: StopConditions) {
  const startTime = Date.now();
  let consecutiveFailures = 0;

  /**
   * Check all stop conditions
   */
  async function check(context: ExecutionContext): Promise<StopCheckResult> {
    const elapsed = Date.now() - startTime;
    const fullContext = { ...context, elapsedMs: elapsed };

    // Calculate cost if pricing configured
    if (conditions.pricing) {
      fullContext.estimatedCost =
        (context.promptTokens / 1000) * conditions.pricing.promptTokenCost +
        (context.completionTokens / 1000) * conditions.pricing.completionTokenCost;
    }

    // Call progress callback
    conditions.onProgress?.(fullContext);

    // Check iteration limit
    if (conditions.maxIterations && context.iterations >= conditions.maxIterations) {
      return {
        shouldStop: true,
        reason: `Max iterations reached (${conditions.maxIterations})`,
        type: 'soft',
        suggestion: 'pause',
      };
    }

    // Check tool call limit
    if (conditions.maxToolCalls && context.toolCallCount >= conditions.maxToolCalls) {
      return {
        shouldStop: true,
        reason: `Max tool calls reached (${conditions.maxToolCalls})`,
        type: 'soft',
        suggestion: 'pause',
      };
    }

    // Check token limit
    if (conditions.maxTotalTokens && context.totalTokens >= conditions.maxTotalTokens) {
      return {
        shouldStop: true,
        reason: `Token limit reached (${context.totalTokens}/${conditions.maxTotalTokens})`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check duration limit
    if (conditions.maxDurationMs && elapsed >= conditions.maxDurationMs) {
      return {
        shouldStop: true,
        reason: `Time limit reached (${Math.round(elapsed / 1000)}s)`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check cost limit
    if (conditions.maxCost && fullContext.estimatedCost &&
        fullContext.estimatedCost >= conditions.maxCost) {
      return {
        shouldStop: true,
        reason: `Cost limit reached ($${fullContext.estimatedCost.toFixed(4)})`,
        type: 'hard',
        suggestion: 'abort',
      };
    }

    // Check stop patterns in last response
    if (conditions.stopPatterns && context.lastResponse) {
      for (const pattern of conditions.stopPatterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        if (regex.test(context.lastResponse)) {
          return {
            shouldStop: true,
            reason: `Stop pattern matched: ${pattern}`,
            type: 'soft',
            suggestion: 'continue',
          };
        }
      }
    }

    // Check consecutive failures
    if (conditions.maxConsecutiveFailures) {
      const lastCalls = context.toolCalls.slice(-conditions.maxConsecutiveFailures);
      const allFailed = lastCalls.length >= conditions.maxConsecutiveFailures &&
        lastCalls.every(call => call.result.startsWith('Error'));

      if (allFailed) {
        return {
          shouldStop: true,
          reason: `${conditions.maxConsecutiveFailures} consecutive tool failures`,
          type: 'soft',
          suggestion: 'pause',
        };
      }
    }

    // Check custom condition
    if (conditions.customCondition) {
      const result = conditions.customCondition(fullContext);
      if (result === true) {
        return {
          shouldStop: true,
          reason: 'Custom condition triggered',
          type: 'soft',
          suggestion: 'pause',
        };
      }
      if (typeof result === 'object' && result.shouldStop) {
        return result;
      }
    }

    // Check async condition
    if (conditions.asyncCondition) {
      const result = await conditions.asyncCondition(fullContext);
      if (result === true) {
        return {
          shouldStop: true,
          reason: 'Async condition triggered',
          type: 'soft',
          suggestion: 'pause',
        };
      }
      if (typeof result === 'object' && result.shouldStop) {
        return result;
      }
    }

    // No stop condition met
    return { shouldStop: false, type: 'soft' };
  }

  /**
   * Handle stop condition result
   */
  async function handleStop(result: StopCheckResult, context: ExecutionContext): Promise<boolean> {
    if (!result.shouldStop) return false;

    // Hard stops cannot be overridden
    if (result.type === 'hard') {
      return true;
    }

    // Soft stops can be overridden by callback
    if (conditions.onStopCondition) {
      const override = await conditions.onStopCondition(result, context);
      return !override; // If override returns true, don't stop
    }

    return true;
  }

  return {
    check,
    handleStop,
    getElapsed: () => Date.now() - startTime,
  };
}
```

### 3.3 使用示例

```typescript
const agent = createAgent({
  // ... other config

  stopConditions: {
    // Basic limits
    maxIterations: 20,
    maxToolCalls: 50,

    // Resource limits
    maxTotalTokens: 100000,
    maxDurationMs: 10 * 60 * 1000, // 10 minutes

    // Cost control
    maxCost: 1.00, // $1 USD
    pricing: {
      promptTokenCost: 0.01,      // $0.01 per 1K tokens
      completionTokenCost: 0.03,  // $0.03 per 1K tokens
    },

    // Content-based
    stopPatterns: [
      /task completed/i,
      /all tests pass/i,
    ],
    stopOnTools: ['deploy_to_production'], // Stop if this tool is called

    // Error handling
    maxConsecutiveFailures: 3,

    // Custom logic
    customCondition: (ctx) => {
      // Stop if we've made 10+ file edits
      const editCount = ctx.toolCalls.filter(c => c.name === 'edit_file').length;
      return editCount >= 10;
    },

    // Callbacks
    onStopCondition: async (result, ctx) => {
      console.log(`Stop condition: ${result.reason}`);
      if (result.type === 'soft') {
        // Ask user whether to continue
        const answer = await askUser(`Continue? (${result.reason})`);
        return answer === 'yes';
      }
      return false;
    },

    onProgress: (ctx) => {
      console.log(`Progress: ${ctx.iterations} iterations, ${ctx.toolCallCount} tools, $${ctx.estimatedCost?.toFixed(4)}`);
    },
  },
});
```

---

## 四、工具格式优化

### 4.1 Smart Edit 工具

**文件**: `packages/libs/code/src/tools/smart-edit.ts` (新建)

基于 Anthropic 建议，提供更宽松、更自然的编辑模式。

```typescript
import type { Tool } from '@ai-stack/agent';

/**
 * Smart Edit modes:
 * - 'exact': Current behavior, requires exact string match
 * - 'fuzzy': Allows minor whitespace/formatting differences
 * - 'line': Line-based replacement (simpler)
 * - 'instruction': Natural language edit instructions
 */
export type EditMode = 'exact' | 'fuzzy' | 'line' | 'instruction';

export interface SmartEditParams {
  file_path: string;

  // Mode 1: Exact replacement (current)
  old_string?: string;
  new_string?: string;

  // Mode 2: Fuzzy matching
  search_pattern?: string;  // Can include wildcards
  replacement?: string;

  // Mode 3: Line-based (simpler for LLM)
  start_line?: number;
  end_line?: number;
  new_content?: string;

  // Mode 4: Instruction-based (most natural)
  instruction?: string;  // "Add a return statement at the end of function foo"

  // Options
  mode?: EditMode;
  replace_all?: boolean;
  preview_only?: boolean;  // Return diff without applying
}

/**
 * Create a smart edit tool with multiple edit modes
 */
export function createSmartEditTool(options: {
  fileOps: FileOperations;
  llmComplete?: (prompt: string) => Promise<string>;  // For instruction mode
}): Tool {
  return {
    name: 'edit_file',
    description: `Edit a file with multiple modes:

1. **Exact Match** (default): Replace exact string
   - Use old_string + new_string
   - Most precise but requires exact match

2. **Line-Based**: Replace lines by number
   - Use start_line, end_line, new_content
   - Good for known line ranges

3. **Fuzzy Match**: Flexible string matching
   - Use search_pattern + replacement
   - Ignores whitespace differences

4. **Instruction Mode**: Natural language edits
   - Use instruction field
   - Best for complex changes`,

    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Absolute path to file',
        },
        // Exact mode
        old_string: {
          type: 'string',
          description: 'Exact string to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'Replacement string',
        },
        // Line mode
        start_line: {
          type: 'number',
          description: 'Starting line number (1-indexed)',
        },
        end_line: {
          type: 'number',
          description: 'Ending line number (inclusive)',
        },
        new_content: {
          type: 'string',
          description: 'New content to replace the lines',
        },
        // Fuzzy mode
        search_pattern: {
          type: 'string',
          description: 'Pattern to search (supports * wildcard)',
        },
        replacement: {
          type: 'string',
          description: 'Replacement for fuzzy match',
        },
        // Instruction mode
        instruction: {
          type: 'string',
          description: 'Natural language edit instruction',
        },
        // Options
        mode: {
          type: 'string',
          enum: ['exact', 'fuzzy', 'line', 'instruction'],
          description: 'Edit mode (auto-detected if not specified)',
        },
        replace_all: {
          type: 'boolean',
          description: 'Replace all occurrences',
        },
        preview_only: {
          type: 'boolean',
          description: 'Show diff without applying',
        },
      },
      required: ['file_path'],
    },

    examples: [
      {
        input: {
          file_path: '/src/index.ts',
          old_string: 'const x = 1;',
          new_string: 'const x = 2;',
        },
        output: 'Successfully edited /src/index.ts (1 change)',
        description: 'Exact string replacement',
      },
      {
        input: {
          file_path: '/src/index.ts',
          start_line: 10,
          end_line: 12,
          new_content: 'function newImpl() {\n  return 42;\n}',
        },
        output: 'Successfully replaced lines 10-12 in /src/index.ts',
        description: 'Line-based replacement',
      },
      {
        input: {
          file_path: '/src/index.ts',
          instruction: 'Add error handling to the fetchData function',
        },
        output: 'Successfully edited /src/index.ts based on instruction',
        description: 'Instruction-based edit',
      },
    ],

    hints: [
      'Prefer line-based mode when you know the exact lines',
      'Use instruction mode for complex refactoring',
      'Always read the file first to understand current content',
      'Use preview_only to verify changes before applying',
    ],

    edgeCases: [
      'Returns error if old_string not found (exact mode)',
      'Creates file if it does not exist (with warning)',
      'Instruction mode requires LLM integration',
    ],

    returnFormat: 'Success message with change count, or diff if preview_only',

    async execute(args: Record<string, unknown>): Promise<string> {
      const params = args as SmartEditParams;
      const { fileOps, llmComplete } = options;

      // Detect mode
      const mode = params.mode ?? detectMode(params);

      // Read current content
      const content = await fileOps.read(params.file_path);
      let newContent: string;

      switch (mode) {
        case 'exact':
          newContent = applyExactEdit(content, params);
          break;
        case 'fuzzy':
          newContent = applyFuzzyEdit(content, params);
          break;
        case 'line':
          newContent = applyLineEdit(content, params);
          break;
        case 'instruction':
          if (!llmComplete) {
            throw new Error('Instruction mode requires LLM integration');
          }
          newContent = await applyInstructionEdit(content, params, llmComplete);
          break;
        default:
          throw new Error(`Unknown edit mode: ${mode}`);
      }

      // Generate diff
      const diff = createPatch(params.file_path, content, newContent);

      if (params.preview_only) {
        return `Preview of changes:\n\`\`\`diff\n${diff}\n\`\`\``;
      }

      // Apply changes
      await fileOps.write(params.file_path, newContent);

      // Count changes
      const changes = diffLines(content, newContent).filter(d => d.added || d.removed).length;

      return `Successfully edited ${params.file_path} (${changes} changes)`;
    },
  };
}

/**
 * Auto-detect edit mode from parameters
 */
function detectMode(params: SmartEditParams): EditMode {
  if (params.instruction) return 'instruction';
  if (params.start_line !== undefined) return 'line';
  if (params.search_pattern) return 'fuzzy';
  return 'exact';
}

/**
 * Apply exact string replacement
 */
function applyExactEdit(content: string, params: SmartEditParams): string {
  if (!params.old_string || params.new_string === undefined) {
    throw new Error('Exact mode requires old_string and new_string');
  }

  if (!content.includes(params.old_string)) {
    throw new Error(`String not found in file: "${params.old_string.slice(0, 50)}..."`);
  }

  if (params.replace_all) {
    return content.split(params.old_string).join(params.new_string);
  }

  return content.replace(params.old_string, params.new_string);
}

/**
 * Apply line-based replacement
 */
function applyLineEdit(content: string, params: SmartEditParams): string {
  if (params.start_line === undefined || params.new_content === undefined) {
    throw new Error('Line mode requires start_line and new_content');
  }

  const lines = content.split('\n');
  const startIdx = params.start_line - 1;
  const endIdx = (params.end_line ?? params.start_line) - 1;

  if (startIdx < 0 || endIdx >= lines.length) {
    throw new Error(`Line range out of bounds: ${params.start_line}-${params.end_line ?? params.start_line}`);
  }

  const newLines = params.new_content.split('\n');
  lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);

  return lines.join('\n');
}

/**
 * Apply fuzzy matching with wildcards
 */
function applyFuzzyEdit(content: string, params: SmartEditParams): string {
  if (!params.search_pattern || params.replacement === undefined) {
    throw new Error('Fuzzy mode requires search_pattern and replacement');
  }

  // Convert wildcard pattern to regex
  const regexPattern = params.search_pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
    .replace(/\\\*/g, '.*')                   // Convert * to .*
    .replace(/\\\?/g, '.')                    // Convert ? to .
    .replace(/\\s+/g, '\\s+');                // Flexible whitespace

  const regex = new RegExp(regexPattern, params.replace_all ? 'g' : '');

  if (!regex.test(content)) {
    throw new Error(`Pattern not found: ${params.search_pattern}`);
  }

  return content.replace(regex, params.replacement);
}

/**
 * Apply instruction-based edit using LLM
 */
async function applyInstructionEdit(
  content: string,
  params: SmartEditParams,
  llmComplete: (prompt: string) => Promise<string>
): Promise<string> {
  const prompt = `You are a code editor. Apply the following instruction to the code.

## Current File Content:
\`\`\`
${content}
\`\`\`

## Instruction:
${params.instruction}

## Output:
Return ONLY the complete updated file content, with no explanation or markdown formatting.
Do not include \`\`\` markers in your response.`;

  const result = await llmComplete(prompt);

  // Clean up response (remove any accidental markdown)
  return result
    .replace(/^```\w*\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
}
```

### 4.2 Read 工具优化

基于 Anthropic 建议："Keep formats close to naturally occurring internet text"

```typescript
/**
 * Optimized read tool with natural output format
 */
export function createReadTool(options: { fileOps: FileOperations }): Tool {
  return {
    name: 'read_file',
    description: `Read file contents. Output includes line numbers for easy reference in subsequent edits.`,

    parameters: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute file path' },
        offset: { type: 'number', description: 'Start from this line (1-indexed)' },
        limit: { type: 'number', description: 'Max lines to read' },
        // NEW: Natural output options
        format: {
          type: 'string',
          enum: ['numbered', 'plain', 'snippet'],
          description: 'Output format (default: numbered)',
        },
        context_lines: {
          type: 'number',
          description: 'For snippet format: lines of context around matches',
        },
      },
      required: ['file_path'],
    },

    examples: [
      {
        input: { file_path: '/src/index.ts', format: 'numbered' },
        output: '  1 | import { foo } from "./foo";\n  2 | \n  3 | export function main() {',
        description: 'Numbered format with visual separator',
      },
      {
        input: { file_path: '/src/index.ts', format: 'plain' },
        output: 'import { foo } from "./foo";\n\nexport function main() {',
        description: 'Plain format without line numbers',
      },
    ],

    hints: [
      'Use numbered format when you need to make edits',
      'Use plain format for understanding content only',
      'For large files, always use offset/limit',
    ],

    async execute(args) {
      const { file_path, offset, limit, format = 'numbered' } = args as {
        file_path: string;
        offset?: number;
        limit?: number;
        format?: 'numbered' | 'plain' | 'snippet';
      };

      const content = await options.fileOps.read(file_path, offset, limit);

      if (format === 'plain') {
        return content;
      }

      // Numbered format with clear visual separator
      const lines = content.split('\n');
      const startLine = offset ?? 1;
      const maxLineNum = startLine + lines.length - 1;
      const padding = String(maxLineNum).length;

      return lines
        .map((line, i) => {
          const lineNum = String(startLine + i).padStart(padding, ' ');
          return `${lineNum} | ${line}`;
        })
        .join('\n');
    },
  };
}
```

### 4.3 Grep 工具优化

```typescript
/**
 * Optimized grep with natural output
 */
export function createGrepTool(options: { fileOps: FileOperations }): Tool {
  return {
    name: 'grep',
    description: `Search for patterns in files. Returns matches with surrounding context for understanding.`,

    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Search pattern (regex supported)' },
        path: { type: 'string', description: 'File or directory to search' },
        context: { type: 'number', description: 'Lines of context (default: 2)' },
        max_results: { type: 'number', description: 'Max matches to return (default: 10)' },
      },
      required: ['pattern'],
    },

    examples: [
      {
        input: { pattern: 'function.*export', path: '/src', context: 2 },
        output: `/src/utils.ts:15
  13 | // Helper functions
  14 |
> 15 | export function helper() {
  16 |   return 42;
  17 | }

/src/index.ts:8
   6 | import { helper } from "./utils";
   7 |
>  8 | export function main() {
   9 |   return helper();
  10 | }`,
        description: 'Search results with context lines',
      },
    ],

    hints: [
      'Use regex patterns for flexible matching',
      'Increase context for better understanding',
      'Results show file:line for easy navigation',
    ],

    returnFormat: 'Matches grouped by file with context lines. ">" marks the matching line.',

    async execute(args) {
      // ... implementation with natural formatting
      return '';
    },
  };
}
```

---

## 实施计划

### Phase 1: Tool 文档增强 ✅ 已完成
1. ✅ 扩展 `Tool` 接口，添加增强文档字段 (`types.ts`)
2. ✅ 实现 `generateToolDescription()` 函数 (`tool-docs.ts`)
3. ✅ 更新现有工具添加增强文档 (Read, Grep, Edit)
4. ✅ 导出相关函数 (`index.ts`)

### Phase 2: 停止条件扩展 ✅ 已完成
1. ✅ 定义 `StopConditions` 和 `ExecutionContext` 接口 (`types.ts`)
2. ✅ 实现 `createStopChecker()` 工厂函数 (`stop-checker.ts`)
3. ✅ 添加 `AgentConfig.stopConditions` 配置
4. ✅ 添加成本计算支持

### Phase 3: 透明度/Planning ✅ 已完成
1. ✅ 添加新的事件类型 (thinking/plan 相关) (`types.ts`)
2. ✅ 扩展 `StreamCallbacks` 添加规划回调
3. ✅ 实现 Plan 解析器 (`plan-parser.ts`)
4. ✅ 添加 `AgentConfig.planning` 配置
5. ✅ 添加 `PlanTrackerInstance` 用于状态跟踪

### Phase 4: 工具格式优化 ✅ 已完成
1. ✅ 增强 Edit 工具支持多模式 (exact, line, fuzzy)
2. ✅ 优化 Read 工具输出格式 (`numbered`, `plain`)
3. ✅ 优化 Grep 工具输出格式 (使用 `>` 标记匹配行)
4. ✅ 为所有工具添加增强文档 (examples, hints, edgeCases 等)

---

## 实施完成总结

### 新增文件
- `packages/libs/agent/src/tool-docs.ts` - 工具文档生成器
- `packages/libs/agent/src/stop-checker.ts` - 停止条件检查器
- `packages/libs/agent/src/plan-parser.ts` - 计划解析器

### 修改文件
- `packages/libs/agent/src/types.ts` - 扩展类型定义
- `packages/libs/agent/src/index.ts` - 导出新模块
- `packages/libs/code/src/types.ts` - 扩展工具参数类型
- `packages/libs/code/src/tools/read.ts` - 增强 Read 工具
- `packages/libs/code/src/tools/grep.ts` - 增强 Grep 工具
- `packages/libs/code/src/tools/edit.ts` - 增强 Edit 工具 (多模式)
- `packages/libs/code/src/file-history/diff-engine.ts` - 添加 createPatch
- `spec/api-reference.md` - 更新 API 文档
- `spec/business-logic.md` - 更新业务逻辑文档
