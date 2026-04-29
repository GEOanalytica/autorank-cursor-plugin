import type {
  ContentIdeaToolResult,
  ExplainIdeaToolResult,
} from "./types.js";

function renderBulletList(items: string[], prefix = "- "): string {
  if (items.length === 0) return `${prefix}None`;
  return items.map((item) => `${prefix}${item}`).join("\n");
}

export function formatContentIdeasResult(result: ContentIdeaToolResult): string {
  const ideas = result.ideas
    .map((idea, index) => {
      return [
        `${index + 1}. ${idea.title}`,
        `   Type: ${idea.content_type}`,
        `   Priority: ${idea.priority}`,
        `   Reason: ${idea.reason}`,
      ].join("\n");
    })
    .join("\n");

  return [
    `Topic: ${result.topic.name}`,
    `Prompts used: ${result.evidence_summary.prompts_used.length}`,
    `Prompts with results: ${result.evidence_summary.prompts_with_results}`,
    `Content gap status: ${result.evidence_summary.content_gap_status ?? "unknown"}`,
    result.evidence_summary.target_url
      ? `Existing page: ${result.evidence_summary.target_url}`
      : "Existing page: none found",
    "",
    "Ideas:",
    ideas || "No ideas returned.",
    "",
    "Top competitor domains:",
    renderBulletList(result.evidence_summary.top_competitor_domains),
    "",
    "Sample cited URLs:",
    renderBulletList(result.evidence_summary.sample_cited_urls),
  ].join("\n");
}

export function formatExplainIdeaResult(result: ExplainIdeaToolResult): string {
  return [
    `Idea: ${result.idea.title}`,
    `Content type: ${result.idea.content_type}`,
    `Priority: ${result.idea.priority}`,
    "",
    "Why this matters:",
    result.why_this_matters,
    "",
    "Relevant prompts:",
    renderBulletList(result.relevant_prompts),
    "",
    "Competitors cited:",
    renderBulletList(result.competitors_cited),
    "",
    "Cited URLs:",
    renderBulletList(result.cited_urls),
    "",
    `Existing page: ${result.existing_page ?? "none found"}`,
    "",
    `Recommended angle: ${result.recommended_angle}`,
    result.proof_notes ? `Proof notes: ${result.proof_notes}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}
