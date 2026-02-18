# @ai-stack-mcp/fetch

MCP (Model Context Protocol) server for web fetching with automatic HTML to Markdown conversion.

## Features

- Fetch web pages and convert HTML to clean Markdown
- CSS selector support for extracting specific content
- Configurable timeout and max content length
- Domain allow/block lists for security
- Automatic redirect handling
- Graceful error handling

## Installation

```bash
npm install @ai-stack-mcp/fetch
```

## Usage

### As MCP Server (stdio)

```bash
# Run directly
npx @ai-stack-mcp/fetch

# Or via mcp-fetch command
mcp-fetch
```

### MCP Configuration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@ai-stack-mcp/fetch"]
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_FETCH_NAME` | Server name | `ai-stack-mcp-fetch` |
| `MCP_FETCH_USER_AGENT` | Default User-Agent | Mozilla compatible |
| `MCP_FETCH_TIMEOUT` | Default timeout (ms) | `30000` |
| `MCP_FETCH_MAX_LENGTH` | Default max length (chars) | `50000` |
| `MCP_FETCH_ALLOWED_DOMAINS` | Comma-separated allowed domains | (all allowed) |
| `MCP_FETCH_BLOCKED_DOMAINS` | Comma-separated blocked domains | (none blocked) |

### Programmatic Usage

```typescript
import { fetchUrl, createServer } from '@ai-stack-mcp/fetch';

// Direct fetch
const result = await fetchUrl({
  url: 'https://example.com',
  maxLength: 10000,
  selector: 'article',
});

console.log(result.title);
console.log(result.content);

// Create custom server
const server = createServer({
  allowedDomains: ['example.com', 'docs.example.com'],
  defaultTimeout: 15000,
});
```

## Tool Schema

### `fetch`

Fetches content from a URL and converts HTML to Markdown.

**Input:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | The URL to fetch (http/https) |
| `maxLength` | number | No | Max content length (default: 50000) |
| `timeout` | number | No | Request timeout in ms (default: 30000) |
| `userAgent` | string | No | Custom User-Agent header |
| `selector` | string | No | CSS selector to extract content |
| `raw` | boolean | No | Return raw HTML (default: false) |

**Output:**

Returns Markdown content with metadata:

```markdown
# Page Title

**URL:** https://example.com
**Status:** 200
**Content-Type:** text/html
**Length:** 12345 chars

---

[Converted Markdown content...]
```

## License

MIT
