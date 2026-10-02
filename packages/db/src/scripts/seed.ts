import { createDb } from "../client";
import { seed, type SeedProfile } from "../seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const profile = (process.env.SEED_PROFILE ?? "arqo") as SeedProfile;
const { db, close } = createDb(url);
await seed(db, profile);
await close();
console.log(`seeded (profile=${profile})`);
