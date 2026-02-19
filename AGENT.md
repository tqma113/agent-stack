# AI Stack - AI Agent Instructions

This document provides instructions for AI agents working on the AI Stack codebase.

## Project Context

AI Stack is a comprehensive AI Agent development framework built with:
- **Architecture**: Rush monorepo with pnpm
- **Language**: TypeScript 5.7
- **Runtime**: Node.js 20+
- **Build**: tsup (CJS + ESM dual format)

## Core Design Principles

### 1. Factory Functions Over Classes

The project uses functional programming patterns. **Never create classes**.

```typescript
// Pattern: Factory function returning an interface
export function createComponent(config: Config): ComponentInstance {
  // Private state via closure
  let internalState = {};

  function privateMethod() { ... }

  // Public interface
  return {
    publicMethod() { ... },
    getState() { return internalState; }
  };
}
```

### 2. Type Naming Conventions

| Type | Naming Pattern | Example |
|------|----------------|---------|
| Factory function | `createXxx` | `createAgent` |
| Instance interface | `XxxInstance` | `AgentInstance` |
| Config type | `XxxConfig` | `AgentConfig` |
| Options type | `XxxOptions` | `SearchOptions` |

### 3. ESM Module System

- Use `.js` extension for relative imports: `import { foo } from './foo.js'`
- Package.json must have `"type": "module"` for ESM packages
- tsup generates both CJS and ESM outputs

## Package Organization

### Core Libraries (`packages/libs/`)

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@ai-stack/provider` | Multi-model LLM abstraction | `createOpenAIClient`, `createAnthropicClient`, `createGoogleClient` |
| `@ai-stack/mcp` | MCP protocol support | `createMCPClientManager`, `createMCPToolProvider` |
| `@ai-stack/skill` | Skill system | `createSkillManager`, `createSkillToolProvider` |
| `@ai-stack/memory` | Memory strategies | `createMemoryManager`, stores |
| `@ai-stack/knowledge` | Code/doc indexing | `createKnowledgeManager`, `createCodeIndexer`, `createDocIndexer` |
| `@ai-stack/tui` | Terminal UI | Ink components, StreamRenderer |
| `@ai-stack/agent` | Agent implementation | `createAgent` |
| `@ai-stack/assistant` | Personal assistant | Memory + Scheduler + Gateway |
| `@ai-stack/code` | Code editing agent | File ops + Undo/Redo |

### Skills (`packages/skills/`)

- `@ai-stack-skill/memory` - Memory management skill
- `@ai-stack-skill/knowledge` - Knowledge base skill

### MCP Servers (`packages/mcp-servers/`)

- `@ai-stack-mcp/fetch` - Web content fetching
- `@ai-stack-mcp/time` - Time/timezone operations
- `@ai-stack-mcp/git` - Git operations
- `@ai-stack-mcp/bash` - Bash execution
- `@ai-stack-mcp/lsp` - Language server protocol

## File Structure Conventions

Each package follows this structure:

```
packages/libs/mypackage/
├── src/
│   ├── index.ts        # Public exports only
│   ├── types.ts        # Type definitions
│   └── [feature].ts    # Implementation
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

## Common Patterns

### Tool Definition

```typescript
import { defineTool, defineParameters } from '@ai-stack/provider';

const myTool = defineTool({
  name: 'my_tool',
  description: 'Does something',
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

# Build specific package
rush build --to @ai-stack/agent

# Watch mode (in package directory)
rushx dev

# Type check
rushx typecheck
```

## Adding New Code

### New Package Checklist

1. Create directory structure
2. Create `package.json` with proper workspace dependencies
3. Create `tsconfig.json` extending common config
4. Create `tsup.config.ts` for build
5. Register in `rush.json` projects array
6. Run `rush update`

### New Feature Checklist

1. Add types to `types.ts`
2. Implement in dedicated file
3. Export from `index.ts`
4. Update package consumers if needed
5. Update documentation in `/spec/`

## Documentation

After making changes, update relevant docs in `/spec/`:
- `README.md` - Overview changes
- `project-structure.md` - Structure changes
- `business-logic.md` - Logic changes
- `api-reference.md` - API changes
- `tech-stack.md` - Dependency changes

## Error Handling

```typescript
import { AIError, ErrorCode, ErrorSeverity } from '@ai-stack/provider';

// Throw structured errors
throw new AIError(
  'Descriptive message',
  ErrorCode.VALIDATION_ERROR,
  ErrorSeverity.RECOVERABLE,
  { context: 'additional info' }
);
```

## Testing Guidelines

- All packages should pass type checking: `rushx typecheck`
- Run full build to verify: `rush build`
- Test CLI tools manually via examples

## Performance Considerations

- Use streaming for LLM responses
- Prefer direct stdout for token output (faster than Ink)
- Use Ink components only for interactive UI
- Lazy load optional dependencies
