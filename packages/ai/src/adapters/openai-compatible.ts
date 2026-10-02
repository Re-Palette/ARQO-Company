import { postJson } from "../http";
import type { AdapterCall, AdapterObjectCall, AdapterResult, ProviderAdapter } from "../types";
import { ProviderError } from "../types";

interface ChatCompletion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Chat Completions API. Serves OpenAI and OpenRouter (and any other
 * OpenAI-compatible endpoint registered later) with a different base URL.
 */
export class OpenAICompatibleAdapter implements ProviderAdapter {
  constructor(
    readonly kind: string,
    private readonly defaultBaseUrl: string,
    private readonly extraHeaders: Record<string, string> = {},
  ) {}

  capabilities() {
    return { jsonSchema: true, tools: true, vision: true };
  }

  generateText(call: AdapterCall): Promise<AdapterResult> {
    return this.call(call, {});
  }

  generateJson<T>(call: AdapterObjectCall<T>): Promise<AdapterResult> {
    return this.call(call, {
      response_format: { type: "json_schema", json_schema: { name: call.schemaName, schema: call.jsonSchema } },
    });
  }

  private async call(call: AdapterCall, extra: Record<string, unknown>): Promise<AdapterResult> {
    if (!call.apiKey) throw new ProviderError(`${this.kind}: API key is not configured`, this.kind, false);
    const messages = [
      ...(call.system ? [{ role: "system", content: call.system }] : []),
      ...call.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const json = (await postJson(
      this.kind,
      `${(call.baseUrl ?? this.defaultBaseUrl).replace(/\/$/, "")}/chat/completions`,
      { authorization: `Bearer ${call.apiKey}`, ...this.extraHeaders },
      {
        model: call.model,
        messages,
        max_completion_tokens: call.maxOutputTokens,
        ...(call.temperature !== undefined ? { temperature: call.temperature } : {}),
        ...extra,
        ...call.params,
      },
      call.timeoutMs,
    )) as ChatCompletion;
    const choice = json.choices?.[0];
    if (!choice) throw new ProviderError(`${this.kind}: no choices`, this.kind, true);
    return {
      text: choice.message?.content ?? "",
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
      finishReason: choice.finish_reason ?? "unknown",
    };
  }
}
