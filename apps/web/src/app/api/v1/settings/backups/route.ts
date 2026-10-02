import { route } from "@/lib/api";
import { listBackupRuns } from "@friday/services";

export const GET = route({ auth: "ceo" }, async ({ ctx }) => ({ data: await listBackupRuns(ctx) }));
