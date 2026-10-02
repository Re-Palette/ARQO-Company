/**
 * Per-process sliding-window limiter keyed by provider+model.
 * Phase 0: in memory. Phase 2 moves the counters to Postgres so the web app
 * and worker share the Gemini free-tier quota.
 */
export class RateLimiter {
  private readonly minute = new Map<string, number[]>();
  private readonly day = new Map<string, { date: string; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  tryAcquire(key: string, limits: { rpm?: number; rpd?: number }): { ok: true } | { ok: false; reason: string } {
    const t = this.now();
    const recent = (this.minute.get(key) ?? []).filter((x) => t - x < 60_000);
    if (limits.rpm && recent.length >= limits.rpm) return { ok: false, reason: `${key}: RPM limit ${limits.rpm}` };
    const date = new Date(t).toISOString().slice(0, 10);
    const d = this.day.get(key);
    const dayCount = d && d.date === date ? d.count : 0;
    if (limits.rpd && dayCount >= limits.rpd) return { ok: false, reason: `${key}: RPD limit ${limits.rpd}` };
    recent.push(t);
    this.minute.set(key, recent);
    this.day.set(key, { date, count: dayCount + 1 });
    return { ok: true };
  }
}
