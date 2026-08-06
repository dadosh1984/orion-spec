# Using Orion with AI agents

Orion exposes a **universal MCP server** (`orion mcp`) — a zero-dependency
implementation of the Model Context Protocol (JSON-RPC 2.0 over stdio).
Any MCP-capable agent attaches to it the same way and can call
`think`, `draft`, `forge`, `shield`, `out`, `scale`, `track_status`,
`track_prune`, `metrics`, `plugin_list`, `plugin_install`, `plugin_remove`,
`version` as native tools.

## Requirements

```bash
npm i -g orion-spec   # provides the `orion` binary
orion mcp --list      # sanity check: prints the tool manifest as JSON
```

## Agent setup

### Claude Code (Anthropic)

```bash
claude mcp add orion -- npx -y orion-spec mcp
```

### OpenAI Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.orion]
command = "orion"
args = ["mcp"]
```

### opencode

Add to `opencode.json`:

```json
{
  "mcp": {
    "orion": { "type": "local", "command": ["orion", "mcp"], "enabled": true }
  }
}
```

### Cursor

Settings → MCP → Add new server:

- Name: `orion`
- Command: `orion mcp`
- Transport: stdio

### Windsurf

`mcp_config.json` in the project:

```json
{
  "mcpServers": {
    "orion": { "command": "orion", "args": ["mcp"] }
  }
}
```

### Cline / Roo Code (VS Code)

Cline → MCP Servers → Add:

- Type: `stdio`, Command: `orion`, Args: `mcp`

### Continue.dev

`~/.continue/config.json` → `mcpServers`:

```json
{
  "mcpServers": {
    "orion": { "command": "orion", "args": ["mcp"] }
  }
}
```

### Zed

`.zed/settings.json`:

```json
{
  "context_servers": {
    "orion": { "command": "orion", "args": ["mcp"] }
  }
}
```

### Gemini CLI

```bash
gemini mcp add orion -- command "orion" --args "mcp"
```

### Goose (Block)

```bash
goose mcp add-orion --command orion --args mcp
```

### Generic MCP clients

Any tool speaking MCP over stdio connects the same way:

```json
{ "command": "orion", "args": ["mcp"], "transport": "stdio" }
```

## Terminal activity indicator

When an agent calls Orion tools over MCP, you see what is running in your
terminal via stderr (stdout stays protocol-clean):

```
⚙ orion:think "build a calculator"
✅ orion:think done
⚙ orion:draft build-a-calculator
❌ orion:draft failed — no proposal found …
```

Set `ORION_MCP_VERBOSE=0` to silence it.

## What the agent gets

| Tool                           | Purpose                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `think`                        | Capture an idea → `changes/<title>/proposal.json` (non-interactive: pass `platform`/`constraints`/`budget` inline) |
| `draft`                        | Generate `design.md`, `specs/`, `tasks.md`                                                                         |
| `forge`                        | Drive every task through RED-GREEN-REFACTOR (needs snippets in `changes/<title>/snippets/`)                        |
| `shield`                       | lint → type-check → tests → drift → security guard-rails                                                           |
| `out`                          | Final `result.md` summary                                                                                          |
| `scale`                        | YAGNI ladder on a file (`dry: true` = diff preview, no write)                                                      |
| `track_status` / `track_prune` | Cache (token economy) statistics and maintenance                                                                   |
| `metrics`                      | Benchmark + token budget by namespace                                                                              |
| `plugin_*`                     | Plugin marketplace management                                                                                      |

Tools return JSON text; failures come back as `isError: true` with a message
— the agent can read them directly.

## Manual protocol check

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"track_status","arguments":{}}}' \
| orion mcp
```

## Plain-CLI alternative

If the agent prefers shell tools over MCP, every Orion command also supports
`--json`:

```bash
orion shield my-change --json
orion track status --json
orion scale src/foo.ts --dry
orion metrics --json
```
