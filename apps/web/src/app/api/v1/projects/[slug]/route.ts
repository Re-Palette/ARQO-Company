import { route } from "@/lib/api";
import { getProject } from "@friday/services";

export const GET = route<{ slug: string }>({ auth: "ceo" }, ({ ctx, params }) => getProject(ctx.db, params.slug));
