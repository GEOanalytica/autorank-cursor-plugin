import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAutorankMcpServer, type AutorankToolService } from "./server.js";
import {
  fixtureArticleIdeasResult,
  fixtureCreateArticleResult,
} from "./test-fixtures.js";

describe("autorank mcp server", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes only the v1 article ideas and article creation tools", async () => {
    const service: AutorankToolService = {
      getArticleIdeasForTopic: vi.fn(async () => fixtureArticleIdeasResult),
      createArticle: vi.fn(async () => fixtureCreateArticleResult),
    };

    const server = createAutorankMcpServer(service);
    const client = new Client({ name: "autorank-test-client", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_article",
        "get_article_ideas_for_topic",
      ]);
      expect(JSON.stringify(tools.tools)).not.toMatch(/setup|otp|workspace|token|supabase/i);

      const ideasResult = await client.callTool({
        name: "get_article_ideas_for_topic",
        arguments: {
          topic_text: "AI visibility monitoring for startups",
          num_prompts: 3,
          num_ideas: 1,
        },
      });

      expect(service.getArticleIdeasForTopic).toHaveBeenCalledWith({
        topicText: "AI visibility monitoring for startups",
        numPrompts: 3,
        numIdeas: 1,
        evidenceWaitMs: undefined,
        ideasWaitMs: undefined,
      });
      expect(JSON.stringify(ideasResult.structuredContent)).toContain("AI visibility monitoring for startups");

      const articleResult = await client.callTool({
        name: "create_article",
        arguments: {
          idea_index: 1,
          article_length: "short",
          reader_level: "standard",
        },
      });
      expect(service.createArticle).toHaveBeenCalledWith({
        ideaIndex: 0,
        articleLength: "short",
        readerLevel: "standard",
        articleWaitMs: undefined,
      });
      expect(JSON.stringify(articleResult.structuredContent)).toContain("# AI visibility monitoring for startups");
      expect(JSON.stringify(articleResult.structuredContent)).not.toContain("amcp_");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
