import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { fixtureTopicIdeasResult } from "./test-fixtures.js";

interface RecordedRequest {
  method: string | undefined;
  url: string | undefined;
  authorization: string | undefined;
  body: Record<string, unknown>;
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

describe("Cursor stdio e2e", () => {
  const requests: RecordedRequest[] = [];
  let server: Server;
  let apiBaseUrl: string;
  let stateDir: string;

  beforeAll(async () => {
    stateDir = await mkdtemp(join(tmpdir(), "autorank-mcp-e2e-"));
    server = createServer(async (req, res) => {
      if (req.method !== "POST" || req.url !== "/mcp-content-ideas") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
        return;
      }

      const rawBody = await readRequestBody(req);
      requests.push({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization,
        body: JSON.parse(rawBody) as Record<string, unknown>,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(fixtureTopicIdeasResult));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    apiBaseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    await rm(stateDir, { recursive: true, force: true });
  });

  it("runs the compiled MCP server through the Cursor-facing stdio path", async () => {
    const statePath = join(stateDir, "state.json");
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/server.js"],
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        AUTORANK_API_KEY: "amcp_e2e_secret",
        AUTORANK_DOMAIN_ID: "domain_e2e",
        AUTORANK_API_BASE_URL: apiBaseUrl,
        AUTORANK_MCP_STATE_PATH: statePath,
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "autorank-e2e-client", version: "0.1.0" });

    await client.connect(transport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
        "create_content_brief",
        "explain_content_idea",
        "get_content_ideas_for_topic",
      ]);
      expect(JSON.stringify(tools.tools)).not.toMatch(/setup|otp|workspace|token|supabase/i);

      const ideasResult = await client.callTool({
        name: "get_content_ideas_for_topic",
        arguments: {
          topic_text: "AI visibility monitoring for startups",
          num_prompts: 3,
          num_ideas: 1,
          evidence_wait_ms: 1000,
          ideas_wait_ms: 1000,
        },
      });

      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({
        method: "POST",
        url: "/mcp-content-ideas",
        authorization: "Bearer amcp_e2e_secret",
        body: {
          domain_id: "domain_e2e",
          action: "get_content_ideas_for_topic",
          topic_text: "AI visibility monitoring for startups",
          num_prompts: 3,
          num_ideas: 1,
          evidence_wait_ms: 1000,
          ideas_wait_ms: 1000,
        },
      });
      expect(JSON.stringify(ideasResult.structuredContent)).toContain("AI visibility monitoring for startups");
      expect(JSON.stringify(ideasResult.structuredContent)).toContain("competitor-a.com");

      const explainResult = await client.callTool({
        name: "explain_content_idea",
        arguments: { idea_index: 1 },
      });
      expect(JSON.stringify(explainResult.structuredContent)).toContain("Competitors have startup-specific pages");
      expect(JSON.stringify(explainResult.structuredContent)).toContain("https://example.com/product");

      const briefResult = await client.callTool({
        name: "create_content_brief",
        arguments: { idea_index: 1 },
      });
      expect(JSON.stringify(briefResult.structuredContent)).toContain("The first 10 prompts to monitor");
      expect(JSON.stringify(briefResult.structuredContent)).not.toContain("amcp_e2e_secret");

      const persistedState = await readFile(statePath, "utf8");
      expect(persistedState).toContain("AI visibility monitoring for startups");
      expect(persistedState).not.toContain("amcp_e2e_secret");
      expect(persistedState).not.toMatch(/refresh_token|access_token|service_role/i);
    } finally {
      await client.close();
    }
  });
});
