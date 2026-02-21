# AI Stack - Claude Code Instructions

## Project Overview

AI Stack is a TypeScript-based AI Agent development framework using Rush monorepo architecture. It provides:

- **Multi-model LLM abstraction** - OpenAI, Anthropic, Google Gemini
- **MCP protocol support** - Model Context Protocol integration
- **Skill system** - Extensible agent capabilities
- **Memory system** - Multiple storage backends (SQLite, JSON)
- **Knowledge indexing** - Code and document indexing
- **TUI components** - Terminal UI with Ink framework

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

# Watch mode (in package directory)
rushx dev

# Run tests
rushx test
```

## Project Structure

```
packages/
├── libs/                    # Core libraries (@ai-stack/*)
│   ├── provider/            # Multi-model LLM abstraction
│   ├── mcp/                 # MCP protocol support
│   ├── skill/               # Skill system
│   ├── memory/              # Memory strategies & pipelines
│   ├── memory-store-sqlite/ # SQLite storage backend
│   ├── memory-store-json/   # JSON file storage backend
│   ├── knowledge/           # Code/doc indexing
│   ├── tui/                 # Terminal UI (Ink)
│   ├── agent/               # Core agent implementation
│   ├── assistant/           # Personal AI assistant
│   └── code/                # Code editing agent
├── skills/                  # Custom skills (@ai-stack-skill/*)
│   ├── memory/              # Memory management skill
│   └── knowledge/           # Knowledge base skill
├── mcp-servers/             # MCP servers (@ai-stack-mcp/*)
│   ├── fetch/               # Web content fetching
│   ├── time/                # Time/timezone operations
│   ├── git/                 # Git operations
│   ├── bash/                # Bash execution
│   ├── lsp/                 # Language server protocol
│   └── electron-cdp/        # Electron CDP integration
└── examples/                # Usage examples (@ai-stack-example/*)
    ├── agent/               # Agent usage example
    ├── assistant/           # Assistant usage example
    └── code/                # Code agent example
```

## Coding Conventions

### Factory Functions (NOT Classes)

Always use factory functions with closures:

```typescript
// CORRECT - Factory function pattern
export function createMyComponent(config: MyConfig): MyComponentInstance {
  // Private state via closure
  let state = initialState;

  function privateMethod() { /* ... */ }

  // Return public interface
  return {
    method() { /* ... */ },
    getState() { return state; },
  };
}

// WRONG - Don't use classes
export class MyComponent { /* ... */ }
```

### Type Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Factory function | `createXxx` | `createAgent` |
| Instance interface | `XxxInstance` | `AgentInstance` |
| Config type | `XxxConfig` | `AgentConfig` |
| Options type | `XxxOptions` | `SearchOptions` |

### File Organization

```
src/
├── index.ts     # Public exports only
├── types.ts     # Type definitions
└── [feature].ts # Implementation files
```

### Import Conventions

```typescript
// Use .js extension for local imports (ESM)
import { foo } from './foo.js';

// Workspace dependencies
import { createAgent } from '@ai-stack/agent';
```

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ~5.7.2 | Language |
| Node.js | >=20.0.0 <23.0.0 | Runtime |
| pnpm | 9.15.9 | Package manager |
| Rush | 5.165.0 | Monorepo tool |
| tsup | ^8.3.5 | Build tool |
| openai | ^4.77.0 | OpenAI SDK |
| @anthropic-ai/sdk | latest | Anthropic SDK |
| @google/generative-ai | latest | Google Gemini SDK |
| @modelcontextprotocol/sdk | latest | MCP SDK |
| ink | ^5.0.1 | TUI framework |
| better-sqlite3 | ^11.7.0 | SQLite database |
| zod | ^3.24.0 | Schema validation |
| vitest | latest | Testing framework |

## Package Dependency Graph

```
@ai-stack/provider → openai, @anthropic-ai/sdk, @google/generative-ai
@ai-stack/mcp → @modelcontextprotocol/sdk
@ai-stack/memory → @ai-stack/memory-store-sqlite (types), @ai-stack/provider
@ai-stack/knowledge → @ai-stack/memory-store-sqlite, @ai-stack/memory
@ai-stack/skill → @ai-stack/provider
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
2. Add `package.json` with proper workspace dependencies
3. Add `tsconfig.json` extending common config
4. Add `tsup.config.ts` for build
5. Register in `rush.json` projects array
6. Run `rush update`

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

# Assistant example
cd packages/examples/assistant && rushx start

# Code agent example
cd packages/examples/code && rushx start
```

## Testing

```bash
# Run tests for a package
cd packages/libs/memory && rushx test

# Type check all packages
rush build

# Type check single package
cd packages/libs/agent && rushx typecheck
```

## Error Handling

Use the unified error system from `@ai-stack/provider`:

```typescript
import { AIError, ErrorCode, ErrorSeverity } from '@ai-stack/provider';

throw new AIError(
  'Descriptive message',
  ErrorCode.VALIDATION_ERROR,
  ErrorSeverity.CRITICAL,
  { context: 'additional info' }
);
```

## TUI Components

The `@ai-stack/tui` package provides:

- **Ink components**: DiffView, Confirm, Select, TaskBoard, HistoryBrowser
- **Classic utilities**: StreamRenderer, spinners, themed output
- **Hybrid architecture**: Ink for interactive UI, direct stdout for streaming

## Documentation Requirements

After modifying the project, update relevant docs in `/spec/`:

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview and introduction |
| `getting-started.md` | Quick start guide and setup instructions |
| `architecture.md` | System architecture and design patterns |
| `tech-stack.md` | Technology stack details |
| `project-structure.md` | Directory and package structure |
| `business-logic.md` | Core business logic documentation |
| `api-reference.md` | API reference and usage examples |
| `knowledge-design.md` | Knowledge system design details |

## Workflow

### Plan-first, then edit

Before making any code changes — including but not limited to:
- adding, deleting, refactoring, or moving files
- modifying configurations
- updating dependencies
- writing or modifying tests
- changing scripts or build logic

You MUST first produce a written PLAN, regardless of the complexity or size of the change. In complexity change, you can use plan mode.

### Save paln after confirm

When you are in plan mode, every time you make a new plan, you need to save all content of plan into dir /plan as a new markdown file after user confirm the paln.

### Test after editing

After completing any approved changes:

1. Run all relevant tests.
2. Add testcase if there is no relevant testcases
3. Run type checks and linters if applicable.
4. Verify that the project builds successfully.
5. Summarize:
   - What was changed
   - What tests were run
   - Test results
   - Any warnings or remaining risks

If any test fails:
- Stop immediately.
- Diagnose the issue.
- Present a correction PLAN before applying further changes.

### Update document for this project

Should update docs under /spec, /plan, CLAUDE.md, AGENT.md every time after finish some change.

