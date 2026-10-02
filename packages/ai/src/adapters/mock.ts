import type { AdapterCall, AdapterObjectCall, AdapterResult, ProviderAdapter } from "../types";

/** Deterministic offline provider for development, demos and tests. */
export class MockAdapter implements ProviderAdapter {
  readonly kind = "mock";

  capabilities() {
    return { jsonSchema: true, tools: false, vision: false };
  }

  async generateText(call: AdapterCall): Promise<AdapterResult> {
    const last = call.messages.at(-1)?.content ?? "";
    const text = `【Mock応答】${last.slice(0, 120)}`;
    return { text, usage: estimate(call, text), finishReason: "stop" };
  }

  async generateJson<T>(call: AdapterObjectCall<T>): Promise<AdapterResult> {
    const text = JSON.stringify(sample(call.jsonSchema, call.messages.at(-1)?.content ?? ""));
    return { text, usage: estimate(call, text), finishReason: "stop" };
  }
}

function estimate(call: AdapterCall, out: string) {
  const input = (call.system ?? "") + call.messages.map((m) => m.content).join("");
  return { inputTokens: Math.ceil(input.length / 2), outputTokens: Math.ceil(out.length / 2) };
}

/** Build a minimal value that satisfies a JSON schema. */
function sample(schema: Record<string, unknown>, hint: string): unknown {
  if (Array.isArray(schema.enum)) return schema.enum[0];
  switch (schema.type) {
    case "object": {
      const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, sample(v, `${hint}:${k}`)]));
    }
    case "array":
      return [sample((schema.items ?? {}) as Record<string, unknown>, hint)];
    case "number":
    case "integer":
      return typeof schema.minimum === "number" ? schema.minimum : 1;
    case "boolean":
      return true;
    default:
      return `mock:${hint.slice(0, 40)}`;
  }
}
