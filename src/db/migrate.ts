import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../config/env.ts";
import { runMain } from "./cli.ts";
import { withDatabase } from "./client.ts";

const migrationsFolder = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../drizzle",
);

export async function applyMigrations(connectionString: string): Promise<void> {
  await withDatabase(connectionString, (db) =>
    migrate(db, { migrationsFolder }),
  );
}

runMain(import.meta.url, async () => {
  const env = loadEnv();
  await applyMigrations(env.DATABASE_URL);
});
