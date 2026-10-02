import { describe, expect, it } from "vitest";
import {
  APPROVAL_REQUIRED_ACTIONS, assertPolicyNotRelaxed, effectiveApprovalRequired, greyZoneRequiresApproval,
  isApprovalAction, PolicyViolationError,
} from "../src/policy";

describe("AI operating policy", () => {
  it("pins the eight approval-required actions (Article 2)", () => {
    expect([...APPROVAL_REQUIRED_ACTIONS].sort()).toEqual([
      "contract", "deploy", "email_send", "external_integration",
      "external_publish", "payment", "pdf_submission", "sns_post",
    ]);
  });

  it("classifies reviews as non-actions", () => {
    expect(isApprovalAction("sns_post")).toBe(true);
    expect(isApprovalAction("report_review")).toBe(false);
  });

  it("allows additions but never relaxation", () => {
    expect(effectiveApprovalRequired(["calendar_event"])).toContain("calendar_event");
    expect(() => assertPolicyNotRelaxed(["email_send"])).toThrow(PolicyViolationError);
    expect(() => assertPolicyNotRelaxed([...APPROVAL_REQUIRED_ACTIONS, "x"])).not.toThrow();
  });

  it("is fail-safe for grey zones", () => {
    const no = { reachesOutside: false, createsMoneyOrObligation: false, hardToUndo: false, usesCeoNameOrBrand: false };
    expect(greyZoneRequiresApproval(no)).toBe(false);
    expect(greyZoneRequiresApproval({ ...no, hardToUndo: true })).toBe(true);
  });
});
