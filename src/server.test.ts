import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAutorankMcpServer, type AutorankToolService } from "./server.js";
import { fixtureTopicIdeasResult } from "./test-fixtures.js";

describe("autorank mcp server", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes only the v1 content ideas trio", async () => {
    const service: AutorankToolService = {
      getContentIdeasForTopic: vi.fn(async () => fixtureTopicIdeasResult),
      explainIdea: vi.fn(async () => ({
        idea: {
          index: 1,
          title: "AI visibility monitoring for startups",
          content_type: "Checklist",
          priority: "high" as const,
        },
        why_this_matters: "Competitors are cited for this topic.",
        relevant_prompts: fixtureTopicIdeasResult.promptTexts,
        competitors_cited: fixtureTopicIdeasResult.topCompetitorDomains,
        cited_urls: fixtureTopicIdeasResult.sampleCitedUrls,
        existing_page: fixtureTopicIdeasResult.targetUrl,
        recommended_angle: "A startup launch checklist with prompt benchmarks.",
        proof_notes: fixtureTopicIdeasResult.patternSummary,
      })),
      createContentBrief: vi.fn(async () => ({
        title: "AI visibility monitoring for startups",
        audience: "Technical founders",
        content_type: "Checklist",
        target_prompts: fixtureTopicIdeasResult.promptTexts,
        outline: fixtureTopicIdeasResult.ideas[0].suggestedOutline,
        key_claims: ["Competitors are cited for this topic."],
        faq: [],
        cta: "Start free with 10 prompts",
        metadata_notes: ["Content gap status: partial"],
      })),
    };

    const server = createAutorankMcpServer(service);
    const client = new Client({ name: "autorank-test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_content_brief",
        "explain_content_idea",
        "get_content_ideas_for_topic",
      ]);

      const ideasResult = await client.callTool({
        name: "get_content_ideas_for_topic",
        arguments: {
          topic_text: "AI visibility monitoring for startups",
          num_prompts: 3,
          num_ideas: 1,
        },
      });

      expect(service.getContentIdeasForTopic).toHaveBeenCalledWith({
        topicText: "AI visibility monitoring for startups",
        numPrompts: 3,
        numIdeas: 1,
        evidenceWaitMs: undefined,
        ideasWaitMs: undefined,
      });
      expect(JSON.stringify(ideasResult.structuredContent)).toContain("AI visibility monitoring for startups");

      const briefResult = await client.callTool({
        name: "create_content_brief",
        arguments: { idea_index: 1 },
      });
      expect(JSON.stringify(briefResult.structuredContent)).not.toContain("amcp_");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
