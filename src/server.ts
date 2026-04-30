#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import { DemoAutorankMcpService } from "./demo-service.js";
import { readAutorankEnv, type AutorankEnv } from "./env.js";
import {
  formatArticleIdeasResult,
  formatCreateArticleResult,
} from "./format.js";
import { AutorankMcpService, inferEvidenceStatus } from "./service.js";
import { FileStateStore } from "./state.js";

export type AutorankToolService = Pick<
  AutorankMcpService,
  "getArticleIdeasForTopic" | "createArticle"
>;

type ToolCallbackExtra = {
  _meta?: { progressToken?: string | number };
  sendNotification?: (notification: {
    method: "notifications/progress";
    params: {
      progressToken: string | number;
      progress: number;
      total?: number;
      message?: string;
    };
  }) => Promise<void>;
};

async function sendProgress(
  extra: ToolCallbackExtra | undefined,
  progress: number,
  total: number,
  message: string,
): Promise<void> {
  const progressToken = extra?._meta?.progressToken;
  if (!progressToken || !extra?.sendNotification) return;

  await extra.sendNotification({
    method: "notifications/progress",
    params: {
      progressToken,
      progress,
      total,
      message,
    },
  }).catch(() => {
    // Some MCP clients do not render progress notifications yet.
  });
}

function startProgressTicker(
  extra: ToolCallbackExtra | undefined,
  messages: string[],
): () => void {
  let index = 0;
  void sendProgress(extra, 1, messages.length + 1, messages[0]);

  const timer = setInterval(() => {
    index = Math.min(index + 1, messages.length - 1);
    void sendProgress(extra, index + 1, messages.length + 1, messages[index]);
  }, 7000);

  return () => clearInterval(timer);
}

function createMissingConfigService(missing: string[]): AutorankToolService {
  const message = [
    `AutoRank MCP is partially configured and cannot call the live API. Missing: ${missing.join(", ")}.`,
    "Set AUTORANK_API_KEY, AUTORANK_DOMAIN_ID, and AUTORANK_API_BASE_URL, or set AUTORANK_DEMO_MODE=1 for demo mode.",
  ].join(" ");

  return {
    async getArticleIdeasForTopic() {
      throw new Error(message);
    },
    async createArticle() {
      throw new Error(message);
    },
  };
}

function asStructuredContent<T extends object>(value: T): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function createDefaultService(): AutorankToolService {
  const stateStore = new FileStateStore();
  const envStatus = readAutorankEnv();

  if (
    envStatus.demoMode ||
    (!envStatus.hasExplicitAutorankConfig && envStatus.missing.length > 0)
  ) {
    return new DemoAutorankMcpService(stateStore);
  }

  if (envStatus.missing.length > 0) {
    return createMissingConfigService(envStatus.missing);
  }

  return new AutorankMcpService(stateStore, envStatus.env as AutorankEnv);
}

export function createAutorankMcpServer(
  service?: AutorankToolService,
): McpServer {
  const toolService = service ?? createDefaultService();
  const server = new McpServer(
    {
      name: "autorank-mcp",
      version: "0.1.0",
    },
    {
      instructions:
        "Use get_article_ideas_for_topic to generate article ideas from a business topic, then create_article to write the selected idea as full markdown. Configure AUTORANK_API_KEY, AUTORANK_DOMAIN_ID, and AUTORANK_API_BASE_URL for live AutoRank evidence.",
    },
  );

  server.registerTool(
    "get_article_ideas_for_topic",
    {
      title: "Get article ideas with AutoRank",
      description:
        "Turn a business topic into 1-3 article ideas. AutoRank returns quickly with live evidence when ready, or fast fallback ideas while background evidence jobs continue.",
      inputSchema: {
        topic_text: z.string().describe("Topic to explore, for example jacuzzi maintenance or passwordless login"),
        num_prompts: z.number().int().min(3).max(5).optional(),
        num_ideas: z.number().int().min(1).max(3).optional(),
        evidence_wait_ms: z.number().int().min(1000).max(300000).optional(),
        ideas_wait_ms: z.number().int().min(1000).max(300000).optional(),
      },
      outputSchema: {
        topic: z.object({
          id: z.string(),
          name: z.string(),
        }),
        evidence_summary: z.object({
          status: z.enum(["live", "cached", "fallback"]),
          prompts_used: z.array(z.string()),
          prompts_with_results: z.number(),
          top_cited_domains: z.array(z.string()),
          sample_cited_urls: z.array(z.string()),
          notes: z.string().nullable(),
        }),
        workflow_status: z.object({
          mode: z.enum(["live_ideas", "fast_fallback", "stored_ideas"]),
          message: z.string(),
          evidence: z.enum(["ready", "queued"]),
          article_ideas: z.enum(["ready", "fallback"]),
          background_job_id: z.string().nullable(),
          analysis_session_id: z.string().nullable(),
        }).nullable(),
        ideas: z.array(
          z.object({
            article_id: z.string().nullable(),
            title: z.string(),
            content_type: z.string(),
            priority: z.enum(["high", "medium", "low"]),
            why_this_works: z.string(),
            reader_intent_takeaway: z.string().nullable(),
            suggested_outline: z.array(z.string()),
            information_gain_slot: z.string().nullable(),
            prompt: z.string().nullable(),
            intent_types: z.array(z.string()),
          }),
        ),
      },
    },
    async ({ topic_text, num_prompts, num_ideas, evidence_wait_ms, ideas_wait_ms }, extra) => {
      const stopProgress = startProgressTicker(extra, [
        "AutoRank is preparing prompts for this topic.",
        "AutoRank is checking AI-search evidence.",
        "AutoRank is generating fast article ideas.",
        "AutoRank is packaging ideas for Cursor.",
      ]);

      let result;
      try {
        result = await toolService.getArticleIdeasForTopic({
          topicText: topic_text,
          numPrompts: num_prompts,
          numIdeas: num_ideas,
          evidenceWaitMs: evidence_wait_ms,
          ideasWaitMs: ideas_wait_ms,
        });
      } finally {
        stopProgress();
      }

      await sendProgress(extra, 5, 5, "AutoRank returned article ideas.");

      const structuredContent = {
        topic: {
          id: result.topicId,
          name: result.topicName,
        },
        evidence_summary: {
          status: inferEvidenceStatus(result),
          prompts_used: result.promptTexts,
          prompts_with_results: result.promptsWithResults,
          top_cited_domains: result.topCompetitorDomains,
          sample_cited_urls: result.sampleCitedUrls,
          notes: result.patternSummary,
        },
        workflow_status: result.workflowStatus
          ? {
              mode: result.workflowStatus.mode,
              message: result.workflowStatus.message,
              evidence: result.workflowStatus.evidence,
              article_ideas: result.workflowStatus.articleIdeas,
              background_job_id: result.workflowStatus.backgroundJobId,
              analysis_session_id: result.workflowStatus.analysisSessionId,
            }
          : null,
        ideas: result.ideas.map((idea) => ({
          article_id: idea.articleId,
          title: idea.headline,
          content_type: idea.contentType,
          priority: idea.priority,
          why_this_works: idea.whyThisWorks,
          reader_intent_takeaway: idea.readerIntentTakeaway,
          suggested_outline: idea.suggestedOutline,
          information_gain_slot: idea.informationGainSlot,
          prompt: idea.prompt,
          intent_types: idea.intentTypes,
        })),
      };

      return {
        content: [{ type: "text", text: formatArticleIdeasResult(structuredContent) }],
        structuredContent: asStructuredContent(structuredContent),
      };
    },
  );

  server.registerTool(
    "create_article",
    {
      title: "Write article with AutoRank",
      description:
        "Write the selected article idea from the latest get_article_ideas_for_topic run as full markdown.",
      inputSchema: {
        idea_index: z.number().int().min(1).describe("1-based idea index from the latest get_article_ideas_for_topic call"),
        article_length: z.enum(["short", "medium"]).optional(),
        reader_level: z.enum(["standard", "expert"]).optional(),
        article_wait_ms: z.number().int().min(30000).max(240000).optional(),
      },
      outputSchema: {
        article_id: z.string(),
        title: z.string(),
        markdown: z.string(),
        sources: z.array(
          z.object({
            name: z.string(),
            url: z.string(),
            notes: z.string().nullable(),
          }),
        ),
        job_id: z.string().nullable(),
      },
    },
    async ({ idea_index, article_length, reader_level, article_wait_ms }, extra) => {
      const stopProgress = startProgressTicker(extra, [
        "AutoRank is starting the article writer.",
        "AutoRank is drafting markdown from the selected idea.",
        "AutoRank is saving the draft article.",
        "AutoRank is returning the finished markdown to Cursor.",
      ]);

      let result;
      try {
        result = await toolService.createArticle({
          ideaIndex: idea_index - 1,
          articleLength: article_length,
          readerLevel: reader_level,
          articleWaitMs: article_wait_ms,
        });
      } finally {
        stopProgress();
      }

      await sendProgress(extra, 5, 5, "AutoRank returned the markdown article.");

      const structuredContent = {
        article_id: result.articleId,
        title: result.title,
        markdown: result.markdown,
        sources: result.sources,
        job_id: result.jobId,
      };

      return {
        content: [{ type: "text", text: formatCreateArticleResult(structuredContent) }],
        structuredContent: asStructuredContent(structuredContent),
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
