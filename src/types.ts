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

export interface TopicIdeasResult {
  topicId: string;
  topicName: string;
  promptTexts: string[];
  promptsWithResults: number;
  topCompetitorDomains: string[];
  sampleCitedUrls: string[];
  targetUrl: string | null;
  contentGapStatus: "gap" | "partial" | null;
  patternSummary: string | null;
  sessionId: string | null;
  ideas: IdeaCard[];
}

export interface ContentIdeaToolResult {
  topic: {
    id: string;
    name: string;
  };
  evidence_summary: {
    prompts_used: string[];
    prompts_with_results: number;
    top_competitor_domains: string[];
    sample_cited_urls: string[];
    target_url: string | null;
    content_gap_status: "gap" | "partial" | null;
    pattern_summary: string | null;
  };
  ideas: Array<{
    article_id: string | null;
    title: string;
    content_type: string;
    priority: "high" | "medium" | "low";
    reason: string;
    why_this_works: string;
    suggested_outline: string[];
    reader_intent_takeaway: string | null;
    information_gain_slot: string | null;
    prompt: string | null;
    intent_types: string[];
  }>;
}

export interface ExplainIdeaToolResult {
  idea: {
    index: number;
    title: string;
    content_type: string;
    priority: "high" | "medium" | "low";
  };
  why_this_matters: string;
  relevant_prompts: string[];
  competitors_cited: string[];
  cited_urls: string[];
  existing_page: string | null;
  recommended_angle: string;
  proof_notes: string | null;
}

export interface ContentBriefToolResult {
  title: string;
  audience: string | null;
  content_type: string;
  target_prompts: string[];
  outline: string[];
  key_claims: string[];
  faq: string[];
  cta: string;
  metadata_notes: string[];
}
