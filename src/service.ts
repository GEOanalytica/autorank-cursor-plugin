import { loadAutorankEnv, type AutorankEnv } from "./env.js";
import {
  type LastTopicRunState,
  type StateStore,
  type StoredIdea,
} from "./state.js";
import type {
  ContentBriefToolResult,
  ExplainIdeaToolResult,
  IdeaCard,
  TopicIdeasResult,
} from "./types.js";

type ContentIdeasApiResponse = TopicIdeasResult & {
  error?: string;
};

export function inferPriority(idea: {
  whyThisWorks: string;
  contentGapStatus: "gap" | "partial" | null;
}): "high" | "medium" | "low" {
  const normalized = idea.whyThisWorks.toLowerCase();
  if (
    idea.contentGapStatus === "gap" ||
    normalized.includes("competitor") ||
    normalized.includes("not visible") ||
    normalized.includes("buyer") ||
    normalized.includes("startup-focused")
  ) {
    return "high";
  }
  if (
    normalized.includes("launch") ||
    normalized.includes("checklist") ||
    normalized.includes("opportunity")
  ) {
    return "medium";
  }
  return "low";
}

export function inferContentType(headline: string, intentTypes: string[]): string {
  const normalizedHeadline = headline.toLowerCase();
  if (intentTypes.includes("checklist") || normalizedHeadline.includes("checklist")) {
    return "Checklist";
  }
  if (intentTypes.includes("comparison") || normalizedHeadline.includes("vs")) {
    return "Comparison page";
  }
  if (intentTypes.includes("buyers_guide")) {
    return "Buyer's guide";
  }
  if (intentTypes.includes("template")) {
    return "Template";
  }
  if (intentTypes.includes("explainer")) {
    return "Explainer";
  }
  return "Use-case / editorial page";
}

export function compactWhyThisWorks(whyThisWorks: string): string {
  const lines = whyThisWorks
    .split(/\r?\n/)
    .map((line) => line.replace(/^- /, "").trim())
    .filter(Boolean);
  return lines[0] ?? whyThisWorks.trim();
}

function uniqueStrings(values: string[], limit?: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (typeof limit === "number" && result.length >= limit) break;
  }
  return result;
}

function ideaCardToStoredIdea(idea: IdeaCard): StoredIdea {
  return {
    articleId: idea.articleId,
    headline: idea.headline,
    whyThisWorks: idea.whyThisWorks,
    suggestedOutline: idea.suggestedOutline,
    readerIntentTakeaway: idea.readerIntentTakeaway,
    informationGainSlot: idea.informationGainSlot,
    prompt: idea.prompt,
    intentTypes: idea.intentTypes,
    contentType: idea.contentType,
  };
}

export class AutorankMcpService {
  private readonly env: AutorankEnv;
  private readonly stateStore: StateStore;

  constructor(stateStore: StateStore, env = loadAutorankEnv()) {
    this.stateStore = stateStore;
    this.env = env;
  }

  private async invokeContentIdeasApi<TResponse>(
    body: Record<string, unknown>,
  ): Promise<TResponse> {
    const response = await fetch(
      `${this.env.apiBaseUrl.replace(/\/+$/, "")}/mcp-content-ideas`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.env.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain_id: this.env.domainId,
          ...body,
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | TResponse
      | null;

    if (!response.ok) {
      const errorMessage =
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : `mcp-content-ideas failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload as TResponse;
  }

  async getContentIdeasForTopic(input: {
    topicText: string;
    numPrompts?: number;
    numIdeas?: number;
    evidenceWaitMs?: number;
    ideasWaitMs?: number;
  }): Promise<TopicIdeasResult> {
    const result = await this.invokeContentIdeasApi<ContentIdeasApiResponse>({
      action: "get_content_ideas_for_topic",
      topic_text: input.topicText,
      num_prompts: input.numPrompts,
      num_ideas: input.numIdeas,
      evidence_wait_ms: input.evidenceWaitMs,
      ideas_wait_ms: input.ideasWaitMs,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const runState: LastTopicRunState = {
      topicId: result.topicId,
      topicName: result.topicName,
      promptTexts: result.promptTexts,
      promptsWithResults: result.promptsWithResults,
      topCompetitorDomains: result.topCompetitorDomains,
      sampleCitedUrls: result.sampleCitedUrls,
      targetUrl: result.targetUrl,
      contentGapStatus: result.contentGapStatus,
      patternSummary: result.patternSummary,
      ideas: result.ideas.map(ideaCardToStoredIdea),
      createdAt: new Date().toISOString(),
    };

    const current = await this.stateStore.load();
    await this.stateStore.save({
      ...current,
      lastTopicRun: runState,
    });

    return result;
  }

  async explainIdea(index: number): Promise<ExplainIdeaToolResult> {
    const state = await this.stateStore.load();
    const run = state.lastTopicRun;
    if (!run) {
      throw new Error("No topic idea run found. Generate content ideas first.");
    }

    const idea = run.ideas[index];
    if (!idea) {
      throw new Error(`Idea ${index + 1} does not exist.`);
    }

    return {
      idea: {
        index: index + 1,
        title: idea.headline,
        content_type: idea.contentType,
        priority: inferPriority({
          whyThisWorks: idea.whyThisWorks,
          contentGapStatus: run.contentGapStatus,
        }),
      },
      why_this_matters: idea.whyThisWorks,
      relevant_prompts: run.promptTexts,
      competitors_cited: run.topCompetitorDomains,
      cited_urls: run.sampleCitedUrls,
      existing_page: run.targetUrl,
      recommended_angle:
        idea.informationGainSlot ??
        compactWhyThisWorks(idea.whyThisWorks),
      proof_notes: run.patternSummary,
    };
  }

  async createContentBrief(index: number): Promise<ContentBriefToolResult> {
    const state = await this.stateStore.load();
    const run = state.lastTopicRun;
    if (!run) {
      throw new Error("No topic idea run found. Generate content ideas first.");
    }

    const idea = run.ideas[index];
    if (!idea) {
      throw new Error(`Idea ${index + 1} does not exist.`);
    }

    const whyLines = idea.whyThisWorks
      .split(/\r?\n/)
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean);

    return {
      title: idea.headline,
      audience: idea.readerIntentTakeaway,
      content_type: idea.contentType,
      target_prompts: run.promptTexts,
      outline: idea.suggestedOutline,
      key_claims: whyLines,
      faq: [],
      cta: "Start free with 10 prompts",
      metadata_notes: uniqueStrings(
        [
          run.targetUrl ? `Existing related page: ${run.targetUrl}` : "No existing page found",
          run.patternSummary ?? "",
          run.contentGapStatus ? `Content gap status: ${run.contentGapStatus}` : "",
        ].filter(Boolean),
      ),
    };
  }
}
