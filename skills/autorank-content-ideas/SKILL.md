---
name: autorank-content-ideas
description: Generate AutoRank-backed content ideas, explanations, and briefs from AI-search citation evidence. Use when the user asks for content ideas, GEO content opportunities, AI search visibility gaps, or briefs based on AutoRank data.
---

# AutoRank Content Ideas

Use the AutoRank MCP tools when the user wants marketable content ideas grounded in AI-search visibility evidence.

## Workflow

1. Call `get_content_ideas_for_topic` with the topic the user wants to explore.
2. Use `explain_content_idea` when the user asks why an idea matters or wants proof.
3. Use `create_content_brief` when the user wants an actionable article/page brief.

## Tool Guidance

- Keep `topic_text` specific enough to generate useful prompts.
- Prefer 3 to 5 ideas for first-pass ideation.
- Treat cited competitors, cited URLs, and existing-page status as evidence, not as exhaustive research.
- Do not ask the user for Supabase tokens, refresh tokens, service-role keys, signup sessions, or OTP codes.
- If the MCP server reports a missing `AUTORANK_API_KEY`, tell the user to create a scoped AutoRank MCP key in AutoRank and set it in their environment.

## Output Style

- Lead with the recommended idea or brief.
- Mention the evidence signals that matter: prompts used, competitor citations, cited URLs, and whether AutoRank found an existing target URL.
- Keep implementation guidance concrete enough for a writer or founder to act on immediately.
