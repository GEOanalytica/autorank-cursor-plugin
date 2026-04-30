export interface IdeaCard {
  articleId: string | null;
  headline: string;
  contentType: string;
  priority: "high" | "medium" | "low";
  reason: string;
  whyThisWorks: string;
  suggestedOutline: string[];
  readerIntentTakeaway: string | null;
  informationGainSlot: string | null;
  prompt: string | null;
  intentTypes: string[];
}

export interface ArticleIdeasResult {
  topicId: string;
  topicName: string;
  promptTexts: string[];
  promptsWithResults: number;
  topCompetitorDomains: string[];
  sampleCitedUrls: string[];
  targetUrl: string | null;
  contentGapStatus: "gap" | "partial" | null;
  patternSummary: string | null;
  workflowStatus?: {
    mode: "live_ideas" | "fast_fallback" | "stored_ideas";
    message: string;
    evidence: "ready" | "queued";
    articleIdeas: "ready" | "fallback";
    backgroundJobId: string | null;
    analysisSessionId: string | null;
  } | null;
  sessionId: string | null;
  ideas: IdeaCard[];
}

export interface ArticleIdeasToolResult {
  topic: {
    id: string;
    name: string;
  };
  evidence_summary: {
    status: "live" | "cached" | "fallback";
    prompts_used: string[];
    prompts_with_results: number;
    top_cited_domains: string[];
    sample_cited_urls: string[];
    notes: string | null;
  };
  workflow_status: {
    mode: "live_ideas" | "fast_fallback" | "stored_ideas";
    message: string;
    evidence: "ready" | "queued";
    article_ideas: "ready" | "fallback";
    background_job_id: string | null;
    analysis_session_id: string | null;
  } | null;
  ideas: Array<{
    article_id: string | null;
    title: string;
    content_type: string;
    priority: "high" | "medium" | "low";
    why_this_works: string;
    reader_intent_takeaway: string | null;
    suggested_outline: string[];
    information_gain_slot: string | null;
    prompt: string | null;
    intent_types: string[];
  }>;
}

export interface CreateArticleResult {
  articleId: string;
  title: string;
  markdown: string;
  sources: Array<{
    name: string;
    url: string;
    notes: string | null;
  }>;
  jobId: string | null;
}

export interface CreateArticleToolResult {
  article_id: string;
  title: string;
  markdown: string;
  sources: Array<{
    name: string;
    url: string;
    notes: string | null;
  }>;
  job_id: string | null;
}
