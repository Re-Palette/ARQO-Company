import {
  createReport, dispatchWebhooks, notify, runVaultBackup, syncVault, workerHeartbeat, writeMeetingNote, type ServiceContext,
} from "@friday/services";
import { DEFAULT_SCHEDULE, type ScheduleKey } from "@friday/core";

export interface Job {
  name: string;
  /** Cron in Asia/Tokyo. */
  cron: string;
  run: (ctx: ServiceContext) => Promise<unknown>;
}

const at = (key: ScheduleKey, field: "cron" | "prepare" = "cron") => {
  const s = DEFAULT_SCHEDULE[key] as { cron: string; prepare?: string };
  return field === "prepare" ? s.prepare ?? s.cron : s.cron;
};

/** Phase 0 jobs. Later phases replace the placeholders with real work. */
export const JOBS: Job[] = [
  { name: "heartbeat", cron: "* * * * *", run: (ctx) => workerHeartbeat(ctx) },
  { name: "webhook.dispatch", cron: "* * * * *", run: (ctx) => dispatchWebhooks(ctx) },
  { name: "vault.sync", cron: "*/10 * * * *", run: (ctx) => syncVault(ctx) },
  {
    name: "morning_briefing", cron: at("morning_briefing"),
    run: async (ctx) => {
      await syncVault(ctx);
      return notify(ctx, ctx.db, { category: "report", title: "Morning Briefing が届きました", link: "/" });
    },
  },
  { name: "daily_report", cron: at("daily_report", "prepare"), run: (ctx) => createReport(ctx, { type: "daily_executive" }) },
  { name: "daily_backup", cron: at("daily_backup"), run: (ctx) => runVaultBackup(ctx) },
  {
    name: "weekly_board", cron: at("weekly_board"),
    run: async (ctx) => {
      const path = await ctx.vault.exclusive(() => writeMeetingNote(ctx, "Weekly Board Meeting", ["週次KPI", "部署別報告", "判断事項"]));
      await notify(ctx, ctx.db, { category: "report", title: "Weekly Board Meeting の時間です", body: path, link: "/" });
      return path;
    },
  },
  // Placeholders: implemented in Phase 4 (metrics) and Phase 5 (memory consolidation).
  { name: "metrics_snapshot", cron: at("metrics_snapshot"), run: async () => "phase4" },
  { name: "memory_consolidation", cron: at("memory_consolidation"), run: async () => "phase5" },
];
