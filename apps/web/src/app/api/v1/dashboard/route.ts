import { route } from "@/lib/api";
import { getDashboard } from "@friday/services";

export const GET = route({ auth: "ceo" }, ({ ctx }) => getDashboard(ctx));
