export const COMPANY_TIMEZONE = "Asia/Tokyo";

/** YYYY-MM-DD in company time. */
export function companyDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: COMPANY_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

/** HH:mm in company time. */
export function companyTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COMPANY_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

/** Default schedule (docs/design/01-architecture.md 1.5). Cron fields are in company time. */
export const DEFAULT_SCHEDULE = {
  morning_briefing: { cron: "0 7 * * *", label: "Morning Briefing", prepare: "30 6 * * *" },
  daily_report: { cron: "0 23 * * *", label: "Daily Executive Report", prepare: "30 22 * * *" },
  weekly_board: { cron: "0 20 * * 0", label: "Weekly Board Meeting", prepare: "30 18 * * 0" },
  metrics_snapshot: { cron: "15 22 * * *", label: "AI社員評価スナップショット" },
  memory_consolidation: { cron: "0 2 * * *", label: "Memory Consolidation" },
  daily_backup: { cron: "0 3 * * *", label: "Daily Backup" },
  restore_test: { cron: "0 4 * * 0", label: "バックアップ復元テスト" },
} as const;
export type ScheduleKey = keyof typeof DEFAULT_SCHEDULE;
