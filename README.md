# AutoRank Cursor Plugin

AutoRank helps Cursor users turn a business topic into article ideas, then write the selected idea as a full markdown draft without leaving the IDE.

This public repository intentionally contains only Cursor-facing glue:

- Cursor plugin manifest
- Cursor skill instructions
- stdio MCP wrapper
- response formatting and latest-run state

The private AutoRank platform owns authentication, entitlements, domain scoping, scraping, citation analysis, article ideas, and article generation.

## Cursor Marketplace Repository

Use this public GitHub repository URL in Cursor's plugin submission form:

```text
https://github.com/GEOanalytica/autorank-cursor-plugin
```

Do not submit the private AutoRank app repository.

## What The Plugin Does

The reviewer flow is:

1. Ask Cursor for article ideas about a topic, for example `Give me article ideas about jacuzzi maintenance`.
2. AutoRank returns 1 to 3 article ideas with reader intent, takeaway, outline, why the idea works, and evidence notes.
3. Ask Cursor to write one selected idea, for example `Create article 1`.
4. AutoRank returns a complete markdown article draft and source metadata.

The public MCP surface is intentionally small:

- `get_article_ideas_for_topic`
- `create_article`

No signup, OTP, workspace setup, Supabase token, or debug-token tools are exposed.

## Requirements

- Node.js 20+
- AutoRank MCP API key scoped to a domain
- AutoRank domain ID
- AutoRank API base URL

Without these values, the MCP server still starts in labelled demo mode so reviewers can inspect the UX without customer data. Live results require a scoped AutoRank MCP key.

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

The key must be scoped to the requested domain. To force demo mode even when other environment variables are present:

```bash
export AUTORANK_DEMO_MODE=1
```

## Local Development

```bash
npm install
npm run type-check
npm test
npm run test:e2e
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

The marketplace `mcp.json` uses `npx -y github:GEOanalytica/autorank-cursor-plugin`, so it can run from the public GitHub repo without publishing a public npm package.

## Reviewer Smoke

With live Preview or production credentials set:

```bash
export AUTORANK_API_KEY="amcp_..."
export AUTORANK_DOMAIN_ID="..."
export AUTORANK_API_BASE_URL="https://<project-ref>.supabase.co/functions/v1"
export AUTORANK_E2E_TOPIC="pool cleaning"
npm run test:live
```

Manual Cursor check:

1. Enable the plugin.
2. Ask: `Give me article ideas about pool cleaning`.
3. Confirm Cursor shows ranked ideas with reader intent, why each idea works, and evidence notes.
4. Ask: `Create article 1`.
5. Confirm Cursor returns full markdown for the article and does not show API keys, Supabase tokens, OTP codes, or setup internals.

## Tools

### `get_article_ideas_for_topic`

Turns a business topic into article ideas. Live mode uses AutoRank domain context and AI-search evidence when available. Demo mode returns clearly labelled sample evidence.

Inputs:

- `topic_text`: topic to explore
- `num_prompts`: optional, 3 to 5
- `num_ideas`: optional, 1 to 3
- `evidence_wait_ms`: optional live evidence wait budget
- `ideas_wait_ms`: optional article-idea wait budget

### `create_article`

Writes the selected idea from the latest `get_article_ideas_for_topic` run as full markdown.

Inputs:

- `idea_index`: 1-based idea number from the latest ideas run
- `article_length`: optional, `short` or `medium`
- `reader_level`: optional, `standard` or `expert`
- `article_wait_ms`: optional article writer wait budget

## Security Boundary

The wrapper does not store or expose Supabase access tokens, refresh tokens, service-role keys, signup session IDs, OTP codes, or AutoRank API keys.

Local state is limited to the latest article-ideas run so `create_article` can reference the selected idea. Full article markdown is returned to Cursor but is not persisted locally.

Local state is written to:

```text
~/.config/autorank-mcp/state.json
```

Override this during tests or local development with:

```bash
export AUTORANK_MCP_STATE_PATH="/tmp/autorank-mcp-state.json"
```

## Risk Mitigation

This plugin is isolated from the core AutoRank app. The public repository contains only Cursor-facing glue and calls one small backend API contract owned by AutoRank.

Release gates:

1. Unit tests pass: `npm test`
2. Stdio e2e passes: `npm run test:e2e`
3. Public install demo smoke passes: `npx -y github:GEOanalytica/autorank-cursor-plugin`
4. Live e2e passes against Preview or production: `npm run test:live`
5. Tool list exposes only `get_article_ideas_for_topic` and `create_article`
6. No secrets or full markdown are written to local state
