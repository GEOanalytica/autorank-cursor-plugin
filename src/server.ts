#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { formatContentIdeasResult, formatExplainIdeaResult } from "./format.js";
import { AutorankMcpService } from "./service.js";
import { FileStateStore } from "./state.js";

export type AutorankToolService = Pick<
  AutorankMcpService,
  "getContentIdeasForTopic" | "explainIdea" | "createContentBrief"
>;

function asStructuredContent<T extends object>(value: T): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export function createAutorankMcpServer(
  service: AutorankToolService = new AutorankMcpService(new FileStateStore()),
): McpServer {
  const server = new McpServer(
    {
      name: "autorank-mcp",
      version: "0.1.0",
    },
    {
      instructions:
        "Use get_content_ideas_for_topic to generate citation-informed content ideas, then explain_content_idea or create_content_brief for follow-up work. Configure AUTORANK_API_KEY, AUTORANK_DOMAIN_ID, and AUTORANK_API_BASE_URL.",
    },
  );

  server.registerTool(
    "get_content_ideas_for_topic",
    {
      title: "Get content ideas for topic",
      description:
        "Generate prompts for a topic, gather citation proof, and return content ideas backed by AutoRank evidence.",
      inputSchema: {
        topic_text: z.string().describe("Topic to explore, for example AI visibility monitoring for startups"),
        num_prompts: z.number().int().min(3).max(10).optional(),
        num_ideas: z.number().int().min(1).max(5).optional(),
        evidence_wait_ms: z.number().int().min(1000).max(300000).optional(),
        ideas_wait_ms: z.number().int().min(1000).max(300000).optional(),
      },
      outputSchema: {
        topic: z.object({
          id: z.string(),
          name: z.string(),
        }),
        evidence_summary: z.object({
          prompts_used: z.array(z.string()),
          prompts_with_results: z.number(),
          top_competitor_domains: z.array(z.string()),
          sample_cited_urls: z.array(z.string()),
          target_url: z.string().nullable(),
          content_gap_status: z.enum(["gap", "partial"]).nullable(),
          pattern_summary: z.string().nullable(),
        }),
        ideas: z.array(
          z.object({
            article_id: z.string().nullable(),
            title: z.string(),
            content_type: z.string(),
            priority: z.enum(["high", "medium", "low"]),
            reason: z.string(),
            why_this_works: z.string(),
            suggested_outline: z.array(z.string()),
            reader_intent_takeaway: z.string().nullable(),
            information_gain_slot: z.string().nullable(),
            prompt: z.string().nullable(),
            intent_types: z.array(z.string()),
          }),
        ),
      },
    },
    async ({ topic_text, num_prompts, num_ideas, evidence_wait_ms, ideas_wait_ms }) => {
      const result = await service.getContentIdeasForTopic({
        topicText: topic_text,
        numPrompts: num_prompts,
        numIdeas: num_ideas,
        evidenceWaitMs: evidence_wait_ms,
        ideasWaitMs: ideas_wait_ms,
      });

      const structuredContent = {
        topic: {
          id: result.topicId,
          name: result.topicName,
        },
        evidence_summary: {
          prompts_used: result.promptTexts,
          prompts_with_results: result.promptsWithResults,
          top_competitor_domains: result.topCompetitorDomains,
          sample_cited_urls: result.sampleCitedUrls,
          target_url: result.targetUrl,
          content_gap_status: result.contentGapStatus,
          pattern_summary: result.patternSummary,
        },
        ideas: result.ideas.map((idea) => ({
          article_id: idea.articleId,
          title: idea.headline,
          content_type: idea.contentType,
          priority: idea.priority,
          reason: idea.reason,
          why_this_works: idea.whyThisWorks,
          suggested_outline: idea.suggestedOutline,
          reader_intent_takeaway: idea.readerIntentTakeaway,
          information_gain_slot: idea.informationGainSlot,
          prompt: idea.prompt,
          intent_types: idea.intentTypes,
        })),
      };

      return {
        content: [{ type: "text", text: formatContentIdeasResult(structuredContent) }],
        structuredContent: asStructuredContent(structuredContent),
      };
    },
  );

  server.registerTool(
    "explain_content_idea",
    {
      title: "Explain content idea",
      description:
        "Explain one of the most recently generated content ideas using the stored topic run state.",
      inputSchema: {
        idea_index: z.number().int().min(1).describe("1-based idea index from the latest get_content_ideas_for_topic call"),
      },
      outputSchema: {
        idea: z.object({
          index: z.number(),
          title: z.string(),
          content_type: z.string(),
          priority: z.enum(["high", "medium", "low"]),
        }),
        why_this_matters: z.string(),
        relevant_prompts: z.array(z.string()),
        competitors_cited: z.array(z.string()),
        cited_urls: z.array(z.string()),
        existing_page: z.string().nullable(),
        recommended_angle: z.string(),
        proof_notes: z.string().nullable(),
      },
    },
    async ({ idea_index }) => {
      const result = await service.explainIdea(idea_index - 1);
      return {
        content: [{ type: "text", text: formatExplainIdeaResult(result) }],
        structuredContent: asStructuredContent(result),
      };
    },
  );

  server.registerTool(
    "create_content_brief",
    {
      title: "Create content brief",
      description:
        "Create a lightweight content brief for one of the most recently generated ideas.",
      inputSchema: {
        idea_index: z.number().int().min(1).describe("1-based idea index from the latest get_content_ideas_for_topic call"),
      },
      outputSchema: {
        title: z.string(),
        audience: z.string().nullable(),
        content_type: z.string(),
        target_prompts: z.array(z.string()),
        outline: z.array(z.string()),
        key_claims: z.array(z.string()),
        faq: z.array(z.string()),
        cta: z.string(),
        metadata_notes: z.array(z.string()),
      },
    },
    async ({ idea_index }) => {
      const result = await service.createContentBrief(idea_index - 1);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: asStructuredContent(result),
      };
    },
  );

  return server;
}

export async function runAutorankMcpServer(): Promise<void> {
  const server = createAutorankMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AutoRank MCP server running on stdio");
}

function isCliEntrypoint(): boolean {
  if (!process.argv[1]) return false;

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isCliEntrypoint()) {
  runAutorankMcpServer().catch((error) => {
    console.error("AutoRank MCP server failed:", error);
    process.exit(1);
  });
}
