import { route } from "@/lib/api";
import { syncVault } from "@friday/services";

export const POST = route({ auth: "ceo" }, ({ ctx }) => syncVault(ctx));
