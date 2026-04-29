import {
  compactWhyThisWorks,
  inferPriority,
} from "./service.js";
import type {
  LastArticleIdeasRunState,
  StateStore,
  StoredIdea,
} from "./state.js";
import type {
  ArticleIdeasResult,
  CreateArticleResult,
} from "./types.js";

function demoPrompts(topic: string): string[] {
  const normalizedTopic = topic.trim();
  return [
    `what should customers know before choosing ${normalizedTopic}`,
    `${normalizedTopic} checklist for busy teams`,
    `common mistakes with ${normalizedTopic}`,
  ];
}

function demoIdeas(topic: string, limit: number): StoredIdea[] {
  const ideas: StoredIdea[] = [
    {
      articleId: null,
      headline: `${topic}: the practical customer's checklist`,
      whyThisWorks:
        "Demo mode: checklist-style articles are a strong fit when readers need fast criteria, concrete steps, and enough confidence to act.",
      suggestedOutline: [
        "Define the problem in plain language",
        "List the decision criteria customers should use",
        "Show the step-by-step checklist",
        "Explain mistakes to avoid",
      ],
      readerIntentTakeaway:
        "The reader understands what to check, what to avoid, and what to do next.",
      informationGainSlot:
        "A practical checklist that turns a vague topic into an article a busy customer can use immediately.",
      prompt: `Write a checklist article about ${topic}.`,
      intentTypes: ["checklist", "explainer"],
      contentType: "Checklist",
    },
    {
      articleId: null,
      headline: `How to choose the right ${topic} option`,
      whyThisWorks:
        "Demo mode: comparison and choice articles work well when readers are evaluating options and need a clear recommendation framework.",
      suggestedOutline: [
        "Describe when this decision matters",
        "Compare the main options",
        "Explain how to choose by situation",
        "Close with a simple next step",
      ],
      readerIntentTakeaway:
        "The reader can choose the right option without doing separate research.",
      informationGainSlot:
        "A decision framework that makes the article more useful than a generic overview.",
      prompt: `Write a decision article about ${topic}.`,
      intentTypes: ["comparison", "buyers_guide"],
      contentType: "Comparison page",
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
    reason: compactWhyThisWorks(idea.whyThisWorks),
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

  async getArticleIdeasForTopic(input: {
    topicText: string;
    numIdeas?: number;
  }): Promise<ArticleIdeasResult> {
    const topicName = input.topicText.trim();
    const promptTexts = demoPrompts(topicName);
    const contentGapStatus = "partial" as const;
    const ideas = demoIdeas(topicName, input.numIdeas ?? 2);
    const runState: LastArticleIdeasRunState = {
      topicId: "demo-topic",
      topicName,
      promptTexts,
      promptsWithResults: promptTexts.length,
      topCompetitorDomains: ["sample-business.example", "sample-guide.example"],
      sampleCitedUrls: [
        "https://sample-business.example/checklist",
        "https://sample-guide.example/resources",
      ],
      targetUrl: null,
      contentGapStatus,
      patternSummary:
        "Demo mode: configure AUTORANK_API_KEY, AUTORANK_DOMAIN_ID, and AUTORANK_API_BASE_URL for live AutoRank evidence and full article generation.",
      ideas,
      createdAt: new Date().toISOString(),
    };

    const current = await this.stateStore.load();
    await this.stateStore.save({
      ...current,
      lastArticleIdeasRun: runState,
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

  async createArticle(input: { ideaIndex: number }): Promise<CreateArticleResult> {
    const state = await this.stateStore.load();
    const run = state.lastArticleIdeasRun;
    if (!run) {
      throw new Error("No article idea run found. Generate article ideas first.");
    }

    const idea = run.ideas[input.ideaIndex];
    if (!idea) {
      throw new Error(`Idea ${input.ideaIndex + 1} does not exist.`);
    }

    const markdown = [
      `# ${idea.headline}`,
      "",
      `Readers searching for ${run.topicName} usually want a practical answer they can act on quickly. ${idea.readerIntentTakeaway ?? ""}`.trim(),
      "",
      "## Why this matters",
      "",
      idea.whyThisWorks.replace(/^Demo mode:\s*/i, ""),
      "",
      "## What to cover",
      "",
      ...idea.suggestedOutline.map((item) => `- ${item}`),
      "",
      "## Practical next step",
      "",
      `Use this article to answer the most common questions about ${run.topicName}, then adapt the examples to your actual business and customer language.`,
      "",
      "## References",
      "",
      ...run.sampleCitedUrls.map((url) => `- [Sample evidence](${url})`),
    ].join("\n");

    return {
      articleId: "demo-article",
      title: idea.headline,
      markdown,
      sources: run.sampleCitedUrls.map((url) => ({
        name: new URL(url).hostname.replace(/^www\./, ""),
        url,
        notes: "Demo evidence",
      })),
      jobId: null,
    };
  }
}
