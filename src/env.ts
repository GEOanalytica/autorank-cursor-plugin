import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseDotEnv(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    parsed[key] = stripWrappingQuotes(value);
  }

  return parsed;
}

function readOptionalEnvFile(filePath: string): Record<string, string> {
  try {
    const raw = readFileSync(resolve(filePath), "utf8");
    return parseDotEnv(raw);
  } catch {
    return {};
  }
}

export interface AutorankEnv {
  apiBaseUrl: string;
  apiKey: string;
  domainId: string;
}

export interface AutorankEnvStatus {
  env: Partial<AutorankEnv>;
  missing: string[];
  demoMode: boolean;
  hasExplicitAutorankConfig: boolean;
}

function isTruthyEnv(value: string | undefined): boolean {
  return ["1", "true", "yes"].includes((value ?? "").trim().toLowerCase());
}

function normalizeEnvValue(value: string | undefined): string {
  const normalized = stripWrappingQuotes(value ?? "").trim();
  if (/^\$\{(?:env|input):[^}]+}$/.test(normalized)) {
    return "";
  }
  return normalized;
}

function firstNonEmptyEnvValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = normalizeEnvValue(value);
    if (normalized) return normalized;
  }
  return "";
}

function readEnvValue(name: string, ...fallbacks: Array<string | undefined>): string {
  if (Object.prototype.hasOwnProperty.call(process.env, name)) {
    return normalizeEnvValue(process.env[name]);
  }
  return firstNonEmptyEnvValue(...fallbacks);
}

export function readAutorankEnv(): AutorankEnvStatus {
  const cwdEnv = readOptionalEnvFile(".env");
  const cwdLocalEnv = readOptionalEnvFile(".env.local");

  const explicitApiBaseUrl = readEnvValue(
    "AUTORANK_API_BASE_URL",
    cwdEnv.AUTORANK_API_BASE_URL,
    cwdLocalEnv.AUTORANK_API_BASE_URL,
  );
  const apiKey = readEnvValue(
    "AUTORANK_API_KEY",
    cwdEnv.AUTORANK_API_KEY,
    cwdLocalEnv.AUTORANK_API_KEY,
  );
  const domainId = readEnvValue(
    "AUTORANK_DOMAIN_ID",
    cwdEnv.AUTORANK_DOMAIN_ID,
    cwdLocalEnv.AUTORANK_DOMAIN_ID,
  );
  const supabaseUrl = readEnvValue(
    "VITE_SUPABASE_URL",
    cwdEnv.VITE_SUPABASE_URL,
    cwdLocalEnv.VITE_SUPABASE_URL,
    readEnvValue("SUPABASE_URL"),
  );
  const apiBaseUrl = explicitApiBaseUrl || (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, "")}/functions/v1` : "");

  const missing: string[] = [];
  if (!apiBaseUrl) missing.push("AUTORANK_API_BASE_URL");
  if (!apiKey) missing.push("AUTORANK_API_KEY");
  if (!domainId) missing.push("AUTORANK_DOMAIN_ID");

  return {
    env: {
      apiBaseUrl,
      apiKey,
      domainId,
    },
    missing,
    demoMode: isTruthyEnv(readEnvValue(
      "AUTORANK_DEMO_MODE",
      cwdEnv.AUTORANK_DEMO_MODE,
      cwdLocalEnv.AUTORANK_DEMO_MODE,
    )),
    hasExplicitAutorankConfig: Boolean(explicitApiBaseUrl || apiKey || domainId),
  };
}

export function loadAutorankEnv(): AutorankEnv {
  const status = readAutorankEnv();
  const { apiBaseUrl = "", apiKey = "", domainId = "" } = status.env;

  if (!apiBaseUrl) {
    throw new Error("Missing AutoRank API base URL. Set AUTORANK_API_BASE_URL or VITE_SUPABASE_URL.");
  }

  if (!apiKey) {
    throw new Error("Missing AutoRank MCP API key. Set AUTORANK_API_KEY.");
  }

  if (!domainId) {
    throw new Error("Missing AutoRank domain id. Set AUTORANK_DOMAIN_ID.");
  }

  return {
    apiBaseUrl,
    apiKey,
    domainId,
  };
}
