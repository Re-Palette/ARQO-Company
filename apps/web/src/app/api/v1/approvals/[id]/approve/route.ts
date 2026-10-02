import { route, body } from "@/lib/api";
import { decide } from "@friday/services";

/** CEO session only — API keys can never decide (AI operating rules, Article 4). */
export const POST = route<{ id: string }>({ auth: "ceo" }, async ({ req, ctx, params }) => {
  const b = (await body(req)) as { payload_hash?: string; comment?: string };
  return decide(ctx, params.id, { decision: "approve", payloadHash: b.payload_hash, comment: b.comment });
});
