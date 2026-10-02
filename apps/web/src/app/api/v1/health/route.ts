import { route } from "@/lib/api";
import { health } from "@friday/services";

export const GET = route({ auth: "public" }, ({ ctx }) => health(ctx));
