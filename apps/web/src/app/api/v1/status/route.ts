import { route } from "@/lib/api";
import { getDashboard } from "@friday/services";

export const GET = route({ auth: "ceo_or_key", scope: "read:status" }, async ({ ctx }) => {
  const d = await getDashboard(ctx);
  return { company: d.company.name, kpis: d.kpis, agents: d.agents.map((a) => ({ id: a.id, name: a.displayName, state: a.presence.state })) };
});
