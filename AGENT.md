# AI Stack - AI Agent Instructions

This document provides comprehensive instructions for AI agents working on the AI Stack codebase.

## Project Context

AI Stack is a modular AI Agent development framework designed for building intelligent assistants, code editing tools, and custom AI applications.

| Aspect | Details |
|--------|---------|
| Architecture | Rush monorepo with pnpm |
| Language | TypeScript 5.7 |
| Runtime | Node.js 20+ |
| Build | tsup (CJS + ESM dual format) |
| Testing | Vitest |

## Core Design Principles

### 1. Factory Functions Over Classes

The project uses functional programming patterns exclusively. **Never create classes**.

```typescript
// CORRECT - Factory function returning an interface
export function createComponent(config: Config): ComponentInstance {
  // Private state via closure
  let internalState = {};

  function privateMethod() { /* ... */ }

  // Public interface
  return {
    publicMethod() { /* ... */ },
    getState() { return internalState; }
  };
}

// WRONG - Never use classes
export class Component { /* ... */ }
```

### 2. Type Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Factory function | `createXxx` | `createAgent` |
| Instance interface | `XxxInstance` | `AgentInstance` |
| Config type | `XxxConfig` | `AgentConfig` |
| Options type | `XxxOptions` | `SearchOptions` |
| Event type | `XxxEvent` | `MemoryEvent` |

### 3. ESM Module System

- Use `.js` extension for relative imports: `import { foo } from './foo.js'`
- Package.json must have `"type": "module"` for ESM packages
- tsup generates both CJS and ESM outputs

## Package Organization

### Core Libraries (`packages/libs/`)

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@ai-stack/provider` | Multi-model LLM abstraction | `createOpenAIClient`, `createAnthropicClient`, `createGoogleClient`, `defineTool` |
| `@ai-stack/mcp` | MCP protocol support | `createMCPClientManager`, `createMCPToolProvider` |
| `@ai-stack/skill` | Skill system | `createSkillManager`, `createSkillToolProvider` |
| `@ai-stack/memory` | Memory strategies & pipelines | `createMemoryManager`, `createMemoryPipeline`, stores |
| `@ai-stack/memory-store-sqlite` | SQLite storage backend | `createSQLiteStore`, stores |
| `@ai-stack/memory-store-json` | JSON file storage backend | `createJSONStore` |
| `@ai-stack/knowledge` | Code/doc indexing | `createKnowledgeManager`, `createCodeIndexer`, `createDocIndexer` |
| `@ai-stack/tui` | Terminal UI | Ink components, `StreamRenderer`, `showConfirm`, `showDiffView` |
| `@ai-stack/agent` | Core agent implementation | `createAgent` |
| `@ai-stack/assistant` | Personal assistant | Memory + Scheduler + Gateway |
| `@ai-stack/code` | Code editing agent | File ops + Undo/Redo |

### Skills (`packages/skills/`)

| Package | Purpose |
|---------|---------|
| `@ai-stack-skill/memory` | Memory management skill |
| `@ai-stack-skill/knowledge` | Knowledge base skill |

### MCP Servers (`packages/mcp-servers/`)

| Package | Purpose |
|---------|---------|
| `@ai-stack-mcp/fetch` | Web content fetching |
| `@ai-stack-mcp/time` | Time/timezone operations |
| `@ai-stack-mcp/git` | Git operations |
| `@ai-stack-mcp/bash` | Bash command execution |
| `@ai-stack-mcp/lsp` | Language server protocol |
| `@ai-stack-mcp/electron-cdp` | Electron CDP integration |

### Examples (`packages/examples/`)

| Package | Purpose |
|---------|---------|
| `@ai-stack-example/agent` | Agent usage example |
| `@ai-stack-example/assistant` | Assistant usage example |
| `@ai-stack-example/code` | Code agent example |

## File Structure Conventions

Each package follows this structure:

```
packages/libs/mypackage/
├── src/
│   ├── index.ts        # Public exports only
│   ├── types.ts        # Type definitions
│   ├── [feature]/      # Feature modules (optional)
│   └── [feature].ts    # Implementation files
├── tests/              # Test files (Vitest)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts    # If tests exist
```

## Common Patterns

### Tool Definition

```typescript
import { defineTool, defineParameters } from '@ai-stack/provider';

const myTool = defineTool({
  name: 'my_tool',
  description: 'Does something useful',
  parameters: defineParameters({
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input value' }
    },
    required: ['input']
  }),
  execute: async ({ input }) => {
    return `Processed: ${input}`;
  }
});
```

### Agent Creation

```typescript
import { createAgent } from '@ai-stack/agent';

const agent = await createAgent({
  model: 'gpt-4',
  systemPrompt: 'You are a helpful assistant.',
  tools: [myTool]
});
```

### Memory Usage

```typescript
import { createMemoryManager } from '@ai-stack/memory';
import { createSQLiteStore } from '@ai-stack/memory-store-sqlite';

const store = createSQLiteStore({ path: './memory.db' });
const memory = createMemoryManager({ store });

// Store and retrieve memories
await memory.store({ type: 'event', content: '...' });
const results = await memory.search({ query: '...' });
```

### TUI Usage

```typescript
import { showConfirm, showDiffView, StreamRenderer } from '@ai-stack/tui';

// Confirmation dialog
const confirmed = await showConfirm('Proceed with changes?');

// Diff preview
const approved = await showDiffView('file.ts', oldContent, newContent);

// Streaming output
const stream = new StreamRenderer();
stream.start();
stream.addToken('Hello');
stream.finish();
```

## Build & Development

```bash
# Install dependencies
rush update

# Build all packages
rush build

# Build specific package and its dependencies
rush build --to @ai-stack/agent

# Watch mode (in package directory)
rushx dev

# Type check
rushx typecheck

# Run tests
rushx test
```

## Adding New Code

### New Package Checklist

1. Create directory structure under `packages/libs/`, `packages/skills/`, or `packages/mcp-servers/`
2. Create `package.json` with proper workspace dependencies
3. Create `tsconfig.json` extending `../../tsconfig.base.json`
4. Create `tsup.config.ts` for build configuration
5. Create `vitest.config.ts` if tests are needed
6. Register in `rush.json` projects array
7. Run `rush update`

### New Feature Checklist

1. Add types to `types.ts`
2. Implement in dedicated file(s)
3. Export from `index.ts`
4. Add tests in `tests/` directory
5. Update package consumers if needed
6. Update documentation in `/spec/`

## Documentation

After making changes, update relevant docs in `/spec/`:

| Document | When to Update |
|----------|----------------|
| `README.md` | Project overview changes |
| `getting-started.md` | Setup or installation changes |
| `architecture.md` | Architecture or design pattern changes |
| `tech-stack.md` | Dependency or tooling changes |
| `project-structure.md` | Directory or package structure changes |
| `business-logic.md` | Core logic or workflow changes |
| `api-reference.md` | API or interface changes |
| `knowledge-design.md` | Knowledge system changes |

## Error Handling

```typescript
import { AIError, ErrorCode, ErrorSeverity } from '@ai-stack/provider';

// Throw structured errors with context
throw new AIError(
  'Descriptive message',
  ErrorCode.VALIDATION_ERROR,
  ErrorSeverity.RECOVERABLE,
  { context: 'additional info' }
);
```

### Error Codes

| Code | Usage |
|------|-------|
| `VALIDATION_ERROR` | Invalid input or configuration |
| `NETWORK_ERROR` | API or network failures |
| `PROVIDER_ERROR` | LLM provider issues |
| `INTERNAL_ERROR` | Unexpected internal errors |

### Error Severities

| Severity | Usage |
|----------|-------|
| `RECOVERABLE` | Can retry or fallback |
| `CRITICAL` | Cannot continue |

## Testing Guidelines

- All packages should pass type checking: `rushx typecheck`
- Run full build to verify: `rush build`
- Write tests for new features using Vitest
- Run tests with `rushx test`
- Test CLI tools manually via examples

## Performance Considerations

- Use streaming for LLM responses
- Prefer direct stdout for token output (faster than Ink)
- Use Ink components only for interactive UI
- Lazy load optional dependencies
- Use SQLite store for production, JSON store for development/testing
