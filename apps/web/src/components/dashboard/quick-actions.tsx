"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, FileText, HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function QuickActions() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (label: string, path: string, body: unknown = {}) => start(async () => {
    try {
      await api(path, { body });
      setMsg(`${label}: 完了`);
      router.refresh();
    } catch (e) {
      setMsg(`${label}: ${(e as Error).message}`);
    }
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("レポート作成", "/api/v1/reports/generate", { type: "daily_executive" })}><FileText />レポート作成</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("Obsidian同期", "/api/v1/settings/vault/sync")}><Brain />Obsidian同期</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run("バックアップ", "/api/v1/settings/backups/run")}><HardDriveDownload />バックアップ</Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </div>
  );
}
