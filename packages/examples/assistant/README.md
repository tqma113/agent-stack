# @ai-stack-example/assistant

Personal AI Assistant example using `@ai-stack/assistant`.

## Features

- **Markdown Memory**: Edit `MEMORY.md` to store facts, todos, and notes
- **Multi-channel**: CLI (default), Telegram, Discord support
- **Scheduler**: Set reminders and scheduled tasks
- **MCP Tools**: Web fetch, time/timezone, bash commands

## Quick Start

```bash
# Install dependencies
rush update

# Configure your API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start interactive chat
rushx chat
```

## Commands

### Chat Mode
```bash
rushx chat              # Start interactive chat
rushx start             # Same as chat
```

### Daemon Mode
```bash
rushx daemon            # Start background daemon
rushx daemon:stop       # Stop daemon
rushx daemon:status     # Check daemon status
rushx daemon:logs       # View daemon logs
```

### Memory Management
```bash
rushx memory:sync       # Sync Markdown to index
rushx memory:show       # Show memory document
```

### Scheduler
```bash
rushx scheduler:list    # List scheduled tasks
```

### Configuration
```bash
rushx config:show       # Show current config
```

## Configuration

### assistant.json

Main configuration file:

```json
{
  "name": "My Personal Assistant",
  "agent": {
    "model": "gpt-4o",
    "temperature": 0.7
  },
  "memory": {
    "enabled": true,
    "syncOnStartup": true,
    "watchFiles": true
  },
  "gateway": {
    "channels": {
      "cli": { "enabled": true },
      "telegram": { "enabled": false }
    }
  },
  "scheduler": {
    "enabled": true,
    "allowAgentControl": true
  }
}
```

### MEMORY.md

Edit this file to store:
- **Profile**: Your name, timezone, preferences
- **Facts**: Things the assistant should remember
- **Todos**: Task checklist
- **Notes**: Free-form notes

```markdown
## Profile
- **Name**: Alice
- **Timezone**: Asia/Shanghai

## Facts
- Prefers concise responses
- Works on AI projects

## Todos
- [ ] Review PR #123
- [x] Setup assistant
```

## In-Chat Commands

During chat, you can use these slash commands:
- `/memory` - Show current memory document
- `/tasks` - Show scheduled tasks
- `/help` - Show available commands
- `exit` - Exit the chat

## Setting Reminders

Ask the assistant to set reminders:
```
You: Remind me in 5 minutes to take a break
Assistant: Reminder created...

You: Remind me tomorrow at 9:00 to check emails
Assistant: Reminder created...
```

## Enabling Telegram

1. Create a bot with [@BotFather](https://t.me/botfather)
2. Get the bot token
3. Add to `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your-token-here
   ```
4. Enable in `assistant.json`:
   ```json
   "telegram": {
     "enabled": true,
     "token": "${TELEGRAM_BOT_TOKEN}"
   }
   ```
5. Start the daemon: `rushx daemon`

## File Structure

```
assistant/
├── assistant.json     # Main configuration
├── mcp.json           # MCP server configuration
├── MEMORY.md          # Your memory (source of truth)
├── memory/            # Daily conversation logs
├── index.db           # SQLite search index (auto-generated)
├── scheduler.json     # Scheduled tasks (auto-generated)
└── .env               # Environment variables
```
