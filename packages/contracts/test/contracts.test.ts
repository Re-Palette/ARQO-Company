import { describe, expect, it, vi } from "vitest";
import { FridayClient, FridayUnavailableError, SCOPES, signWebhook, verifyWebhook } from "../src";

describe("webhook signatures", () => {
  it("verifies valid signatures and rejects tampering and replays", () => {
    const body = JSON.stringify({ a: 1 });
    const header = signWebhook("s3cret", body, 1000);
    expect(verifyWebhook("s3cret", body, header, 300, 1100)).toBe(true);
    expect(verifyWebhook("s3cret", body + " ", header, 300, 1100)).toBe(false);
    expect(verifyWebhook("other", body, header, 300, 1100)).toBe(false);
    expect(verifyWebhook("s3cret", body, header, 300, 5000)).toBe(false);
  });
});

describe("contract", () => {
  it("has no approval scope", () => {
    expect(SCOPES.some((s) => s.includes("approv") && s.startsWith("write"))).toBe(false);
  });
});

describe("FridayClient resilience", () => {
  it("queues directives while F.R.I.D.A.Y. is down and re-sends with the same idempotency key", async () => {
    const keys: string[] = [];
    let up = false;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      if (!up) throw new TypeError("fetch failed");
      keys.push((init.headers as Record<string, string>)["idempotency-key"]!);
      return new Response(JSON.stringify({ directive_id: "d1", status: "received", links: { self: "/api/v1/directives/d1" } }), { status: 202 });
    }));
    const client = new FridayClient({ baseUrl: "http://friday", apiKey: "k", failureThreshold: 99 });
    await expect(client.createDirective({ text: "調査して", type: "research", priority: "p2", callback: false }, "key-1"))
      .rejects.toMatchObject({ queued: true });
    expect(client.pending).toBe(1);
    up = true;
    const accepted = await client.flush();
    expect(accepted[0]!.directive_id).toBe("d1");
    expect(keys).toEqual(["key-1"]);
    expect(client.pending).toBe(0);
    vi.unstubAllGlobals();
  });

  it("opens the circuit after repeated failures", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("down"); });
    vi.stubGlobal("fetch", fetchMock);
    const client = new FridayClient({ baseUrl: "http://friday", apiKey: "k", failureThreshold: 2, cooldownMs: 60_000 });
    await expect(client.health()).rejects.toBeInstanceOf(FridayUnavailableError);
    await expect(client.health()).rejects.toBeInstanceOf(FridayUnavailableError);
    await expect(client.health()).rejects.toThrow(/circuit open/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
