import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ maxRetries: 2, timeout: 200_000 });

export const MODELS = {
  research: process.env.RESEARCH_MODEL || "claude-sonnet-5-5",
  write: process.env.WRITE_MODEL || "claude-opus-5-5",
};

// Refusal fallbacks: on a policy decline the API reruns the request on a fallback model.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

// $ per million tokens (input, output) and per web search.
const PRICE: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};
const SEARCH_PRICE = 0.01;

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null; web_fetch_requests?: number | null } | null;
};

export function costOf(model: string, u: Usage): number {
  const [inP, outP] = PRICE[model] ?? [4, 20];
  const input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) * 1.25 + (u.cache_read_input_tokens ?? 0) * 0.1;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  return (input * inP + u.output_tokens * outP) / 1e6 + searches * SEARCH_PRICE;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
