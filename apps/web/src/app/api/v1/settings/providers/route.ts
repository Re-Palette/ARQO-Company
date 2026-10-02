import { route } from "@/lib/api";
import { providerOverview } from "@friday/services";

export const GET = route({ auth: "ceo" }, ({ ctx }) => providerOverview(ctx));
