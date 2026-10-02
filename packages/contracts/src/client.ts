import { randomUUID } from "node:crypto";
import { CONTRACT_VERSION, DirectiveAccepted, EventsPage, HealthResponse, type DirectiveRequest } from "./v1";

export interface FridayClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  /** Consecutive failures before the circuit opens. */
  failureThreshold?: number;
  /** How long the circuit stays open. */
  cooldownMs?: number;
}

export class FridayUnavailableError extends Error {
  constructor(message: string, readonly queued: boolean) {
    super(message);
    this.name = "FridayUnavailableError";
  }
}

interface Pending {
  idempotencyKey: string;
  body: DirectiveRequest;
}

/**
 * Client for systems that talk TO F.R.I.D.A.Y. (e.g. the Universal AI).
 * Resilient by design: timeouts, a circuit breaker and a local queue, so the
 * caller keeps working while F.R.I.D.A.Y. is down. Retries reuse the same
 * Idempotency-Key, so nothing is created twice.
 */
export class FridayClient {
  private failures = 0;
  private openUntil = 0;
  private readonly queue: Pending[] = [];

  constructor(private readonly opts: FridayClientOptions) {}

  get pending(): number {
    return this.queue.length;
  }

  async health(): Promise<HealthResponse> {
    return HealthResponse.parse(await this.request("GET", "/api/v1/health"));
  }

  /** Create a directive. If F.R.I.D.A.Y. is unreachable the request is queued locally. */
  async createDirective(body: DirectiveRequest, idempotencyKey: string = randomUUID()): Promise<DirectiveAccepted> {
    try {
      return DirectiveAccepted.parse(await this.request("POST", "/api/v1/directives", body, idempotencyKey));
    } catch (e) {
      if (e instanceof FridayUnavailableError) {
        this.queue.push({ idempotencyKey, body });
        throw new FridayUnavailableError(e.message, true);
      }
      throw e;
    }
  }

  /** Re-send queued directives (same idempotency keys). Returns the ones accepted. */
  async flush(): Promise<DirectiveAccepted[]> {
    const accepted: DirectiveAccepted[] = [];
    while (this.queue.length) {
      const next = this.queue[0]!;
      const res = DirectiveAccepted.parse(await this.request("POST", "/api/v1/directives", next.body, next.idempotencyKey));
      accepted.push(res);
      this.queue.shift();
    }
    return accepted;
  }

  /** Catch up on events missed while this client (or its webhook endpoint) was down. */
  async events(after?: string, limit = 50): Promise<EventsPage> {
    const q = new URLSearchParams({ limit: String(limit), ...(after ? { after } : {}) });
    return EventsPage.parse(await this.request("GET", `/api/v1/events?${q}`));
  }

  private async request(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    if (Date.now() < this.openUntil) throw new FridayUnavailableError("circuit open", false);
    let res: Response;
    try {
      res = await fetch(`${this.opts.baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          "x-friday-contract": CONTRACT_VERSION,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 5000),
      });
    } catch (e) {
      this.trip();
      throw new FridayUnavailableError(`F.R.I.D.A.Y. unreachable: ${(e as Error).message}`, false);
    }
    if (res.status >= 500) {
      this.trip();
      throw new FridayUnavailableError(`F.R.I.D.A.Y. returned ${res.status}`, false);
    }
    this.failures = 0;
    const json = await res.json();
    if (!res.ok) throw new Error(`F.R.I.D.A.Y. ${res.status}: ${JSON.stringify(json)}`);
    return json;
  }

  private trip() {
    this.failures += 1;
    if (this.failures >= (this.opts.failureThreshold ?? 3)) {
      this.openUntil = Date.now() + (this.opts.cooldownMs ?? 30_000);
      this.failures = 0;
    }
  }
}
