import { route } from "@/lib/api";
import { testProvider } from "@friday/services";

export const POST = route<{ id: string }>({ auth: "ceo" }, ({ ctx, params }) => testProvider(ctx, params.id));
