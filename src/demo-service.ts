import {
  compactWhyThisWorks,
  inferPriority,
} from "./service.js";
import type {
  LastTopicRunState,
  StateStore,
  StoredIdea,
} from "./state.js";
import type {
  ContentBriefToolResult,
  ExplainIdeaToolResult,
  TopicIdeasResult,
} from "./types.js";

function demoPrompts(topic: string): string[] {
  return [
    `best ${topic} tools for growing companies`,
    `how to improve AI search visibility for ${topic}`,
    `${topic} implementation checklist`,
  ];
}

function demoIdeas(topic: string, limit: number): StoredIdea[] {
  const ideas: StoredIdea[] = [
    {
      articleId: null,
      headline: `${topic}: the practical buyer's checklist`,
      whyThisWorks:
        "Demo mode: competitors are often cited for checklist-style pages, while the target site may not have a page that answers selection and implementation questions directly.",
      suggestedOutline: [
        "Define the buying trigger",
        "List the core evaluation criteria",
        "Show an implementation workflow",
        "Add proof points and common objections",
      ],
      readerIntentTakeaway:
        "A buyer understands what to evaluate and why the category matters.",
      informationGainSlot:
        "A practical checklist that turns vague category interest into a concrete buying workflow.",
      prompt: `Write a checklist page for buyers evaluating ${topic}.`,
      intentTypes: ["checklist", "buyers_guide"],
      contentType: "Checklist",
    },
    {
      articleId: null,
      headline: `How to measure ${topic} before competitors win the citation`,
      whyThisWorks:
        "Demo mode: AI answers tend to reward pages that define the problem, show measurable signals, and cite concrete workflows.",
      suggestedOutline: [
        "Explain the measurement problem",
        "Map the prompts buyers ask",
        "Compare current visibility against competitors",
        "Prioritize pages to create or improve",
      ],
      readerIntentTakeaway:
        "A founder or marketer gets a concrete visibility-monitoring workflow.",
      informationGainSlot:
        "A measurement-first article that links prompt evidence to content action.",
      prompt: `Write an explainer about measuring ${topic}.`,
      intentTypes: ["explainer"],
      contentType: "Explainer",
    },
  ];

  return ideas.slice(0, Math.max(1, limit));
}

function storedIdeaToResultIdea(idea: StoredIdea, contentGapStatus: "gap" | "partial" | null) {
  return {
    articleId: idea.articleId,
    headline: idea.headline,
    contentType: idea.contentType,
    priority: inferPriority({
      whyThisWorks: idea.whyThisWorks,
      contentGapStatus,
    }),
    reason: "Demo evidence shows how AutoRank will connect prompts, competitor citations, and content opportunities once configured.",
    whyThisWorks: idea.whyThisWorks,
    suggestedOutline: idea.suggestedOutline,
    readerIntentTakeaway: idea.readerIntentTakeaway,
    informationGainSlot: idea.informationGainSlot,
    prompt: idea.prompt,
    intentTypes: idea.intentTypes,
  };
}

export class DemoAutorankMcpService {
  constructor(private readonly stateStore: StateStore) {}

  async getContentIdeasForTopic(input: {
    topicText: string;
    numIdeas?: number;
  }): Promise<TopicIdeasResult> {
    const topicName = input.topicText.trim();
    const promptTexts = demoPrompts(topicName);
    const contentGapStatus = "partial" as const;
    const ideas = demoIdeas(topicName, input.numIdeas ?? 2);
    const runState: LastTopicRunState = {
      topicId: "demo-topic",
      topicName,
      promptTexts,
      promptsWithResults: promptTexts.length,
      topCompetitorDomains: ["example-competitor.com", "category-leader.example"],
      sampleCitedUrls: [
        "https://example-competitor.com/checklist",
        "https://category-leader.example/resources",
      ],
      targetUrl: null,
      contentGapStatus,
      patternSummary:
        "Demo mode: configure AUTORANK_API_KEY, AUTORANK_DOMAIN_ID, and AUTORANK_API_BASE_URL for live AutoRank evidence.",
      ideas,
      createdAt: new Date().toISOString(),
    };

    const current = await this.stateStore.load();
    await this.stateStore.save({
      ...current,
      lastTopicRun: runState,
    });

    return {
      topicId: runState.topicId,
      topicName: runState.topicName,
      promptTexts: runState.promptTexts,
      promptsWithResults: runState.promptsWithResults,
      topCompetitorDomains: runState.topCompetitorDomains,
      sampleCitedUrls: runState.sampleCitedUrls,
      targetUrl: runState.targetUrl,
      contentGapStatus: runState.contentGapStatus,
      patternSummary: runState.patternSummary,
      sessionId: null,
      ideas: runState.ideas.map((idea) => storedIdeaToResultIdea(idea, contentGapStatus)),
    };
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

    return {
      title: idea.headline,
      audience: idea.readerIntentTakeaway,
      content_type: idea.contentType,
      target_prompts: run.promptTexts,
      outline: idea.suggestedOutline,
      key_claims: [idea.whyThisWorks],
      faq: [],
      cta: "Start free with AutoRank",
      metadata_notes: [
        "Demo mode: this brief uses sample evidence. Configure an AutoRank MCP key for live citation data.",
      ],
    };
  }
}
