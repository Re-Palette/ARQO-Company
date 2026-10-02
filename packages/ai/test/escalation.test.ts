import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AIClient, type ModelRoute, type ProviderConfig } from "../src";

/**
 * Cost policy: every tier runs on Flash-Lite; the stronger model is used only
 * for an enabled escalation reason.
 */
const providers: ProviderConfig[] = [
  { id: "gemini", provider: "gemini", enabled: true, apiKeyEnv: "GEMINI_API_KEY", rateLimits: {}, dataPolicy: "may_train" },
];
const r = (id: string, tier: string, modelId: string, extra: Partial<ModelRoute> = {}): ModelRoute =>
  ({ id, tier, providerConfigId: "gemini", modelId, params: {}, fallbackRouteId: null, active: true, ...extra });

const LITE = "gemini-3.5-flash-lite";
const FLASH = "gemini-3.8-flash";
const baseRoutes = (escalationParams: Record<string, unknown> = {}, escalationActive = true): ModelRoute[] => [
  r("fast", "fast", LITE), r("standard", "standard", LITE), r("deep", "deep", LITE),
  r("esc", "escalation", FLASH, { fallbackRouteId: "fast", active: escalationActive, params: escalationParams }),
];

/** Fake Gemini: answers with the model name it was called with (or a scripted body per model). */
function fakeGemini(bodies: Record<string, string> = {}, status: Record<string, number> = {}) {
  const calls: { model: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const model = decodeURIComponent(/models\/(.+):generateContent/.exec(url)![1]!);
    calls.push({ model, body: JSON.parse(init.body as string) });
    if (status[model]) return new Response("err", { status: status[model] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: bodies[model] ?? model }] }, finishReason: "STOP" }] }));
  }));
  return calls;
}

function client(routes: ModelRoute[]) {
  const usage: { purpose: string; modelId: string }[] = [];
  const ai = new AIClient({
    routes: { load: async () => ({ providers, routes }) },
    usage: { record: async (u) => void usage.push(u) },
    env: { GEMINI_API_KEY: "k" },
  });
  return { ai, usage };
}

const msg = (content: string) => [{ role: "user" as const, content }];

afterEach(() => vi.unstubAllGlobals());

describe("cost policy: Flash-Lite by default", () => {
  it("serves fast, standard and deep from Flash-Lite", async () => {
    const calls = fakeGemini();
    const { ai } = client(baseRoutes());
    for (const tier of ["fast", "standard", "deep"] as const) {
      const res = await ai.generateText({ tier, purpose: "t", messages: msg("hi") });
      expect(res.model).toBe(LITE);
      expect(res.escalation).toBeNull();
    }
    expect(calls.every((c) => c.model === LITE)).toBe(true);
  });

  it("does not jump to the stronger model when Flash-Lite is rate limited", async () => {
    fakeGemini({}, { [LITE]: 429 });
    const { ai } = client(baseRoutes());
    await expect(ai.generateText({ tier: "deep", purpose: "t", messages: msg("hi") })).rejects.toThrow(/All AI routes failed/);
  });
});

describe("escalation to the stronger model", () => {
  it.each(["complex_reasoning", "cross_source_analysis", "ceo_deep_request"] as const)("escalates for %s", async (reason) => {
    fakeGemini();
    const { ai, usage } = client(baseRoutes());
    const res = await ai.generateText({ tier: "fast", purpose: "analysis", messages: msg("hi"), escalation: reason });
    expect(res.model).toBe(FLASH);
    expect(res.escalation).toBe(reason);
    expect(usage[0]!.purpose).toBe(`analysis#escalated:${reason}`);
  });

  it("detects long documents from the configured threshold", async () => {
    fakeGemini();
    const { ai } = client(baseRoutes({ escalation: { long_input_chars: 100 } }));
    expect((await ai.generateText({ tier: "fast", purpose: "t", messages: msg("x".repeat(99)) })).model).toBe(LITE);
    const long = await ai.generateText({ tier: "fast", purpose: "t", messages: msg("x".repeat(101)) });
    expect(long.model).toBe(FLASH);
    expect(long.escalation).toBe("long_document");
  });

  it("only escalates for reasons enabled in the DB settings", async () => {
    fakeGemini();
    const { ai } = client(baseRoutes({ escalation: { reasons: ["ceo_deep_request"] } }));
    expect((await ai.generateText({ tier: "fast", purpose: "t", messages: msg("hi"), escalation: "complex_reasoning" })).model).toBe(LITE);
    expect((await ai.generateText({ tier: "fast", purpose: "t", messages: msg("hi"), escalation: "ceo_deep_request" })).model).toBe(FLASH);
  });

  it("stays on Flash-Lite when the escalation route is inactive", async () => {
    fakeGemini();
    const { ai } = client(baseRoutes({}, false));
    const res = await ai.generateText({ tier: "fast", purpose: "t", messages: msg("hi"), escalation: "ceo_deep_request" });
    expect(res.model).toBe(LITE);
    expect(res.escalation).toBeNull();
  });

  it("falls back to Flash-Lite if the stronger model fails", async () => {
    fakeGemini({}, { [FLASH]: 503 });
    const { ai } = client(baseRoutes());
    const res = await ai.generateText({ tier: "fast", purpose: "t", messages: msg("hi"), escalation: "complex_reasoning" });
    expect(res.model).toBe(LITE);
    expect(res.escalation).toBeNull();
    expect(res.fallbackFrom).toEqual(["esc"]);
  });

  it("never sends the escalation policy to the provider", async () => {
    const calls = fakeGemini();
    const { ai } = client(baseRoutes({ escalation: { reasons: ["complex_reasoning"] } }));
    await ai.generateText({ tier: "fast", purpose: "t", messages: msg("hi"), escalation: "complex_reasoning" });
    expect(JSON.stringify(calls[0]!.body)).not.toContain("escalation");
  });
});

describe("low confidence", () => {
  const schema = z.object({ answer: z.string(), confidence: z.number() });

  it("retries on the stronger model when Flash-Lite's output does not match the schema", async () => {
    const calls = fakeGemini({ [LITE]: "not json", [FLASH]: '{"answer":"ok","confidence":0.9}' });
    const { ai } = client(baseRoutes());
    const res = await ai.generateObject({ tier: "fast", purpose: "t", messages: msg("q"), schema });
    expect(res.object.answer).toBe("ok");
    expect(res.escalation).toBe("low_confidence");
    expect(calls.map((c) => c.model)).toEqual([LITE, FLASH]);
  });

  it("retries when the caller judges the answer not good enough", async () => {
    fakeGemini({ [LITE]: '{"answer":"?","confidence":0.2}', [FLASH]: '{"answer":"sure","confidence":0.95}' });
    const { ai } = client(baseRoutes());
    const res = await ai.generateObject({ tier: "fast", purpose: "t", messages: msg("q"), schema, escalateIf: (o) => o.confidence < 0.6 });
    expect(res.object.answer).toBe("sure");
  });

  it("keeps the Flash-Lite answer when it is good enough", async () => {
    const calls = fakeGemini({ [LITE]: '{"answer":"fine","confidence":0.9}' });
    const { ai } = client(baseRoutes());
    const res = await ai.generateObject({ tier: "fast", purpose: "t", messages: msg("q"), schema, escalateIf: (o) => o.confidence < 0.6 });
    expect(res.object.answer).toBe("fine");
    expect(calls).toHaveLength(1);
  });
});
