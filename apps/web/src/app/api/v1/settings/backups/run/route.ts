import { route } from "@/lib/api";
import { runVaultBackup } from "@friday/services";

export const POST = route({ auth: "ceo" }, ({ ctx }) => runVaultBackup(ctx));
