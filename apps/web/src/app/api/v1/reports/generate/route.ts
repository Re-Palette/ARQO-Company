import { route, body } from "@/lib/api";
import { createReport } from "@friday/services";

export const POST = route({ auth: "ceo" }, async ({ req, ctx }) => createReport(ctx, await body(req)));
