import type { LastArticleIdeasRunState } from "./state.js";
import type { ArticleIdeasResult, CreateArticleResult } from "./types.js";

export const fixtureArticleIdeasRun: LastArticleIdeasRunState = {
  topicId: "topic_1",
  topicName: "AI visibility monitoring for startups",
  promptTexts: [
    "best ai visibility monitoring tool for startups",
    "how to check if chatgpt recommends my startup",
  ],
  promptsWithResults: 2,
  topCompetitorDomains: ["competitor-a.com", "competitor-b.com"],
  sampleCitedUrls: ["https://competitor-a.com/startups", "https://competitor-b.com/launch"],
  targetUrl: "https://example.com/product",
  contentGapStatus: "partial",
  patternSummary: "Competitor pages include startup-specific use cases and checklists.",
  createdAt: new Date().toISOString(),
  ideas: [
    {
      articleId: "article_1",
      headline: "AI visibility monitoring for startups",
      whyThisWorks:
        "- Competitors have startup-specific pages.\n- Your site has no startup-specific content angle.",
      suggestedOutline: [
        "What AI visibility monitoring means",
        "Why startups should care before launch",
        "The first 10 prompts to monitor",
        "How to benchmark cited competitors",
      ],
      readerIntentTakeaway:
        "Technical founders want to know if AI engines recommend them before launch.",
      informationGainSlot: "A startup launch checklist with prompt benchmarks.",
      prompt: "Write an article for startup founders about monitoring AI visibility before launch.",
      intentTypes: ["checklist", "explainer"],
      contentType: "Checklist",
    },
  ],
};

export const fixtureArticleIdeasResult: ArticleIdeasResult = {
  topicId: fixtureArticleIdeasRun.topicId,
  topicName: fixtureArticleIdeasRun.topicName,
  promptTexts: fixtureArticleIdeasRun.promptTexts,
  promptsWithResults: fixtureArticleIdeasRun.promptsWithResults,
  topCompetitorDomains: fixtureArticleIdeasRun.topCompetitorDomains,
  sampleCitedUrls: fixtureArticleIdeasRun.sampleCitedUrls,
  targetUrl: fixtureArticleIdeasRun.targetUrl,
  contentGapStatus: fixtureArticleIdeasRun.contentGapStatus,
  patternSummary: fixtureArticleIdeasRun.patternSummary,
  sessionId: "session_1",
  ideas: [
    {
      articleId: fixtureArticleIdeasRun.ideas[0].articleId,
      headline: fixtureArticleIdeasRun.ideas[0].headline,
      contentType: fixtureArticleIdeasRun.ideas[0].contentType,
      priority: "high",
      reason: "Competitors win citations with startup-specific pages.",
      whyThisWorks: fixtureArticleIdeasRun.ideas[0].whyThisWorks,
      suggestedOutline: fixtureArticleIdeasRun.ideas[0].suggestedOutline,
      readerIntentTakeaway: fixtureArticleIdeasRun.ideas[0].readerIntentTakeaway,
      informationGainSlot: fixtureArticleIdeasRun.ideas[0].informationGainSlot,
      prompt: fixtureArticleIdeasRun.ideas[0].prompt,
      intentTypes: fixtureArticleIdeasRun.ideas[0].intentTypes,
    },
  ],
};

export const fixtureCreateArticleResult: CreateArticleResult = {
  articleId: "draft_1",
  title: "AI visibility monitoring for startups",
  markdown: [
    "# AI visibility monitoring for startups",
    "",
    "AI visibility monitoring helps founders understand whether AI engines mention their company when buyers ask category questions.",
    "",
    "## The first 10 prompts to monitor",
    "",
    "Start with the questions your buyer asks before they know your brand.",
  ].join("\n"),
  sources: [
    {
      name: "competitor-a.com",
      url: "https://competitor-a.com/startups",
      notes: "Citation evidence",
    },
  ],
  jobId: "job_1",
};
