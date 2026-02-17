# Agent Stack Examples

This directory contains example configurations and skills for agent-stack.

## Quick Start

```bash
# Install agent-stack globally (or use npx)
npm install -g @agent-stack/index

# Go to examples directory
cd examples

# Start interactive chat
agent-stack chat

# Or run a single task
agent-stack run "List the files in this directory"
```

## Directory Structure

```
examples/
├── .agent-stack.json   # Agent configuration
├── .mcp.json           # MCP server configuration
├── skills/             # Example skills
│   ├── file-skill/     # File operations
│   ├── shell-skill/    # Shell commands
│   └── search-skill/   # File search
└── README.md
```

## Configuration Files

### .agent-stack.json

Main agent configuration:

```json
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "systemPrompt": "You are a helpful assistant...",
  "skill": {
    "directories": ["./skills"],
    "autoLoad": true
  },
  "mcp": {
    "configPath": "./.mcp.json",
    "autoConnect": true
  }
}
```

### .mcp.json

MCP server configuration (compatible with Claude Code format):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}
```

## Available Skills

### file-skill

File operations: read, write, list directory.

**Tools:**
- `read_file` - Read file contents
- `write_file` - Write to a file
- `list_directory` - List directory contents

### shell-skill

Execute shell commands with safety checks.

**Tools:**
- `execute_command` - Run shell commands (warns on dangerous commands)

### search-skill

Search for files and content.

**Tools:**
- `search_files` - Find files by glob pattern
- `grep_content` - Search text in files

## CLI Commands

```bash
# Interactive chat (loads config automatically)
agent-stack chat

# Single task execution
agent-stack run "<task>"

# List available tools
agent-stack tools list

# Show tool details
agent-stack tools info <name>

# Configuration management
agent-stack config init    # Create config template
agent-stack config show    # Show current config
```

## Creating Your Own Skills

Each skill is a directory with:
- `skill.json` - Skill definition
- `handlers.js` - Tool implementations

See `skills/` directory for examples.

## Example Prompts

Try these with `agent-stack chat`:

- "List the files in this directory"
- "Read the README.md file"
- "Create a file called hello.txt with 'Hello World'"
- "Find all JSON files"
- "Search for 'agent' in the skill files"
- "What is the current date?"
