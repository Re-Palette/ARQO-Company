import { DEFAULT_SCHEDULE } from "@friday/core";
import { bridgeStatus, getContext, listBackupRuns, providerOverview, vaultStatus } from "@friday/services";
import { AppShell } from "@/components/shell/app-shell";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authMode } from "@/lib/auth";
import { IssueApiKey, ProviderTestButton } from "./settings-actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = getContext();
  const [providers, vault, backups, bridge] = await Promise.all([providerOverview(ctx), vaultStatus(ctx), listBackupRuns(ctx, 5), bridgeStatus(ctx.db)]);
  return (
    <AppShell active="/settings" title={<span className="font-semibold">Settings</span>}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>AI Provider Layer</CardTitle><span className="text-xs text-muted-foreground">登録アダプタ: {providers.adapters.join(" / ")}</span></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Provider</th><th>有効</th><th>APIキー</th><th>データ方針</th><th></th></tr></thead>
              <tbody>
                {providers.providers.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2">{p.displayName}</td>
                    <td>{p.enabled ? <Badge variant="live">ON</Badge> : <Badge variant="outline">OFF</Badge>}</td>
                    <td className="text-xs">{p.apiKeyEnv ? `${p.apiKeyEnv}: ${p.apiKeySet ? "設定済み" : "未設定"}` : "不要"}</td>
                    <td className="text-xs text-muted-foreground">{p.dataPolicy}</td>
                    <td><ProviderTestButton providerId={p.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
              {Object.entries(providers.resolution).map(([tier, r]) => (
                <div key={tier} className="rounded-md border border-border p-2">
                  <p className="font-semibold">{tier}</p>
                  <p className="text-live">{r.chain.join(" → ") || "利用可能なルートなし"}</p>
                  {r.skipped.map((s) => <p key={s} className="text-muted-foreground">skip: {s}</p>)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Obsidian Vault（会社の脳）</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="font-mono text-xs">{vault.root}</p>
            <p>Git HEAD: <span className="font-mono text-xs">{vault.head?.slice(0, 10) ?? "—"}</span> · Private GitHub: {vault.remoteConfigured ? "設定済み" : "未設定（ローカルのみ）"}</p>
            <p className="text-xs text-muted-foreground">最終同期: {vault.lastSync ? `${vault.lastSync.createdAt.toISOString()} (${vault.lastSync.status}, push=${String(vault.lastSync.pushed)})` : "—"}</p>
            <p className="text-xs text-muted-foreground">{vault.folders.filter((f) => /^\d\d_/.test(f)).join(" · ")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Daily Backup</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs">
            {backups.length === 0 && <p className="text-muted-foreground">まだバックアップはありません。</p>}
            {backups.map((b) => (
              <p key={b.id} className="flex gap-2"><Badge variant={b.verified ? "live" : "high"}>{b.status}</Badge>{b.storage} · {b.startedAt.toISOString()} · {b.sizeBytes ?? 0} bytes · 復元検証 {b.verified ? "OK" : "NG"}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Universal AI Bridge（契約 {bridge.contractVersion}）</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-xs">
            <p>クライアント: {bridge.clients.map((c) => c.name).join(", ") || "なし"}</p>
            <p>Webhook Outbox: 未送信 {bridge.outbox.pending} · 送信済 {bridge.outbox.sent} · 失効 {bridge.outbox.dead}</p>
            <IssueApiKey />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>スケジュール（JST）・認証</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1 text-xs">
            {Object.entries(DEFAULT_SCHEDULE).map(([k, v]) => <p key={k}><span className="font-mono">{v.cron}</span> — {v.label}</p>)}
            <p className="mt-2">認証方式: <Badge variant="outline">{authMode()}</Badge></p>
          </CardContent>
        </Card>
        <div className="xl:col-span-2"><QuickActions /></div>
      </div>
    </AppShell>
  );
}
