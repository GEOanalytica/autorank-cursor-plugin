import { afterEach, describe, expect, it, vi } from "vitest";

import { AutorankMcpService, compactWhyThisWorks, inferContentType, inferPriority } from "./service.js";
import { MemoryStateStore } from "./state.js";
import { fixtureTopicIdeasResult, fixtureTopicRun } from "./test-fixtures.js";

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

  it("calls the backend with a scoped MCP key and domain id", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(fixtureTopicIdeasResult), {
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

    const result = await service.getContentIdeasForTopic({
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
      action: "get_content_ideas_for_topic",
      topic_text: "AI visibility monitoring for startups",
      num_prompts: 3,
      num_ideas: 1,
    });

    const state = await store.load();
    expect(state.lastTopicRun?.topicId).toBe("topic_1");
    expect(JSON.stringify(state)).not.toContain("amcp_test");
  });
});

describe("mcp explain + brief flows", () => {
  function buildServiceWithRun() {
    return new AutorankMcpService(
      new MemoryStateStore({
        lastTopicRun: fixtureTopicRun,
      }),
      {
        apiBaseUrl: "https://example.supabase.co/functions/v1",
        apiKey: "amcp_test",
        domainId: "domain_1",
      },
    );
  }

  it("explains the latest idea from stored run state", async () => {
    const service = buildServiceWithRun();
    const result = await service.explainIdea(0);

    expect(result.idea.index).toBe(1);
    expect(result.idea.title).toBe(fixtureTopicRun.ideas[0].headline);
    expect(result.relevant_prompts).toEqual(fixtureTopicRun.promptTexts);
    expect(result.competitors_cited).toEqual(fixtureTopicRun.topCompetitorDomains);
    expect(result.existing_page).toBe(fixtureTopicRun.targetUrl);
  });

  it("creates a brief from the latest idea", async () => {
    const service = buildServiceWithRun();
    const result = await service.createContentBrief(0);

    expect(result.title).toBe(fixtureTopicRun.ideas[0].headline);
    expect(result.target_prompts).toEqual(fixtureTopicRun.promptTexts);
    expect(result.outline).toEqual(fixtureTopicRun.ideas[0].suggestedOutline);
    expect(result.cta).toBe("Start free with 10 prompts");
    expect(result.metadata_notes.some((note) => note.includes("Content gap status"))).toBe(true);
  });

  it("resets state cleanly", async () => {
    const store = new MemoryStateStore({
      lastTopicRun: fixtureTopicRun,
    });

    await store.save({ lastTopicRun: null });
    const state = await store.load();
    expect(state.lastTopicRun).toBeNull();
  });
});
