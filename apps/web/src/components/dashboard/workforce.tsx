"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export interface WorkforceAgent {
  id: string;
  displayName: string;
  title: string;
  runtime: string;
  division: { name: string; color: string | null };
  presence: { state: string; label: string | null };
}

const STATE: Record<string, { label: string; color: string }> = {
  idle: { label: "待機中", color: "bg-muted-foreground" },
  thinking: { label: "Thinking", color: "bg-violet-400" },
  researching: { label: "Researching", color: "bg-cyan-400" },
  coding: { label: "Coding", color: "bg-info" },
  writing: { label: "Writing", color: "bg-teal-400" },
  designing: { label: "Designing", color: "bg-pink-400" },
  meeting: { label: "In Meeting", color: "bg-amber-400" },
  waiting_approval: { label: "承認待ち", color: "bg-warn" },
  blocked: { label: "要対応", color: "bg-critical" },
  offline: { label: "停止中", color: "bg-muted" },
};

export function Workforce({ agents }: { agents: WorkforceAgent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = (id: string) => start(async () => {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/v1/agents/${id}/run`, { body: {} });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  });
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {agents.map((a) => {
        const s = STATE[a.presence.state] ?? STATE.idle!;
        const active = !["idle", "offline"].includes(a.presence.state);
        return (
          <div key={a.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background/40 p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full border border-border text-xs font-bold"
                style={{ color: a.division.color ?? undefined }}>{a.displayName.slice(0, 2)}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{a.displayName}</p>
                <p className="truncate text-[11px] text-muted-foreground">{a.title} · {a.division.name}</p>
              </div>
            </div>
            <p className="flex items-center gap-1.5 text-xs">
              <span className={`size-2 rounded-full ${s.color} ${active ? "animate-pulse" : ""}`} />
              {s.label}
            </p>
            <p className="line-clamp-1 min-h-4 text-[11px] text-muted-foreground">{a.presence.label ?? "—"}</p>
            {a.runtime === "mock" && (
              <Button size="xs" variant="outline" disabled={pending} onClick={() => run(a.id)} aria-label={`${a.displayName} に作業させる`}>
                <Play />{busy === a.id ? "作業中…" : "Mock 作業を実行"}
              </Button>
            )}
          </div>
        );
      })}
      {error && <p className="col-span-full text-xs text-critical">{error}</p>}
    </div>
  );
}
