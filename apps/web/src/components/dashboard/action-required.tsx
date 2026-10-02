"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

export interface ActionItem {
  id: string;
  kind: string;
  category: string;
  label: string;
  title: string;
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  requestedBy: { name: string };
  project: { name: string | null } | null;
  dueAt: string | null;
  blocking: { tasks: number };
  payloadHash: string;
}

function ActionCard({ item }: { item: ActionItem }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "revise">("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = (path: string, body: Record<string, unknown>) => start(async () => {
    setError(null);
    try {
      await api(`/api/v1/approvals/${item.id}/${path}`, { body });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  });

  return (
    <article className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-xl border border-critical/25 bg-[#140d16]/70 p-3">
      <div className="flex items-center gap-2">
        <Badge variant={item.riskLevel}>{item.riskLevel.toUpperCase()}</Badge>
        <span className="text-xs text-muted-foreground">{item.label}</span>
        {item.category === "action" && <Badge variant="outline" className="ml-auto text-[10px]">社外</Badge>}
      </div>
      <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>
      <p className="line-clamp-1 text-xs text-muted-foreground">{item.summary || "—"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span>{item.requestedBy.name}{item.project?.name ? ` · ${item.project.name}` : ""}</span>
        {item.blocking.tasks > 0 && <span className="text-warn">⛔ 止まっているタスク {item.blocking.tasks}</span>}
        {item.dueAt && <span className="flex items-center gap-1"><Clock className="size-3" />{new Date(item.dueAt).toLocaleString("ja-JP")}</span>}
      </div>
      {mode === "revise" ? (
        <div className="flex gap-2">
          <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="差し戻し理由（必須）" className="h-8 text-xs" />
          <Button size="sm" variant="secondary" disabled={pending || !comment.trim()} onClick={() => act("request-revision", { comment })}>送信</Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")} aria-label="キャンセル"><X /></Button>
        </div>
      ) : (
        <div className="mt-auto flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => act("approve", { payload_hash: item.payloadHash })}><CheckCircle2 />承認</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => setMode("revise")}><Undo2 />差し戻し</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("reject", {})}>却下</Button>
        </div>
      )}
      {error && <p className="text-xs text-critical">{error}</p>}
    </article>
  );
}

/** CEO ACTION REQUIRED — only items that cannot move without a CEO decision. */
export function ActionRequired({ items, counts }: { items: ActionItem[]; counts: { total: number; high: number; critical: number } }) {
  if (items.length === 0) {
    return (
      <section aria-label="CEO ACTION REQUIRED" className="flex items-center gap-3 rounded-xl border border-live/25 bg-live/5 px-4 py-3 text-sm">
        <CheckCircle2 className="size-4 text-live" />
        <span className="font-semibold tracking-wide">CEO ACTION REQUIRED</span>
        <span className="text-muted-foreground">判断待ちはありません。AI社員は自律で稼働中です。</span>
      </section>
    );
  }
  return (
    <section aria-label="CEO ACTION REQUIRED" className="glow-critical rounded-2xl border border-critical/40 bg-critical/[0.04] p-4">
      <header className="mb-3 flex items-center gap-3">
        <AlertTriangle className="size-5 text-critical" />
        <h2 className="text-sm font-bold tracking-[0.15em]">CEO ACTION REQUIRED</h2>
        <span className="rounded-full bg-critical px-2 text-xs font-bold text-white">{counts.total}</span>
        <span className="text-xs text-muted-foreground">あなたの判断で止まっています{counts.high + counts.critical > 0 ? `（HIGH以上 ${counts.high + counts.critical} 件）` : ""}</span>
      </header>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.slice(0, 4).map((i) => <ActionCard key={i.id} item={i} />)}
      </div>
      {items.length > 4 && <p className="mt-2 text-xs text-muted-foreground">ほか {items.length - 4} 件</p>}
    </section>
  );
}
