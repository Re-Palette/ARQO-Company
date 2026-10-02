import Link from "next/link";
import { Activity, FolderKanban, ListChecks, Scale, Sparkle, Users } from "lucide-react";
import { getContext, getDashboard } from "@friday/services";
import { AppShell } from "@/components/shell/app-shell";
import { ActionRequired, type ActionItem } from "@/components/dashboard/action-required";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { CommandBar } from "@/components/dashboard/command-bar";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Workforce } from "@/components/dashboard/workforce";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function greeting(date = new Date()) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false }).format(date));
  return h < 11 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Users; label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="flex items-center gap-3">
        <span className={`flex size-9 items-center justify-center rounded-full bg-accent ${accent ?? "text-info"}`}><Icon className="size-4" /></span>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tabular-nums leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function HomePage() {
  const d = await getDashboard(getContext());
  const { kpis } = d;
  // Project tree of any depth (ARQO → Future Ventures → ARQO Labs …), driven only by data.
  const childrenOf = (slug: string) => d.projects.filter((p) => p.parentSlug === slug);
  const roots = d.projects.filter((p) => !p.parentSlug || !d.projects.some((x) => x.slug === p.parentSlug));
  const walk = (p: (typeof d.projects)[number], depth: number): { p: typeof p; depth: number }[] =>
    [{ p, depth }, ...childrenOf(p.slug).flatMap((c) => walk(c, depth + 1))];
  const ordered = roots.flatMap((r) => walk(r, 0));

  return (
    <AppShell active="/" title={
      <span><span className="font-semibold">{greeting()}, CEO。</span>
        <span className="ml-2 text-muted-foreground">本日のタスク {kpis.tasksToday.total} 件 · 判断待ち {kpis.approvals.total} 件</span></span>
    }>
      <AutoRefresh />
      <div className="flex flex-col gap-4">
        <ActionRequired items={d.actionRequired.data as ActionItem[]} counts={d.actionRequired.counts} />

        <section aria-label="KPI" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi icon={Users} label="AI EMPLOYEES" value={kpis.agents.total} sub={`稼働中 ${kpis.agents.active}`} />
          <Kpi icon={ListChecks} label="TASKS TODAY" value={kpis.tasksToday.total} sub={`完了 ${kpis.tasksToday.done} · 進行 ${kpis.tasksToday.inProgress} · 承認待ち ${kpis.tasksToday.waiting}`} accent="text-live" />
          <Kpi icon={FolderKanban} label="PROJECTS" value={kpis.projects.total} sub={`進行中 ${kpis.projects.active}`} />
          <Kpi icon={Scale} label="CEO 判断待ち" value={kpis.approvals.total} sub={`HIGH以上 ${kpis.approvals.high + kpis.approvals.critical}`} accent="text-critical" />
          <Card className="col-span-2 gap-1 py-3 lg:col-span-1">
            <CardContent>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">🌸 RE-PALETTE</p>
              <ul className="mt-1 grid grid-cols-2 gap-x-3 text-[11px]">
                {kpis.headline.slice(0, 4).map((k) => (
                  <li key={k.key} className="flex justify-between gap-1"><span className="truncate text-muted-foreground">{k.name}</span>
                    <span className="tabular-nums">{k.value ?? "—"}{k.value ? k.unit : ""}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader><CardTitle><span className="text-live">● LIVE</span> AI WORKFORCE</CardTitle><Link href="/agents" className="text-xs text-muted-foreground hover:text-foreground">すべて見る ›</Link></CardHeader>
            <CardContent><Workforce agents={d.agents} /></CardContent>
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader><CardTitle className="flex items-center gap-2"><Sparkle className="size-4 text-gold" />COMPANY TIMELINE</CardTitle>
              <span className="text-xs text-muted-foreground">会社の出来事（時系列）</span></CardHeader>
            <CardContent>
              {d.timeline.length === 0 ? <p className="text-sm text-muted-foreground">まだ出来事はありません。</p> : (
                <ol className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
                  {d.timeline.map((t) => (
                    <li key={t.id} className={`flex gap-3 border-l-2 pl-3 text-sm ${t.importance >= 5 ? "border-gold" : t.importance >= 4 ? "border-info" : "border-border"}`}>
                      <time className="w-11 shrink-0 tabular-nums text-xs text-muted-foreground">{t.time}</time>
                      <span aria-hidden>{t.icon}</span>
                      <span className={t.importance >= 5 ? "font-semibold" : ""}>{t.text}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 xl:col-span-3">
            <Card>
              <CardHeader><CardTitle>プロジェクト</CardTitle><Link href="/projects" className="text-xs text-muted-foreground hover:text-foreground">すべて見る ›</Link></CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {ordered.map(({ p, depth }) => (
                    <li key={p.id} className="text-sm" style={{ paddingLeft: depth * 14 }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{depth > 0 && <span className="text-muted-foreground">└ </span>}{p.name}</span>
                        <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full" style={{ width: `${p.progress}%`, background: p.color ?? "var(--info)" }} /></div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4" />ACTIVITY FEED</CardTitle><span className="text-[10px] text-muted-foreground">全イベント</span></CardHeader>
              <CardContent>
                <ol className="flex max-h-64 flex-col gap-1.5 overflow-y-auto font-mono text-[11px]">
                  {d.activity.map((e) => (
                    <li key={e.id} className="flex gap-2">
                      <time className="shrink-0 text-muted-foreground">{e.time}</time>
                      <span className={`shrink-0 ${e.visibility === "internal" ? "text-muted-foreground" : "text-info"}`}>{e.type}</span>
                      <span className="truncate text-muted-foreground">{e.actor}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>

        <QuickActions />
        <CommandBar />
      </div>
    </AppShell>
  );
}
