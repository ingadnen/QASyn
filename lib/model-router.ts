import { prisma } from "./db";
import { readSettings } from "./tenant";

export type TenantModelRole = "Execution" | "Grounding" | "PR Review";

export interface TenantAiModel {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  apiKey: string;
  role: string;
  endpoint: string;
  source: "custom";
}

export interface TenantModelCallResult {
  ok: boolean;
  provider: string;
  modelId: string | null;
  text: string | null;
  fallback: boolean;
  error?: string;
  latencyMs: number;
}

interface ModelCacheEntry {
  at: number;
  value: TenantAiModel | null;
}

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, ModelCacheEntry>();

function normaliseEndpoint(provider: string, modelId: string): string | null {
  const model = String(modelId ?? "").trim();
  if (!model) return null;
  if (provider === "OpenAI") return "https://api.openai.com/v1/chat/completions";
  if (provider === "DeepSeek") return "https://api.deepseek.com/chat/completions";
  if (provider === "Anthropic Claude") return "https://api.anthropic.com/v1/messages";
  if (provider === "Google Gemini") {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  }
  if (provider === "Azure OpenAI") {
    if (/^https?:\/\//i.test(model)) return model;
    const base = String(process.env.AZURE_OPENAI_ENDPOINT ?? "").replace(/\/+$/, "");
    return base ? `${base}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=2024-10-21` : null;
  }
  if (provider === "Custom OpenAI-Compatible") {
    if (!/^https?:\/\//i.test(model)) return null;
    if (/\/chat\/completions\/?$/i.test(model)) return model;
    if (/\/v1\/?$/i.test(model)) return `${model.replace(/\/+$/, "")}/chat/completions`;
    return `${model.replace(/\/+$/, "")}/v1/chat/completions`;
  }
  return null;
}

/**
 * Resolves the tenant's active model for one execution role. The model is
 * selected from `Organisation.settingsJson` (`activeModel` + `customModels`)
 * and cached briefly so high-volume bivia decisions do not query for every call.
 */
export async function resolveTenantAiModel(
  organisationId: string,
  role: TenantModelRole,
): Promise<TenantAiModel | null> {
  const key = `${organisationId}:${role}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const org = await prisma.organisation
    .findUnique({ where: { id: organisationId }, select: { settingsJson: true } })
    .catch(() => null);
  if (!org) {
    cache.set(key, { at: Date.now(), value: null });
    return null;
  }

  const settings = readSettings(org);
  const activeModel = String(settings.activeModel ?? "").trim();
  const candidates = (settings.customModels ?? []).filter((model) => {
    if (!String(model.apiKey ?? "").trim()) return false;
    return Boolean(normaliseEndpoint(model.provider, model.modelId));
  });

  const activeLower = activeModel.toLowerCase();
  const chosen =
    candidates.find((model) => model.role === role) ??
    candidates.find((model) => model.name.toLowerCase() === activeLower || model.modelId.toLowerCase() === activeLower) ??
    candidates[0] ??
    null;
  if (!chosen) {
    cache.set(key, { at: Date.now(), value: null });
    return null;
  }

  const endpoint = normaliseEndpoint(chosen.provider, chosen.modelId);
  if (!endpoint) {
    cache.set(key, { at: Date.now(), value: null });
    return null;
  }
  const value: TenantAiModel = {
    id: chosen.id,
    name: chosen.name,
    provider: chosen.provider,
    modelId: chosen.modelId,
    apiKey: chosen.apiKey,
    role: chosen.role || role,
    endpoint,
    source: "custom",
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

function fallbackResult(error: string, started: number): TenantModelCallResult {
  return {
    ok: false,
    provider: "QASyn Vision AI",
    modelId: null,
    text: null,
    fallback: true,
    error,
    latencyMs: Date.now() - started,
  };
}

/**
 * Calls a tenant model's chat/completions endpoint and degrades to QASyn
 * Vision AI (calibrated local engine / BIVIA_API_KEY) on any failure.
 */
export async function callTenantAiModel(input: {
  organisationId: string;
  role: TenantModelRole;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<TenantModelCallResult> {
  const started = Date.now();
  const model = await resolveTenantAiModel(input.organisationId, input.role);
  if (!model) return fallbackResult("No tenant model configured for this role.", started);

  const maxTokens = Math.max(16, Math.min(8_000, input.maxTokens ?? 512));
  const temperature = Math.max(0, Math.min(2, input.temperature ?? 0.2));
  const headers: Record<string, string> = { accept: "application/json" };
  let body: Record<string, unknown> = {};

  if (model.provider === "Anthropic Claude") {
    headers["content-type"] = "application/json";
    headers["x-api-key"] = model.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    const system = input.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    body = {
      model: model.modelId,
      max_tokens: maxTokens,
      temperature,
      ...(system ? { system } : {}),
      messages: input.messages.filter((message) => message.role !== "system").map((message) => ({ role: message.role, content: message.content })),
    };
  } else if (model.provider === "Google Gemini") {
    headers["content-type"] = "application/json";
    headers["x-goog-api-key"] = model.apiKey;
    body = {
      contents: input.messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    };
  } else if (model.provider === "Azure OpenAI") {
    headers["content-type"] = "application/json";
    headers["api-key"] = model.apiKey;
    body = { messages: input.messages, max_tokens: maxTokens, temperature };
  } else {
    headers["content-type"] = "application/json";
    headers.authorization = `Bearer ${model.apiKey}`;
    body = { model: model.modelId, messages: input.messages, max_tokens: maxTokens, temperature };
  }

  try {
    const response = await fetch(model.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const error = (payload.error as { message?: string } | undefined)?.message;
      return fallbackResult(error || `Tenant model returned HTTP ${response.status}.`, started);
    }

    let text: string | null = null;
    if (model.provider === "Anthropic Claude") {
      const content = payload.content as Array<{ text?: string }> | undefined;
      text = content?.map((entry) => entry.text ?? "").join("") || null;
    } else if (model.provider === "Google Gemini") {
      const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
      text = candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") || null;
    } else {
      const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
      text = choices?.[0]?.message?.content ?? null;
    }
    if (!text) return fallbackResult("Tenant model returned an empty response.", started);
    return {
      ok: true,
      provider: model.provider,
      modelId: model.modelId,
      text,
      fallback: false,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return fallbackResult(error instanceof Error ? error.message : "Tenant model unreachable.", started);
  }
}
