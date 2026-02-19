  2. 🔴 Knowledge 包重复依赖 better-sqlite3

  现状：
  // @ai-stack/knowledge/package.json
  "dependencies": {
    "@ai-stack/memory-store-sqlite": "workspace:*",
    "better-sqlite3": "^11.7.0",  // 重复！
    "sqlite-vec": "^0.1.6"         // 重复！
  }

  问题：memory-store-sqlite 已经依赖了这些库，重复依赖可能导致版本冲突。

  建议：
  - 将 better-sqlite3 和 sqlite-vec 从 knowledge 中移除
  - 通过 memory-store-sqlite 暴露数据库操作接口

  ---
  4. 🟡 错误处理不统一

  现状：各包有独立的错误类，但缺乏统一的错误处理策略。

  // mcp/types.ts
  class MCPConnectionError extends MCPError {}

  // skill/types.ts (推测)
  class SkillLoadError extends SkillError {}

  // 但 agent 层没有统一捕获和处理

  建议：
  // 创建统一的错误基类
  class AIStackError extends Error {
    code: string;
    source: 'provider' | 'mcp' | 'skill' | 'memory' | 'knowledge';
    recoverable: boolean;
  }

  // Agent 层统一处理
  try {
    await tool.execute(args);
  } catch (error) {
    if (error instanceof AIStackError && error.recoverable) {
      // 自动重试或降级
    }
  }
  5. 🟡 Memory 系统存在 Legacy 代码负担

  现状：@ai-stack/memory/src/index.ts 有大量 legacy 兼容导出：

  // Legacy Manager (deprecated, kept for backward compatibility)
  export { createMemoryManager } from './manager.js';

  // Legacy error re-exports
  export { MemoryStoreError as MemoryError } from ...
  export { ProfileError as ProfileKeyNotAllowedError } from ...

  建议：
  - 明确版本计划，设定 deprecated 移除时间
  - 考虑在 v1.0.0 之前清理这些兼容层
  - 使用 @deprecated JSDoc 标注

  ---
  6. 🟡 Code Indexer 无法真正删除旧 chunks

  现状 (code/indexer.ts:417-420):
  async function removeFile(filePath: string): Promise<void> {
    // Note: Chunks are not actually deleted from SemanticStore
    // as we don't have a way to delete by metadata
    // This would require extending SemanticStore interface
  }

  问题：重新索引时只会累积 chunks，无法清理旧数据。

  建议：
  // 扩展 SemanticStore 接口
  interface SemanticStoreInstance {
    // 现有方法...
    deleteByMetadata(filter: Record<string, unknown>): Promise<number>;
    deleteByTags(tags: string[]): Promise<number>;
  }
  
  8. 🟢 建议增加 Observability

  现状：缺乏统一的日志、指标、追踪机制。

  建议：
  interface AgentConfig {
    // 现有配置...
    telemetry?: {
      logger?: Logger;  // 可注入自定义 logger
      metrics?: Metrics; // 可注入 metrics collector
      tracing?: Tracer;  // OpenTelemetry 兼容
    };
  }

  // 内置事件系统
  agent.on('tool:start', (event) => { /* ... */ });
  agent.on('tool:end', (event) => { /* ... */ });
  agent.on('llm:request', (event) => { /* ... */ });
  agent.on('llm:response', (event) => { /* ... */ });

  ---
  
  9. 🟢 建议增加配置校验

  现状：配置加载时没有 Schema 校验。

  建议：
  // 使用 Zod 进行配置校验
  import { z } from 'zod';

  const AgentConfigSchema = z.object({
    model: z.string().default('gpt-4o'),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().positive().optional(),
    // ...
  });

  function loadConfig(path: string) {
    const raw = JSON.parse(fs.readFileSync(path, 'utf-8'));
    return AgentConfigSchema.parse(raw); // 自动校验 + 默认值
  }
  
  10. 🟢 建议支持 Streaming Tool Calls

  现状：工具调用是阻塞式的，需要等待完整响应。

  建议：支持 OpenAI 的 parallel tool calls 和流式工具结果：

  // 并行执行多个工具调用
  const toolCalls = response.toolCalls;
  const results = await Promise.all(
    toolCalls.map(call => executeToolWithTimeout(call))
  );