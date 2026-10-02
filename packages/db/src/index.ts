// Runtime entry. Migrations and seeding live in "@friday/db/migrate" and
// "@friday/db/seed" so app bundles never include them.
export * as schema from "./schema";
export * from "./schema";
export * from "./client";
