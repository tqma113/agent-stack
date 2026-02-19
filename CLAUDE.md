# AI Stack - Claude Code Instructions

## Project Overview

AI Stack is a TypeScript-based AI Agent development framework using Rush monorepo architecture. It provides multi-model LLM abstraction (OpenAI, Anthropic, Google Gemini), MCP protocol support, Skill system, Memory system, Knowledge indexing, Permission control, and TUI components.

## Quick Commands

```bash
# Install dependencies
rush update

# Build all packages
rush build

# Build specific package
rush build --to @ai-stack/agent

# Clean all
rush purge

# Run package script
cd packages/libs/agent && rushx start

# Type check
cd packages/libs/agent && rushx typecheck
```

## Project Structure

```
packages/
├── libs/           # Core libraries (@ai-stack/*)
│   ├── provider/   # Multi-model LLM abstraction
│   ├── mcp/        # MCP protocol support
│   ├── skill/      # Skill system
│   ├── memory/     # Memory strategies
│   ├── memory-store-sqlite/  # SQLite storage
│   ├── memory-store-json/    # JSON storage
│   ├── knowledge/  # Code/doc indexing
│   ├── tui/        # Terminal UI (Ink)
│   ├── agent/      # Agent implementation + CLI
│   ├── assistant/  # Personal AI assistant
│   └── code/       # Code editing agent
├── skills/         # Custom skills (@ai-stack-skill/*)
├── mcp-servers/    # MCP servers (@ai-stack-mcp/*)
└── examples/       # Usage examples
```

## Coding Conventions

### Factory Functions (NOT Classes)

Always use factory functions with closures:

```typescript
// CORRECT
export function createMyComponent(config: MyConfig): MyComponentInstance {
  // Private state via closure
  let state = initialState;

  // Return interface
  return {
    method() { ... },
    getState() { return state; },
  };
}

// WRONG - Don't use classes
export class MyComponent { ... }
```

### Type Naming

- Factory function: `createXxx`
- Return type interface: `XxxInstance`
- Config type: `XxxConfig`

### File Organization

- `index.ts` - Public exports only
- `types.ts` - Type definitions
- `*.ts` - Implementation files

### Imports

```typescript
// Use .js extension for local imports (ESM)
import { foo } from './foo.js';

// Workspace dependencies
import { createAgent } from '@ai-stack/agent';
```

## Documentation Requirements

After modifying the project, update these files in `/spec/`:
- `README.md` - Project overview
- `tech-stack.md` - Technology details
- `project-structure.md` - Structure details
- `business-logic.md` - Business logic
- `api-reference.md` - API reference

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ~5.7.2 | Language |
| Node.js | >=20.0.0 <23.0.0 | Runtime |
| pnpm | 9.15.9 | Package manager |
| Rush | 5.165.0 | Monorepo tool |
| tsup | ^8.3.5 | Build tool |
| openai | ^4.77.0 | OpenAI SDK |
| ink | ^5.0.1 | TUI framework |
| better-sqlite3 | ^11.7.0 | Database |
| zod | ^3.24.0 | Schema validation |

## Package Dependencies

```
@ai-stack/provider → openai, @anthropic-ai/sdk, @google/generative-ai
@ai-stack/mcp → @modelcontextprotocol/sdk
@ai-stack/memory → @ai-stack/memory-store-sqlite (types)
@ai-stack/knowledge → @ai-stack/memory-store-sqlite, @ai-stack/memory
@ai-stack/tui → ink, @inkjs/ui, chalk, boxen, ora, diff, react
@ai-stack/agent → provider, mcp, skill, memory, knowledge, tui
@ai-stack/assistant → agent, memory, memory-store-sqlite, tui
@ai-stack/code → agent, mcp, provider, tui
```

## Build Configuration

- **Module formats**: CJS + ESM dual output
- **Type declarations**: Auto-generated `.d.ts`
- **Source maps**: Enabled
- **Build tool**: tsup

## Common Tasks

### Adding a New Package

1. Create directory under `packages/libs/`, `packages/skills/`, or `packages/mcp-servers/`
2. Add `package.json`, `tsconfig.json`, `tsup.config.ts`
3. Register in `rush.json`
4. Run `rush update`

### Adding Dependencies

```bash
cd packages/libs/mypackage
pnpm add some-package
rush update
```

### Running Examples

```bash
# Agent example
cd packages/examples/agent && rushx start

# Code agent example
cd packages/examples/code && rushx start
```

## Testing

```bash
# Type check all packages
rush build

# Type check single package
cd packages/libs/agent && rushx typecheck
```

## Error Handling

Use the unified error system from `@ai-stack/provider`:

```typescript
import { AIError, ErrorCode, ErrorSeverity } from '@ai-stack/provider';

throw new AIError('Message', ErrorCode.VALIDATION_ERROR, ErrorSeverity.CRITICAL);
```

## TUI Components

The `@ai-stack/tui` package provides:
- **Ink components**: DiffView, Confirm, Select, TaskBoard, HistoryBrowser
- **Classic utilities**: StreamRenderer, spinners, themed output
- **Hybrid architecture**: Ink for interactive UI, direct stdout for streaming
