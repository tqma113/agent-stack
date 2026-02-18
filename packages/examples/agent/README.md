# Agent Stack Examples

This directory contains example configurations and skills for ai-stack.

## Quick Start

```bash
# Install ai-stack globally (or use npx)
npm install -g @ai-stack/agent

# Go to examples directory
cd example

# Start interactive chat
ai-stack chat

# Or run a single task
ai-stack run "List the files in this directory"
```

## Directory Structure

```
example/
├── ai-stack.json   # Agent configuration
├── mcp.json           # MCP server configuration
├── memory/       # Runtime memory data (auto-created)
│   └── sqlite.db       # SQLite memory database
├── knowledge/       # Runtime knowledge data (auto-created)
│   └── sqlite.db       # SQLite knowledge database
├── skills/             # Example skills
│   ├── file-skill/     # File operations
│   ├── shell-skill/    # Shell commands
│   └── search-skill/   # File search
└── README.md
```

## Configuration Files

### .ai-stack.json

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
  },
  "memory": {
    "enabled": true,
    "dbPath": "./memory/sqlite.db",
    "autoInitialize": true,
    "autoInject": true
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
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/fetch"]
    },
    "time": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/time"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/git"]
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

### memory-skill (@ai-stack-skill/memory)

Persistent memory across conversations.

**Tools:**
- `search` - Search memory across layers (events, profiles, semantic, summaries, tasks)
- `upsert` - Create or update memory entries
- `delete` - Delete memory entries

### knowledge-skill (@ai-stack-skill/knowledge)

Code and documentation search with hybrid FTS + vector retrieval.

**Tools:**
- `search_code` - Search code with language/symbol filters
- `search_docs` - Search indexed documentation
- `index_code` - Trigger code re-indexing
- `add_doc_source` - Add a documentation URL to index
- `remove_doc_source` - Remove a documentation source
- `list_doc_sources` - List all documentation sources
- `crawl_docs` - Crawl and index documentation
- `get_knowledge_stats` - Get indexing statistics

## Memory System

The agent has a persistent memory system with five layers:

| Layer | Purpose | Priority |
|-------|---------|----------|
| Profile | User preferences (language, format) | Highest |
| TaskState | Current task (goal, plan, progress) | High |
| Summary | Rolling summary (decisions, todos) | Medium |
| Events | Event log (messages, tool calls) | Low |
| Semantic | Searchable chunks (FTS + vector) | Lowest |

### Memory Configuration

```json
{
  "memory": {
    "enabled": true,
    "dbPath": "./memory/sqlite.db",
    "autoInitialize": true,
    "autoInject": true,
    "tokenBudget": {
      "profile": 200,
      "taskState": 300,
      "recentEvents": 500,
      "semanticChunks": 800,
      "summary": 400,
      "total": 2200
    },
    "writePolicy": {
      "autoSummarize": true,
      "summarizeEveryNEvents": 20,
      "conflictStrategy": "latest"
    },
    "retrieval": {
      "maxRecentEvents": 10,
      "maxSemanticChunks": 5,
      "enableSemanticSearch": true
    }
  }
}
```

## Knowledge System

The agent includes a code and documentation indexing system with hybrid FTS + vector search:

| Feature | Description |
|---------|-------------|
| Code Indexing | AST-aware chunking for TypeScript/JavaScript |
| Doc Indexing | Crawl URLs, sitemaps, GitHub repos |
| Hybrid Search | Full-text + vector similarity |
| Auto Inject | Relevant context injected into prompts |

### Knowledge Configuration

```json
{
  "knowledge": {
    "enabled": true,
    "code": {
      "enabled": true,
      "rootDir": ".",
      "extensions": [".ts", ".js", ".json", ".md"],
      "excludePatterns": ["node_modules/**", "dist/**"]
    },
    "doc": {
      "enabled": true,
      "sources": [
        {
          "name": "OpenAI Docs",
          "url": "https://platform.openai.com/docs",
          "type": "sitemap"
        }
      ]
    },
    "search": {
      "autoSearch": true,
      "autoInject": true,
      "minScore": 0.3,
      "maxResults": 5
    },
    "autoInitialize": true
  }
}
```

## CLI Commands

```bash
# Interactive chat (loads config automatically)
ai-stack chat

# Single task execution
ai-stack run "<task>"

# List available tools
ai-stack tools list

# Show tool details
ai-stack tools info <name>

# Configuration management
ai-stack config init    # Create config template
ai-stack config show    # Show current config
```

## Creating Your Own Skills

Each skill is a directory with:
- `skill.json` - Skill definition
- `handlers.js` - Tool implementations

See `skills/` directory for examples.

## Example Prompts

Try these with `ai-stack chat`:

### Basic Operations
- "List the files in this directory"
- "Read the README.md file"
- "Create a file called hello.txt with 'Hello World'"
- "Find all JSON files"
- "Search for 'agent' in the skill files"

### Memory Operations
- "Remember that my preferred language is Chinese"
- "What do you remember about my preferences?"
- "Search your memory for information about skills"
- "Forget my language preference"

### Time Operations
- "What is the current time?"
- "What time is it in Tokyo?"
- "Convert 3pm New York time to London time"

### Git Operations
- "Show the git status"
- "Show recent commits"
- "What changes were made in the last commit?"

### Web Operations
- "Fetch the content from https://example.com"
- "Search the OpenAI documentation for embeddings"

### Knowledge Operations
- "Index the codebase"
- "Search the code for agent implementation"
- "Find all functions related to memory"
- "Add the OpenAI docs as a documentation source"
- "Show knowledge statistics"
- "Search docs for how to use embeddings"
