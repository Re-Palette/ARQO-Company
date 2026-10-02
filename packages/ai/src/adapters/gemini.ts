import { postJson } from "../http";
import type { AdapterCall, AdapterObjectCall, AdapterResult, ProviderAdapter } from "../types";
import { ProviderError } from "../types";

const DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
}

/** Google Gemini via the generateContent REST endpoint. */
export class GeminiAdapter implements ProviderAdapter {
  readonly kind = "gemini";

  capabilities() {
    return { jsonSchema: true, tools: true, vision: true };
  }

  generateText(call: AdapterCall): Promise<AdapterResult> {
    return this.call(call, {});
  }

  generateJson<T>(call: AdapterObjectCall<T>): Promise<AdapterResult> {
    return this.call(call, { responseMimeType: "application/json", responseJsonSchema: call.jsonSchema });
  }

  private async call(call: AdapterCall, extraConfig: Record<string, unknown>): Promise<AdapterResult> {
    if (!call.apiKey) throw new ProviderError("gemini: API key is not configured", "gemini", false);
    const base = call.baseUrl ?? DEFAULT_BASE;
    const body = {
      contents: call.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      ...(call.system ? { systemInstruction: { parts: [{ text: call.system }] } } : {}),
      generationConfig: {
        maxOutputTokens: call.maxOutputTokens,
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
        ...extraConfig,
        ...(call.params.generationConfig as Record<string, unknown> | undefined),
      },
    };
    const json = (await postJson(
      "gemini",
      `${base}/models/${encodeURIComponent(call.model)}:generateContent`,
      { "x-goog-api-key": call.apiKey },
      body,
      call.timeoutMs,
    )) as GeminiResponse;
    const candidate = json.candidates?.[0];
    if (!candidate) {
      throw new ProviderError(`gemini: no candidates (${json.promptFeedback?.blockReason ?? "unknown"})`, "gemini", false);
    }
    return {
      text: (candidate.content?.parts ?? []).map((p) => p.text ?? "").join(""),
      usage: {
        inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      },
      finishReason: candidate.finishReason ?? "unknown",
    };
  }
}
