import { route } from "@/lib/api";
import { actionQueue } from "@friday/services";

export const GET = route({ auth: "ceo" }, ({ ctx }) => actionQueue(ctx.db));
