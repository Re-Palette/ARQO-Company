import { createDb } from "../client";
import { runMigrations } from "../migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const { db, close } = createDb(url);
await runMigrations(db);
await close();
console.log("migrations applied");
