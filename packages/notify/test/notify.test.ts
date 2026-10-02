import { describe, expect, it, vi } from "vitest";
import { channelsFor, getNotificationProvider, inQuietHours, registerNotificationProvider } from "../src";

const msg = { id: "n1", category: "action_required" as const, severity: "warning" as const, title: "承認", body: "SNS投稿", deepLink: "/approvals/1" };

describe("notification layer", () => {
  it("always includes in-app and applies severity thresholds", () => {
    const rules = [
      { category: "alert" as const, minSeverity: "warning" as const, channelIds: ["web_push"], enabled: true },
    ];
    expect(channelsFor(rules, "alert", "info")).toEqual(["in_app"]);
    expect(channelsFor(rules, "alert", "critical")).toEqual(["in_app", "web_push"]);
  });

  it("handles quiet hours across midnight", () => {
    expect(inQuietHours("03:00", { start: "00:00", end: "06:30" })).toBe(true);
    expect(inQuietHours("23:00", { start: "00:00", end: "06:30" })).toBe(false);
    expect(inQuietHours("23:30", { start: "23:00", end: "06:30" })).toBe(true);
  });

  it("web push reports missing VAPID config instead of failing silently", async () => {
    const res = await getNotificationProvider("web_push")!.send(msg, { id: "web_push", provider: "web_push", enabled: true, config: {} }, {});
    expect(res.status).toBe("skipped");
    expect(res.error).toMatch(/VAPID_PUBLIC_KEY/);
  });

  it("slack sends a link, not an approval button", async () => {
    const fetchMock = vi.fn(async (_u: string, _i: RequestInit) => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const res = await getNotificationProvider("slack")!.send(msg,
      { id: "s", provider: "slack", enabled: true, config: { webhookUrlEnv: "SLACK_URL" } },
      { SLACK_URL: "https://hooks.example/x", APP_URL: "https://friday.example" });
    expect(res.status).toBe("sent");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string).text).toContain("https://friday.example/approvals/1");
    vi.unstubAllGlobals();
  });

  it("accepts new providers (e.g. LINE) through the registry", async () => {
    registerNotificationProvider({
      id: "line",
      capabilities: () => ({ richText: false, image: true, actionButtons: false, deepLink: true, maxLength: 5000 }),
      validateConfig: () => [],
      send: async () => ({ status: "sent" }),
    });
    expect(await getNotificationProvider("line")!.send(msg, { id: "l", provider: "line", enabled: true, config: {} }, {}))
      .toEqual({ status: "sent" });
  });
});
