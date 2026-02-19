# @ai-stack-example/code

Example project demonstrating the `@ai-stack/code` package - a Code editing AI agent.

## Features

- **File Operations**: Read, Write, Edit files with safety checks
- **Search**: Glob file patterns, Grep content search
- **Task Management**: Create, update, list tasks
- **Undo/Redo**: Full change history with checkpoint support
- **MCP Integration**: Git, Bash, LSP, and Fetch tools

## Quick Start

```bash
# Start interactive chat
pnpm start

# Or use specific commands
pnpm run chat      # Start chat mode
pnpm run undo      # Undo last file change
pnpm run redo      # Redo undone change
pnpm run history   # View change history
pnpm run tasks     # List tasks
```

## Configuration

### code.json

Main configuration file for the Code Agent:

- `model` - LLM model to use
- `safety` - Path restrictions and content validation
- `history` - Undo/redo history settings
- `tasks` - Task management settings
- `mcp` - MCP server configuration

### mcp.json

MCP servers configuration:

- `fetch` - Web content fetching
- `bash` - Shell command execution
- `git` - Git repository operations
- `lsp` - Language Server Protocol for code intelligence

## Example Usage

```
You: Read the package.json file

AI: [Reads and displays package.json with line numbers]

You: Add a new script "test": "echo test"

AI: [Uses Edit tool to add the script, records history for undo]

You: Undo that change

AI: [Restores previous version of package.json]
```

## Tools Available

### Built-in Tools (from @ai-stack/code)
- `Read` - Read files with line numbers
- `Write` - Write/create files
- `Edit` - Search & replace editing
- `Glob` - Find files by pattern
- `Grep` - Search file contents
- `TaskCreate/Update/List/Get` - Task management
- `Undo/Redo` - Change history navigation

### MCP Tools
- `bash_execute` - Run shell commands
- `git_*` - Git operations (status, diff, commit, etc.)
- `lsp_*` - Code intelligence (hover, definition, references, etc.)
- `fetch` - Fetch web content
