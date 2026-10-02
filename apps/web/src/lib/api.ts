import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Scope } from "@friday/contracts";
import { authenticateApiKey, getContext, requireScope, ServiceError, type ServiceContext } from "@friday/services";
import { getSession } from "./auth";

type ApiClient = NonNullable<Awaited<ReturnType<typeof authenticateApiKey>>>;

export interface Caller {
  kind: "ceo" | "client";
  client?: ApiClient;
}

interface Options {
  /** "ceo": CEO session only. "ceo_or_key": also accepts an API key with `scope`. "public": no auth. */
  auth: "ceo" | "ceo_or_key" | "public";
  scope?: Scope;
}

type Handler<P> = (args: { req: NextRequest; ctx: ServiceContext; caller: Caller; params: P }) => Promise<unknown>;

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

/** Wraps a route handler with authentication, CSRF origin check and error mapping. */
export function route<P = Record<string, string>>(opts: Options, handler: Handler<P>) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      const ctx = getContext();
      let caller: Caller = { kind: "ceo" };
      if (opts.auth !== "public") {
        const authz = req.headers.get("authorization");
        if (authz?.startsWith("Bearer ")) {
          if (opts.auth !== "ceo_or_key") return errorResponse(403, "FORBIDDEN", "This endpoint requires a CEO session");
          const client = await authenticateApiKey(ctx.db, authz);
          if (!client) return errorResponse(401, "UNAUTHORIZED", "Invalid API key");
          if (opts.scope) requireScope(client, opts.scope);
          caller = { kind: "client", client };
        } else {
          if (!(await getSession())) return errorResponse(401, "UNAUTHORIZED", "Login required");
          // Cookie-authenticated writes must come from our own origin.
          if (req.method !== "GET") {
            const origin = req.headers.get("origin");
            if (origin && new URL(origin).host !== req.headers.get("host")) return errorResponse(403, "FORBIDDEN", "Cross-origin request");
          }
        }
      }
      const params = (await context.params) ?? ({} as P);
      const result = await handler({ req, ctx, caller, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof ServiceError) return errorResponse(e.status, e.code, e.message, e.details);
      if (e instanceof ZodError) return errorResponse(400, "VALIDATION_ERROR", "Invalid request", e.issues);
      const err = e as Error & { code?: string; reasons?: string[] };
      if (err.code === "NO_ELIGIBLE_ROUTE") return errorResponse(503, "SERVICE_UNAVAILABLE", err.message, err.reasons);
      if (err.name === "ProviderError") return errorResponse(502, "PROVIDER_ERROR", err.message);
      console.error(e);
      return errorResponse(500, "INTERNAL", "Internal error");
    }
  };
}

export async function body(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
