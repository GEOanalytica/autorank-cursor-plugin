# AutoRank Cursor Plugin

AutoRank Content Ideas is a thin Cursor/MCP wrapper for generating content ideas and briefs backed by AutoRank AI-search citation evidence.

This public repo intentionally contains only Cursor-facing glue:

- Cursor plugin manifest
- Cursor skill instructions
- stdio MCP wrapper
- formatting and local latest-run state

The private AutoRank platform owns authentication, entitlements, domain scoping, scraping, citation analysis, and content-idea orchestration.

## Cursor Marketplace Repository

Use this public GitHub repository URL in Cursor's plugin submission form:

```text
https://github.com/autorank-ai/autorank-cursor-plugin
```

Do not submit the private AutoRank app repository.

## Requirements

- Node.js 20+
- AutoRank MCP API key scoped to a domain
- AutoRank domain ID
- AutoRank API base URL

## Configure

Set these variables in the shell that starts Cursor, a local `.env`, or Cursor's MCP config:

```bash
export AUTORANK_API_KEY="amcp_..."
export AUTORANK_DOMAIN_ID="..."
export AUTORANK_API_BASE_URL="https://<project-ref>.supabase.co/functions/v1"
```

The wrapper calls:

```text
POST $AUTORANK_API_BASE_URL/mcp-content-ideas
Authorization: Bearer $AUTORANK_API_KEY
```

The key must be scoped to the requested domain.

## Local Development

```bash
npm install
npm run build
npm test
npm start
```

## Local Cursor Setup

For local development, build and link the package:

```bash
npm run build
npm link
```

Then point Cursor at the linked command:

```json
{
  "mcpServers": {
    "autorank": {
      "type": "stdio",
      "command": "autorank-cursor-mcp",
      "env": {
        "AUTORANK_API_KEY": "${env:AUTORANK_API_KEY}",
        "AUTORANK_DOMAIN_ID": "${env:AUTORANK_DOMAIN_ID}",
        "AUTORANK_API_BASE_URL": "${env:AUTORANK_API_BASE_URL}"
      }
    }
  }
}
```

Cursor can use `.cursor/mcp.json` for a project-level config or `~/.cursor/mcp.json` for a global config.

The marketplace `mcp.json` uses `npx -y @autorank/cursor-mcp`, so the package must be published before marketplace submission.

## Tools

### `get_content_ideas_for_topic`

Generates prompts, gathers citation evidence through AutoRank, and returns compact content ideas.

### `explain_content_idea`

Explains one idea from the latest run with cited prompts, competitors, URLs, and existing-page status.

### `create_content_brief`

Creates a lightweight brief from one idea in the latest run.

## Security Boundary

The wrapper does not store or expose Supabase access tokens, refresh tokens, service-role keys, signup session IDs, or OTP codes.

Local state is limited to the latest topic run and is written to:

```text
~/.config/autorank-mcp/state.json
```

Override this during tests or local development with:

```bash
export AUTORANK_MCP_STATE_PATH="/tmp/autorank-mcp-state.json"
```
