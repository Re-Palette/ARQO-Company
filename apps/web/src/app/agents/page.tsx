import { getContext, listAgents, listDivisions } from "@friday/services";
import { AppShell } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Workforce } from "@/components/dashboard/workforce";
import { RegisterAgentForm } from "./register-agent-form";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const ctx = getContext();
  const [agents, divisions] = await Promise.all([listAgents(ctx.db), listDivisions(ctx.db)]);
  return (
    <AppShell active="/agents" title={<span className="font-semibold">AI Employees — Agent Registry</span>}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>AI社員を採用（Mock Agent 登録）</CardTitle></CardHeader>
          <CardContent><RegisterAgentForm divisions={divisions.map((d) => ({ value: d.id, label: d.nameJa }))} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>在籍 {agents.length} 名</CardTitle></CardHeader>
          <CardContent><Workforce agents={agents} /></CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
