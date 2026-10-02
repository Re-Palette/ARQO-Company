export type ErrorCode =
  | "VALIDATION_ERROR" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "RATE_LIMITED"
  | "APPROVAL_HASH_MISMATCH" | "POLICY_VIOLATION" | "SERVICE_UNAVAILABLE" | "UNAUTHORIZED";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409,
  APPROVAL_HASH_MISMATCH: 409, POLICY_VIOLATION: 403, RATE_LIMITED: 429, SERVICE_UNAVAILABLE: 503,
};

export class ServiceError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly details?: unknown) {
    super(message);
    this.name = "ServiceError";
  }
  get status(): number {
    return STATUS[this.code];
  }
}
