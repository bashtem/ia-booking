import { realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { loadEnv } from "../config/env.ts";
import { createDatabase } from "./client.ts";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export async function applyMigrations(connectionString: string) {
  const { db, pool } = createDatabase(connectionString);

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }

  return import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

if (isDirectRun()) {
  const env = loadEnv();
  await applyMigrations(env.DATABASE_URL);
}
