import Link from "next/link";
import { getContext, getReport, listReports } from "@friday/services";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuickActions } from "@/components/dashboard/quick-actions";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const ctx = getContext();
  const { id } = await searchParams;
  const reports = await listReports(ctx.db);
  const selectedId = typeof id === "string" ? id : reports[0]?.id;
  const selected = selectedId ? await getReport(ctx.db, selectedId).catch(() => null) : null;
  return (
    <AppShell active="/reports" title={<span className="font-semibold">Reports</span>}>
      <div className="flex flex-col gap-4">
        <QuickActions />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader><CardTitle>レポート一覧</CardTitle></CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/reports?id=${r.id}`} className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent ${r.id === selectedId ? "bg-accent" : ""}`}>
                      <span className="truncate">{r.title}</span>
                      <Badge variant={r.status === "archived" ? "live" : r.status === "pending_review" ? "medium" : "outline"}>{r.status}</Badge>
                    </Link>
                  </li>
                ))}
                {reports.length === 0 && <li className="text-sm text-muted-foreground">まだレポートはありません。</li>}
              </ul>
            </CardContent>
          </Card>
          <Card className="lg:col-span-8">
            <CardHeader><CardTitle>{selected?.title ?? "—"}</CardTitle>
              {selected?.archive && <span className="font-mono text-[11px] text-muted-foreground">Approved Reports: {selected.archive.vaultNotePath}</span>}</CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{selected?.contentMd ?? ""}</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
