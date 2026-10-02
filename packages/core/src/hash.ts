import { createHash } from "node:crypto";

/** Deterministic JSON serialization (object keys sorted recursively). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Hash of an approval payload. Approval and execution must see the same value. */
export function payloadHash(payload: unknown): string {
  return sha256(stableStringify(payload ?? null));
}
