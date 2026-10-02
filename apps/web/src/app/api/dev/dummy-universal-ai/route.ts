import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook, type EventEnvelope } from "@friday/contracts";

/**
 * Dummy Universal AI webhook receiver (Phase 0). Enabled only when
 * ENABLE_DUMMY_UNIVERSAL_AI=true. Verifies the signature like the real
 * Universal AI must, and keeps the last events in memory.
 */
const g = globalThis as unknown as { __dummyUA?: { at: string; verified: boolean; event: EventEnvelope }[] };
const inbox = (g.__dummyUA ??= []);
const enabled = () => process.env.ENABLE_DUMMY_UNIVERSAL_AI === "true" && process.env.NODE_ENV !== "production";

export async function POST(req: NextRequest) {
  if (!enabled()) return NextResponse.json({ error: { code: "NOT_FOUND", message: "disabled" } }, { status: 404 });
  const raw = await req.text();
  const verified = verifyWebhook(process.env.UNIVERSAL_AI_WEBHOOK_SECRET ?? "", raw, req.headers.get("x-friday-signature"));
  if (!verified) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "bad signature" } }, { status: 401 });
  inbox.unshift({ at: new Date().toISOString(), verified, event: JSON.parse(raw) });
  inbox.splice(50);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (!enabled()) return NextResponse.json({ error: { code: "NOT_FOUND", message: "disabled" } }, { status: 404 });
  return NextResponse.json({ received: inbox });
}
