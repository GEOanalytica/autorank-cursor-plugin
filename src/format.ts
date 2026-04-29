import type {
  ArticleIdeasToolResult,
  CreateArticleToolResult,
} from "./types.js";

function renderBulletList(items: string[], prefix = "- "): string {
  if (items.length === 0) return `${prefix}None`;
  return items.map((item) => `${prefix}${item}`).join("\n");
}

export function formatArticleIdeasResult(result: ArticleIdeasToolResult): string {
  const ideas = result.ideas
    .map((idea, index) => {
      return [
        `${index + 1}. ${idea.title}`,
        `   Type: ${idea.content_type}`,
        `   Reader intent: ${idea.reader_intent_takeaway ?? "Not specified"}`,
        `   Why this works: ${idea.why_this_works}`,
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Topic: ${result.topic.name}`,
    `Evidence status: ${result.evidence_summary.status}`,
    `Prompts checked: ${result.evidence_summary.prompts_used.length}`,
    `Prompts with results: ${result.evidence_summary.prompts_with_results}`,
    result.evidence_summary.notes ? `Notes: ${result.evidence_summary.notes}` : null,
    "",
    "Article ideas:",
    ideas || "No ideas returned.",
    "",
    "Top cited domains:",
    renderBulletList(result.evidence_summary.top_cited_domains),
    "",
    "Sample cited URLs:",
    renderBulletList(result.evidence_summary.sample_cited_urls),
    "",
    "Next step: ask AutoRank to create article 1, 2, or 3.",
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
}

export function formatCreateArticleResult(result: CreateArticleToolResult): string {
  return [
    `Article: ${result.title}`,
    `AutoRank article ID: ${result.article_id}`,
    result.job_id ? `Writer job ID: ${result.job_id}` : null,
    "",
    result.markdown,
    result.sources.length > 0 ? "\nSources:" : null,
    result.sources.length > 0
      ? renderBulletList(result.sources.map((source) => `${source.name}: ${source.url}`))
      : null,
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
}
