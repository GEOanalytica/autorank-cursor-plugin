import { loadAutorankEnv, type AutorankEnv } from "./env.js";
import {
  type LastArticleIdeasRunState,
  type StateStore,
  type StoredIdea,
} from "./state.js";
import type {
  ArticleIdeasResult,
  CreateArticleResult,
  IdeaCard,
} from "./types.js";

type ArticleIdeasApiResponse = ArticleIdeasResult & {
  error?: string;
};

type CreateArticleApiResponse = CreateArticleResult & {
  article_id?: string;
  job_id?: string | null;
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

function storedIdeaToApiIdea(
  idea: StoredIdea,
  run: LastArticleIdeasRunState,
): Record<string, unknown> {
  const citationSources = run.sampleCitedUrls.flatMap((url) => {
    try {
      return [{
        name: new URL(url).hostname.replace(/^www\./, ""),
        url,
        notes: "AI-search citation evidence",
      }];
    } catch {
      return [];
    }
  });

  return {
    article_id: idea.articleId,
    headline: idea.headline,
    content_type: idea.contentType,
    why_this_works: idea.whyThisWorks,
    suggested_outline: idea.suggestedOutline,
    reader_intent_takeaway: idea.readerIntentTakeaway,
    information_gain_slot: idea.informationGainSlot,
    prompt: idea.prompt,
    intent_types: idea.intentTypes,
    citation_urls: run.sampleCitedUrls,
    sources: citationSources,
  };
}

export function inferEvidenceStatus(result: ArticleIdeasResult): "live" | "cached" | "fallback" {
  const summary = result.patternSummary?.toLowerCase() ?? "";
  if (summary.includes("fallback") || result.promptsWithResults === 0) {
    return "fallback";
  }
  return "live";
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

  async getArticleIdeasForTopic(input: {
    topicText: string;
    numPrompts?: number;
    numIdeas?: number;
    evidenceWaitMs?: number;
    ideasWaitMs?: number;
  }): Promise<ArticleIdeasResult> {
    const result = await this.invokeContentIdeasApi<ArticleIdeasApiResponse>({
      action: "get_article_ideas_for_topic",
      topic_text: input.topicText,
      num_prompts: input.numPrompts,
      num_ideas: input.numIdeas,
      evidence_wait_ms: input.evidenceWaitMs,
      ideas_wait_ms: input.ideasWaitMs,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    const runState: LastArticleIdeasRunState = {
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
      lastArticleIdeasRun: runState,
    });

    return result;
  }

  async createArticle(input: {
    ideaIndex: number;
    articleLength?: "short" | "medium";
    readerLevel?: "standard" | "expert";
    articleWaitMs?: number;
  }): Promise<CreateArticleResult> {
    const state = await this.stateStore.load();
    const run = state.lastArticleIdeasRun;
    if (!run) {
      throw new Error("No article idea run found. Generate article ideas first.");
    }

    const idea = run.ideas[input.ideaIndex];
    if (!idea) {
      throw new Error(`Idea ${input.ideaIndex + 1} does not exist.`);
    }

    const result = await this.invokeContentIdeasApi<CreateArticleApiResponse>({
      action: "create_article",
      topic_name: run.topicName,
      idea: storedIdeaToApiIdea(idea, run),
      article_length: input.articleLength ?? "short",
      reader_level: input.readerLevel ?? "standard",
      article_wait_ms: input.articleWaitMs,
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return {
      articleId: result.articleId ?? result.article_id ?? "",
      title: result.title,
      markdown: result.markdown,
      sources: result.sources ?? [],
      jobId: result.jobId ?? result.job_id ?? null,
    };
  }
}
