import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AIClient, RateLimiter, registerProvider, RoutingError, type ModelRoute, type ProviderConfig } from "../src";

const providers: ProviderConfig[] = [
  { id: "gemini", provider: "gemini", enabled: true, apiKeyEnv: "GEMINI_API_KEY", rateLimits: {}, dataPolicy: "may_train" },
  { id: "claude", provider: "claude", enabled: true, apiKeyEnv: "ANTHROPIC_API_KEY", rateLimits: {}, dataPolicy: "no_train" },
  { id: "openrouter", provider: "openrouter", enabled: true, apiKeyEnv: "OPENROUTER_API_KEY", rateLimits: {}, dataPolicy: "depends_on_model" },
  { id: "mock", provider: "mock", enabled: true, rateLimits: {}, dataPolicy: "local" },
];
const route = (id: string, tier: string, providerConfigId: string, modelId: string, fallbackRouteId: string | null = null): ModelRoute =>
  ({ id, tier, providerConfigId, modelId, params: {}, fallbackRouteId, active: true });

function client(routes: ModelRoute[], env: Record<string, string> = {}, ps = providers) {
  const usage: unknown[] = [];
  const ai = new AIClient({
    routes: { load: async () => ({ providers: ps, routes }) },
    usage: { record: async (u) => void usage.push(u) },
    env,
  });
  return { ai, usage };
}

afterEach(() => vi.unstubAllGlobals());

describe("Gemini adapter", () => {
  it("calls generateContent with the configured model and key header", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "こんにちは" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { ai, usage } = client([route("g", "standard", "gemini", "gemini-3.8-flash")], { GEMINI_API_KEY: "k" });
    const res = await ai.generateText({ tier: "standard", purpose: "test", system: "sys", messages: [{ role: "user", content: "hi" }] });

    expect(res).toMatchObject({ text: "こんにちは", provider: "gemini", model: "gemini-3.8-flash", usage: { inputTokens: 7, outputTokens: 3 } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.contents[0]).toEqual({ role: "user", parts: [{ text: "hi" }] });
    expect(usage).toHaveLength(1);
  });

  it("sends a JSON schema for structured output and validates the result", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"title":"調査","score":3}' }] }, finishReason: "STOP" }],
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { ai } = client([route("g", "standard", "gemini", "m")], { GEMINI_API_KEY: "k" });
    const res = await ai.generateObject({
      tier: "standard", purpose: "test", messages: [{ role: "user", content: "x" }],
      schema: z.object({ title: z.string(), score: z.number() }),
    });
    expect(res.object).toEqual({ title: "調査", score: 3 });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.properties.title.type).toBe("string");
  });
});

describe("router", () => {
  it("falls back on retryable errors (429)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    const { ai } = client(
      [route("g", "standard", "gemini", "m", "mock"), route("mock", "x", "mock", "mock-1")],
      { GEMINI_API_KEY: "k" },
    );
    const res = await ai.generateText({ tier: "standard", purpose: "t", messages: [{ role: "user", content: "hi" }] });
    expect(res.provider).toBe("mock");
    expect(res.fallbackFrom).toEqual(["g"]);
  });

  it("does not fall back on non-retryable errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad key", { status: 401 })));
    const { ai } = client([route("g", "standard", "gemini", "m", "mock"), route("mock", "x", "mock", "mock-1")], { GEMINI_API_KEY: "k" });
    await expect(ai.generateText({ tier: "standard", purpose: "t", messages: [{ role: "user", content: "hi" }] }))
      .rejects.toThrow(/HTTP 401/);
  });

  it("skips providers whose API key is missing", async () => {
    const { ai } = client([route("g", "standard", "gemini", "m")]);
    const plan = await ai.plan("standard");
    expect(plan.chain).toHaveLength(0);
    expect(plan.skipped[0]).toMatch(/GEMINI_API_KEY is not set/);
    await expect(ai.generateText({ tier: "standard", purpose: "t", messages: [] })).rejects.toBeInstanceOf(RoutingError);
  });

  it("never sends confidential or restricted data to may-train providers", async () => {
    const { ai } = client(
      [route("g", "deep", "gemini", "m", "c"), route("c", "x", "claude", "claude-opus-5-5")],
      { GEMINI_API_KEY: "k", ANTHROPIC_API_KEY: "a" },
    );
    const plan = await ai.plan("deep", "restricted");
    expect(plan.chain.map((c) => c.route.id)).toEqual(["c"]);
    expect(plan.skipped[0]).toMatch(/cannot receive restricted/);
  });

  it("enforces rate limits and moves to the fallback", async () => {
    const { ai } = client([route("m1", "fast", "mock", "a", "m2"), route("m2", "x", "mock", "b")]);
    const limited = new AIClient({
      routes: { load: async () => ({ providers: providers.map((p) => p.id === "mock" ? { ...p, rateLimits: { rpm: 1 } } : p),
        routes: [route("m1", "fast", "mock", "a", "m2"), route("m2", "x", "mock", "b")] }) },
      rateLimiter: new RateLimiter(() => 0),
    });
    void ai;
    const first = await limited.generateText({ tier: "fast", purpose: "t", messages: [{ role: "user", content: "1" }] });
    const second = await limited.generateText({ tier: "fast", purpose: "t", messages: [{ role: "user", content: "2" }] });
    expect(first.model).toBe("a");
    expect(second.model).toBe("b");
  });
});

describe("OpenAI-compatible adapters", () => {
  it("routes OpenRouter through chat completions with a bearer token", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => new Response(JSON.stringify({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { ai } = client([route("o", "standard", "openrouter", "vendor/model")], { OPENROUTER_API_KEY: "or" });
    const res = await ai.generateText({ tier: "standard", purpose: "t", system: "s", messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer or");
    expect(JSON.parse(init.body as string).messages[0]).toEqual({ role: "system", content: "s" });
  });
});

describe("registry", () => {
  it("accepts new providers without touching callers", async () => {
    registerProvider("echo", () => ({
      kind: "echo",
      capabilities: () => ({ jsonSchema: false, tools: false, vision: false }),
      generateText: async (c) => ({ text: `echo:${c.messages[0]?.content}`, usage: { inputTokens: 0, outputTokens: 0 }, finishReason: "stop" }),
      generateJson: async () => ({ text: "{}", usage: { inputTokens: 0, outputTokens: 0 }, finishReason: "stop" }),
    }));
    const { ai } = client([route("e", "fast", "echo-cfg", "e1")], {},
      [...providers, { id: "echo-cfg", provider: "echo", enabled: true, rateLimits: {}, dataPolicy: "local" }]);
    const res = await ai.generateText({ tier: "fast", purpose: "t", messages: [{ role: "user", content: "hi" }] });
    expect(res.text).toBe("echo:hi");
  });

  it("mock produces schema-shaped objects", async () => {
    const { ai } = client([route("m", "mock", "mock", "mock-1")]);
    const res = await ai.generateObject({ tier: "mock", purpose: "t", messages: [{ role: "user", content: "x" }],
      schema: z.object({ title: z.string(), items: z.array(z.string()), ok: z.boolean() }) });
    expect(res.object.items).toHaveLength(1);
    expect(res.object.ok).toBe(true);
  });
});
