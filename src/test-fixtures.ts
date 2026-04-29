import type { LastTopicRunState } from "./state.js";
import type { TopicIdeasResult } from "./types.js";

export const fixtureTopicRun: LastTopicRunState = {
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

export const fixtureTopicIdeasResult: TopicIdeasResult = {
  topicId: fixtureTopicRun.topicId,
  topicName: fixtureTopicRun.topicName,
  promptTexts: fixtureTopicRun.promptTexts,
  promptsWithResults: fixtureTopicRun.promptsWithResults,
  topCompetitorDomains: fixtureTopicRun.topCompetitorDomains,
  sampleCitedUrls: fixtureTopicRun.sampleCitedUrls,
  targetUrl: fixtureTopicRun.targetUrl,
  contentGapStatus: fixtureTopicRun.contentGapStatus,
  patternSummary: fixtureTopicRun.patternSummary,
  sessionId: "session_1",
  ideas: [
    {
      articleId: fixtureTopicRun.ideas[0].articleId,
      headline: fixtureTopicRun.ideas[0].headline,
      contentType: fixtureTopicRun.ideas[0].contentType,
      priority: "high",
      reason: "Competitors win citations with startup-specific pages.",
      whyThisWorks: fixtureTopicRun.ideas[0].whyThisWorks,
      suggestedOutline: fixtureTopicRun.ideas[0].suggestedOutline,
      readerIntentTakeaway: fixtureTopicRun.ideas[0].readerIntentTakeaway,
      informationGainSlot: fixtureTopicRun.ideas[0].informationGainSlot,
      prompt: fixtureTopicRun.ideas[0].prompt,
      intentTypes: fixtureTopicRun.ideas[0].intentTypes,
    },
  ],
};
