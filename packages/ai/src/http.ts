import { ProviderError } from "./types";

export async function postJson(
  provider: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new ProviderError(`${provider}: network error: ${(e as Error).message}`, provider, true);
  }
  const text = await res.text();
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new ProviderError(`${provider}: HTTP ${res.status}: ${text.slice(0, 500)}`, provider, retryable, res.status);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(`${provider}: invalid JSON response`, provider, true, res.status);
  }
}
