import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AdapterCall, AdapterObjectCall, AdapterResult, ProviderAdapter } from "../types";
import { ProviderError } from "../types";

/** Anthropic Claude via the official SDK (Messages API). */
export class ClaudeAdapter implements ProviderAdapter {
  readonly kind = "claude";

  capabilities() {
    return { jsonSchema: true, tools: true, vision: true };
  }

  async generateText(call: AdapterCall): Promise<AdapterResult> {
    const client = this.client(call);
    try {
      const response = await client.messages.create(
        {
          model: call.model,
          max_tokens: call.maxOutputTokens,
          ...(call.system ? { system: call.system } : {}),
          messages: call.messages,
        },
        { timeout: call.timeoutMs },
      );
      return this.result(response);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  async generateJson<T>(call: AdapterObjectCall<T>): Promise<AdapterResult> {
    const client = this.client(call);
    try {
      const response = await client.messages.parse(
        {
          model: call.model,
          max_tokens: call.maxOutputTokens,
          ...(call.system ? { system: call.system } : {}),
          messages: call.messages,
          output_config: { format: zodOutputFormat(call.schema) },
        },
        { timeout: call.timeoutMs },
      );
      return { ...this.result(response), text: JSON.stringify(response.parsed_output ?? null) };
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private client(call: AdapterCall): Anthropic {
    if (!call.apiKey) throw new ProviderError("claude: API key is not configured", "claude", false);
    return new Anthropic({ apiKey: call.apiKey, ...(call.baseUrl ? { baseURL: call.baseUrl } : {}), maxRetries: 0 });
  }

  private result(response: Anthropic.Message): AdapterResult {
    if (response.stop_reason === "refusal") {
      throw new ProviderError("claude: request was declined (refusal)", "claude", false);
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      text,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      finishReason: response.stop_reason ?? "unknown",
    };
  }

  private wrap(e: unknown): Error {
    if (e instanceof ProviderError) return e;
    if (e instanceof Anthropic.RateLimitError) return new ProviderError(`claude: ${e.message}`, "claude", true, 429);
    if (e instanceof Anthropic.InternalServerError) return new ProviderError(`claude: ${e.message}`, "claude", true, e.status);
    if (e instanceof Anthropic.APIConnectionError) return new ProviderError(`claude: ${e.message}`, "claude", true);
    if (e instanceof Anthropic.APIError) return new ProviderError(`claude: ${e.message}`, "claude", false, e.status);
    return new ProviderError(`claude: ${(e as Error).message}`, "claude", false);
  }
}
