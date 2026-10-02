import { route } from "@/lib/api";
import { vaultStatus } from "@friday/services";

export const GET = route({ auth: "ceo" }, ({ ctx }) => vaultStatus(ctx));
