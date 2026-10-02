import { ulid } from "ulid";

/** All entity IDs are ULIDs (time-sortable, shared between DB and Vault frontmatter). */
export function newId(): string {
  return ulid();
}

/** Short human-readable suffix used in vault filenames, e.g. "T-7K2M". */
export function shortId(id: string, prefix = ""): string {
  const tail = id.slice(-4).toUpperCase();
  return prefix ? `${prefix}-${tail}` : tail;
}
