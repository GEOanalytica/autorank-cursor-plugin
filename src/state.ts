import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface StoredIdea {
  articleId: string | null;
  headline: string;
  whyThisWorks: string;
  suggestedOutline: string[];
  readerIntentTakeaway: string | null;
  informationGainSlot: string | null;
  prompt: string | null;
  intentTypes: string[];
  contentType: string;
}

export interface LastArticleIdeasRunState {
  topicId: string;
  topicName: string;
  promptTexts: string[];
  promptsWithResults: number;
  topCompetitorDomains: string[];
  sampleCitedUrls: string[];
  targetUrl: string | null;
  contentGapStatus: "gap" | "partial" | null;
  patternSummary: string | null;
  ideas: StoredIdea[];
  createdAt: string;
}

export interface AutorankMcpState {
  lastArticleIdeasRun: LastArticleIdeasRunState | null;
}

export const DEFAULT_MCP_STATE: AutorankMcpState = {
  lastArticleIdeasRun: null,
};

export interface StateStore {
  load(): Promise<AutorankMcpState>;
  save(state: AutorankMcpState): Promise<void>;
}

function defaultStatePath(): string {
  return (
    process.env.AUTORANK_MCP_STATE_PATH ??
    join(homedir(), ".config", "autorank-mcp", "state.json")
  );
}

export class FileStateStore implements StateStore {
  private readonly filePath: string;

  constructor(filePath = defaultStatePath()) {
    this.filePath = filePath;
  }

  async load(): Promise<AutorankMcpState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AutorankMcpState> & {
        lastTopicRun?: LastArticleIdeasRunState | null;
      };
      return {
        lastArticleIdeasRun:
          parsed.lastArticleIdeasRun ?? parsed.lastTopicRun ?? null,
      };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        return { ...DEFAULT_MCP_STATE };
      }
      throw error;
    }
  }

  async save(state: AutorankMcpState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}

export class MemoryStateStore implements StateStore {
  private state: AutorankMcpState;

  constructor(initialState: Partial<AutorankMcpState> = {}) {
    this.state = {
      lastArticleIdeasRun: initialState.lastArticleIdeasRun ?? null,
    };
  }

  async load(): Promise<AutorankMcpState> {
    return JSON.parse(JSON.stringify(this.state)) as AutorankMcpState;
  }

  async save(state: AutorankMcpState): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state)) as AutorankMcpState;
  }
}
