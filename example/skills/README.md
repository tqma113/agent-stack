# Example Skills

This directory contains example skills for use with agent-stack.

## Available Skills

| Skill | Description | Tools |
|-------|-------------|-------|
| file-skill | File operations | read_file, write_file, list_directory |
| shell-skill | Shell commands | execute_command |
| search-skill | File search | search_files, grep_content |

## Skill Structure

Each skill is a directory containing:

```
skill-name/
├── skill.json      # Skill definition
└── handlers.js     # Tool implementations
```

### skill.json Format

```json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "What the skill does",
  "tools": [
    {
      "name": "tool_name",
      "description": "What the tool does",
      "parameters": {
        "type": "object",
        "properties": {
          "param": { "type": "string", "description": "..." }
        },
        "required": ["param"]
      },
      "handler": "./handlers.js#functionName"
    }
  ]
}
```

### Handler Function

```javascript
// handlers.js
async function functionName(args) {
  const { param } = args;
  // Implementation
  return "Result string";
}

module.exports = { functionName };
```

## Creating Custom Skills

1. Create a new directory in `skills/`
2. Add `skill.json` with tool definitions
3. Add `handlers.js` with implementations
4. The skill will be auto-loaded when using `agent-stack chat`

## Security Notes

- shell-skill includes safety checks for dangerous commands
- Always review tool implementations before using in production
