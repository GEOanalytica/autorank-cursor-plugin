import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const shouldRun = process.env.AUTORANK_RUN_PROD_E2E === "1";
const describeProd = shouldRun ? describe : describe.skip;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Set it before running npm run test:prod.`);
  }
  return value;
}

describeProd("AutoRank production MCP smoke", () => {
  let stateDir: string | null = null;

  afterAll(async () => {
    if (stateDir) {
      await rm(stateDir, { recursive: true, force: true });
    }
  });

  it("generates, explains, and briefs one idea against the configured AutoRank API", async () => {
    const apiKey = requireEnv("AUTORANK_API_KEY");
    const domainId = requireEnv("AUTORANK_DOMAIN_ID");
    const apiBaseUrl = requireEnv("AUTORANK_API_BASE_URL");
    const topic = process.env.AUTORANK_E2E_TOPIC?.trim() || "AI search monitoring for B2B SaaS";
    const requestTimeoutMs = Number(process.env.AUTORANK_E2E_TIMEOUT_MS ?? "420000");

    stateDir = await mkdtemp(join(tmpdir(), "autorank-mcp-prod-e2e-"));
    const statePath = join(stateDir, "state.json");

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/server.js"],
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        AUTORANK_API_KEY: apiKey,
        AUTORANK_DOMAIN_ID: domainId,
        AUTORANK_API_BASE_URL: apiBaseUrl,
        AUTORANK_MCP_STATE_PATH: statePath,
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "autorank-prod-e2e-client", version: "0.1.0" });

    await client.connect(transport);

    try {
      const tools = await client.listTools(undefined, { timeout: 30000 });
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_content_brief",
        "explain_content_idea",
        "get_content_ideas_for_topic",
      ]);

      const ideasResult = await client.callTool(
        {
          name: "get_content_ideas_for_topic",
          arguments: {
            topic_text: topic,
            num_prompts: 3,
            num_ideas: 1,
            evidence_wait_ms: 180000,
            ideas_wait_ms: 180000,
          },
        },
        undefined,
        {
          timeout: requestTimeoutMs,
          maxTotalTimeout: requestTimeoutMs,
        },
      );

      const ideasPayload = JSON.stringify(ideasResult.structuredContent);
      expect(ideasPayload).toContain(topic.split(/\s+/)[0]);
      expect(ideasPayload).not.toContain(apiKey);

      const explainResult = await client.callTool(
        {
          name: "explain_content_idea",
          arguments: { idea_index: 1 },
        },
        undefined,
        { timeout: 30000 },
      );
      expect(JSON.stringify(explainResult.structuredContent)).not.toContain(apiKey);

      const briefResult = await client.callTool(
        {
          name: "create_content_brief",
          arguments: { idea_index: 1 },
        },
        undefined,
        { timeout: 30000 },
      );
      expect(JSON.stringify(briefResult.structuredContent)).not.toContain(apiKey);

      const persistedState = await readFile(statePath, "utf8");
      expect(persistedState).not.toContain(apiKey);
      expect(persistedState).not.toMatch(/refresh_token|access_token|service_role/i);
    } finally {
      await client.close();
    }
  });
});
