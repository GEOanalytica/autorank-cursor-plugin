import { afterEach, describe, expect, it, vi } from "vitest";

import { AutorankMcpService, compactWhyThisWorks, inferContentType, inferPriority } from "./service.js";
import { MemoryStateStore } from "./state.js";
import {
  fixtureArticleIdeasResult,
  fixtureArticleIdeasRun,
  fixtureCreateArticleResult,
} from "./test-fixtures.js";

describe("mcp service helpers", () => {
  it("compacts why-this-works bullets", () => {
    expect(compactWhyThisWorks("- First reason\n- Second reason")).toBe("First reason");
    expect(compactWhyThisWorks("Single line")).toBe("Single line");
  });

  it("infers priority from gap and competitor signals", () => {
    expect(
      inferPriority({
        whyThisWorks: "Competitors are cited where you are not visible.",
        contentGapStatus: "gap",
      }),
    ).toBe("high");

    expect(
      inferPriority({
        whyThisWorks: "This looks like a checklist opportunity for launch.",
        contentGapStatus: "partial",
      }),
    ).toBe("medium");
  });

  it("infers content type from headline and intent", () => {
    expect(inferContentType("AI visibility checklist before launch", ["checklist"])).toBe("Checklist");
    expect(inferContentType("AutoRank vs Competitor", ["comparison"])).toBe("Comparison page");
    expect(inferContentType("Buyer guide to AI visibility tools", ["buyers_guide"])).toBe("Buyer's guide");
  });
});

describe("mcp API calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets article ideas with a scoped MCP key and domain id", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(fixtureArticleIdeasResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = new MemoryStateStore();
    const service = new AutorankMcpService(store, {
      apiBaseUrl: "https://api.example.test/functions/v1/",
      apiKey: "amcp_test",
      domainId: "domain_1",
    });

    const result = await service.getArticleIdeasForTopic({
      topicText: "AI visibility monitoring for startups",
      numPrompts: 3,
      numIdeas: 1,
    });

    expect(result.topicId).toBe("topic_1");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.test/functions/v1/mcp-content-ideas");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer amcp_test",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      domain_id: "domain_1",
      action: "get_article_ideas_for_topic",
      topic_text: "AI visibility monitoring for startups",
      num_prompts: 3,
      num_ideas: 1,
    });

    const state = await store.load();
    expect(state.lastArticleIdeasRun?.topicId).toBe("topic_1");
    expect(JSON.stringify(state)).not.toContain("amcp_test");
  });

  it("creates a full article from the selected stored idea without persisting markdown locally", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(fixtureCreateArticleResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const store = new MemoryStateStore({
      lastArticleIdeasRun: fixtureArticleIdeasRun,
    });
    const service = new AutorankMcpService(store, {
      apiBaseUrl: "https://api.example.test/functions/v1",
      apiKey: "amcp_test",
      domainId: "domain_1",
    });

    const result = await service.createArticle({
      ideaIndex: 0,
      articleLength: "short",
      readerLevel: "standard",
      articleWaitMs: 60000,
    });

    expect(result.markdown).toContain("# AI visibility monitoring for startups");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      domain_id: "domain_1",
      action: "create_article",
      topic_name: fixtureArticleIdeasRun.topicName,
      article_length: "short",
      reader_level: "standard",
      article_wait_ms: 60000,
    });
    expect(body.idea.headline).toBe(fixtureArticleIdeasRun.ideas[0].headline);
    expect(body.idea.citation_urls).toEqual(fixtureArticleIdeasRun.sampleCitedUrls);

    const state = await store.load();
    expect(JSON.stringify(state)).not.toContain("amcp_test");
    expect(JSON.stringify(state)).not.toContain(fixtureCreateArticleResult.markdown);
  });
});
