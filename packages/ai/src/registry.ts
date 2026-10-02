import { ClaudeAdapter } from "./adapters/claude";
import { GeminiAdapter } from "./adapters/gemini";
import { MockAdapter } from "./adapters/mock";
import { OpenAICompatibleAdapter } from "./adapters/openai-compatible";
import type { ProviderAdapter, ProviderKind } from "./types";

/**
 * Provider registry. Adding a provider = implement ProviderAdapter and
 * register it here (or at runtime). Callers never import adapters directly.
 */
const factories = new Map<ProviderKind, () => ProviderAdapter>([
  ["gemini", () => new GeminiAdapter()],
  ["claude", () => new ClaudeAdapter()],
  ["openai", () => new OpenAICompatibleAdapter("openai", "https://api.openai.com/v1")],
  ["openrouter", () => new OpenAICompatibleAdapter("openrouter", "https://openrouter.ai/api/v1", { "X-Title": "F.R.I.D.A.Y." })],
  ["mock", () => new MockAdapter()],
]);

const instances = new Map<ProviderKind, ProviderAdapter>();

export function registerProvider(kind: ProviderKind, factory: () => ProviderAdapter): void {
  factories.set(kind, factory);
  instances.delete(kind);
}

export function getAdapter(kind: ProviderKind): ProviderAdapter | undefined {
  const cached = instances.get(kind);
  if (cached) return cached;
  const factory = factories.get(kind);
  if (!factory) return undefined;
  const adapter = factory();
  instances.set(kind, adapter);
  return adapter;
}

export function registeredProviders(): ProviderKind[] {
  return [...factories.keys()];
}
