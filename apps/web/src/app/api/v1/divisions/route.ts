import { route } from "@/lib/api";
import { listDivisions } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ ctx }) => ({ data: await listDivisions(ctx.db) }));
