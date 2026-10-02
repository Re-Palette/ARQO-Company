"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client-api";

export function ProviderTestButton({ providerId }: { providerId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <Button size="xs" variant="outline" disabled={pending} onClick={() => start(async () => {
        try {
          const r = await api<{ model: string; text: string; latencyMs: number }>(`/api/v1/settings/providers/${providerId}/test`, { body: {} });
          setResult(`✓ ${r.model} (${r.latencyMs}ms): ${r.text.slice(0, 60)}`);
        } catch (e) {
          setResult(`✗ ${(e as Error).message}`);
        }
      })}>接続テスト</Button>
      {result && <span className="text-xs text-muted-foreground">{result}</span>}
    </span>
  );
}

export function IssueApiKey() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key, setKey] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => {
        const r = await api<{ api_key: string }>("/api/v1/settings/api-clients", { body: { name: "Universal AI" } });
        setKey(r.api_key);
        router.refresh();
      })}>Universal AI 用 APIキーを発行</Button>
      {key && <p className="break-all rounded-md border border-warn/40 bg-warn/10 p-2 font-mono text-[11px]">この一度だけ表示されます: {key}</p>}
    </div>
  );
}
