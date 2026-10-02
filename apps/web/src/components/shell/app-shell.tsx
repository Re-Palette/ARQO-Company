import type { ReactNode } from "react";
import { Bell, LogOut } from "lucide-react";
import { companyDate, companyTime } from "@friday/core";
import { getContext, health } from "@friday/services";
import { schema } from "@friday/db";
import { and, count, isNull } from "drizzle-orm";
import { logoutAction } from "@/app/login/actions";
import { requireCeo } from "@/lib/auth";
import { Sidebar } from "./sidebar";

export async function AppShell({ active, title, children }: { active: string; title?: ReactNode; children: ReactNode }) {
  await requireCeo();
  const ctx = getContext();
  const [h, [unread]] = await Promise.all([
    health(ctx),
    ctx.db.select({ n: count() }).from(schema.notifications).where(and(isNull(schema.notifications.readAt), isNull(schema.notifications.archivedAt))),
  ]);
  const now = new Date();
  const workerColor = h.worker === "ok" ? "bg-live" : h.worker === "down" ? "bg-critical" : "bg-muted-foreground";
  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-border px-4 md:px-6">
          <div className="min-w-0 flex-1 truncate text-sm">{title}</div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="tabular-nums">{companyDate(now).replaceAll("-", ".")} {companyTime(now)}</span>
            <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
              <span className={`size-1.5 rounded-full ${workerColor}`} /> Worker {h.worker}
            </span>
          </div>
          <span className="relative" aria-label={`未読通知 ${unread!.n} 件`}>
            <Bell className="size-5 text-muted-foreground" />
            {unread!.n > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-critical px-1.5 text-[10px] font-bold text-white">{unread!.n}</span>}
          </span>
          <form action={logoutAction}>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" aria-label="ログアウト">
              <LogOut className="size-4" />
            </button>
          </form>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
