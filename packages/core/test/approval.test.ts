import { describe, expect, it } from "vitest";
import { actionScore, canTransition, decisionToStatus, needsExecution } from "../src/approval";
import { payloadHash } from "../src/hash";
import { renderTemplate } from "../src/timeline";
import { DecideApprovalInput } from "../src/schemas";

describe("approval state machine", () => {
  it("only lets pending requests be decided", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
    expect(canTransition("approved", "pending")).toBe(false);
    expect(decisionToStatus("request_revision")).toBe("revision_requested");
  });

  it("executes actions but not reviews", () => {
    expect(needsExecution("deploy")).toBe(true);
    expect(needsExecution("report_review")).toBe(false);
  });

  it("scores risky, urgent, blocking items first", () => {
    const now = new Date("2026-10-02T00:00:00Z");
    const high = actionScore({ risk: "high", priority: "p1", createdAt: now, now,
      dueAt: new Date("2026-10-02T00:30:00Z"), blockingCount: 2 });
    const low = actionScore({ risk: "low", priority: "p2", createdAt: now, now });
    expect(high).toBe(30 + 40 + 6 + 10);
    expect(low).toBeLessThan(high);
  });

  it("requires a payload hash to approve and a comment to request revision", () => {
    expect(DecideApprovalInput.safeParse({ decision: "approve" }).success).toBe(false);
    expect(DecideApprovalInput.safeParse({ decision: "request_revision" }).success).toBe(false);
    expect(DecideApprovalInput.safeParse({ decision: "reject" }).success).toBe(true);
  });
});

describe("hashing and templates", () => {
  it("hashes payloads independent of key order", () => {
    expect(payloadHash({ a: 1, b: { c: 2, d: 3 } })).toBe(payloadHash({ b: { d: 3, c: 2 }, a: 1 }));
    expect(payloadHash({ a: 1 })).not.toBe(payloadHash({ a: 2 }));
  });

  it("renders timeline templates", () => {
    expect(renderTemplate("{actor} が {subject.title} を完成", { actor: "CMO", subject: { title: "投稿案" } }))
      .toBe("CMO が 投稿案 を完成");
  });
});
