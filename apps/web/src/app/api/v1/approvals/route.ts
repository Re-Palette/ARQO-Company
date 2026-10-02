import { route, body } from "@/lib/api";
import { createApproval, listApprovals } from "@friday/services";
import { APPROVAL_STATUSES, type ApprovalStatus } from "@friday/core";

export const GET = route({ auth: "ceo_or_key", scope: "read:approvals" }, async ({ req, ctx }) => {
  const s = req.nextUrl.searchParams.get("status");
  const status = s && (APPROVAL_STATUSES as readonly string[]).includes(s) ? (s as ApprovalStatus) : undefined;
  return { data: await listApprovals(ctx.db, status) };
});

/** Create an approval request on behalf of an AI employee (agents normally do this themselves). */
export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => createApproval(ctx, await body(req)));
