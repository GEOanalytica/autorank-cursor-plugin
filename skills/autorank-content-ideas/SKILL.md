---
name: autorank-content-ideas
description: Generate AutoRank-backed article ideas and full markdown drafts from a business topic. Use when the user asks for blog post ideas, article ideas, SEO/GEO content, AI-search-informed topics, or a finished markdown article draft.
---

# AutoRank Article Ideas

Use the AutoRank MCP tools when the user wants to do lightweight marketing writing from inside Cursor.

## Workflow

1. If the user has not provided a topic, ask for one concise business topic before calling tools.
2. Call `get_article_ideas_for_topic` with the topic the user wants to explore. Default to 3 ideas; do not ask how many unless the user explicitly requests that choice.
3. Present the best ideas with title, reader intent, takeaway, why the idea works, and the evidence notes.
4. When the user picks an idea, call `create_article` with the 1-based idea number.
5. Return the markdown draft naturally in the conversation or edit the user's requested file if they ask you to place it in the repo.

## Tool Guidance

- Keep `topic_text` specific enough to generate useful article ideas.
- Return 3 ideas for first-pass ideation unless the user asks for 1 or 2. Never request more than 3 ideas.
- Treat cited competitors, cited URLs, and evidence notes as directional support, not exhaustive research.
- Do not ask the user for Supabase tokens, refresh tokens, service-role keys, signup sessions, OTP codes, or raw AutoRank API keys in chat.
- If the result says `Demo mode`, explicitly tell the user it is sample evidence and that live AutoRank results require `AUTORANK_API_KEY`, `AUTORANK_DOMAIN_ID`, and `AUTORANK_API_BASE_URL`.
- If the MCP server reports authorization or domain-scope errors, explain that the key must be scoped to the selected AutoRank domain and suggest checking `AUTORANK_DOMAIN_ID`.
- If the tool is slow, say that AutoRank is gathering AI-search evidence or writing the article, then keep the response focused on the next useful action.

## Output Style

- Do not dump raw JSON unless the user asks for it.
- Lead with the top article ideas and make the selection path obvious.
- For ideas, include what the reader wants, the takeaway, and why this article is worth writing.
- For completed articles, keep the markdown intact and avoid adding extra commentary inside the draft.
- Do not expose setup internals, tokens, raw API errors, or unrelated AutoRank product details.
