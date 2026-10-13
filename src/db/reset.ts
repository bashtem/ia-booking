import { Client } from "pg";
import { loadEnv } from "../config/env.ts";
import { runMain } from "./cli.ts";

const localPair = ["ia_booking", "ia_booking_test"] as const;

function databaseName(connectionString: string): string {
  const name = new URL(connectionString).pathname.replace(/^\//, "");

  if (name.length === 0) {
    throw new Error("DATABASE_URL is missing a database name");
  }

  return name;
}

function withDatabaseName(connectionString: string, name: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${name}`;
  return url.href;
}

function isLocalPair(name: string): name is (typeof localPair)[number] {
  return localPair.some((database) => database === name);
}

function targetsFor(connectionString: string): string[] {
  const current = databaseName(connectionString);

  if (!isLocalPair(current)) {
    return [connectionString];
  }

  return localPair.map((name) => withDatabaseName(connectionString, name));
}

function errorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

export async function clearDatabase(connectionString: string): Promise<string> {
  const name = databaseName(connectionString);
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("SET lock_timeout = '5s'");
    await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
    `);
    await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
    await client.query("GRANT ALL ON SCHEMA public TO public");
  } finally {
    await client.end();
  }

  return name;
}

runMain(import.meta.url, async () => {
  const env = loadEnv();

  if (env.NODE_ENV === "production") {
    throw new Error("db:reset refuses to clear the database when NODE_ENV is production");
  }

  const cleared: string[] = [];

  for (const connectionString of targetsFor(env.DATABASE_URL)) {
    const name = databaseName(connectionString);

    try {
      cleared.push(await clearDatabase(connectionString));
    } catch (error) {
      if (errorCode(error) === "3D000" && name !== databaseName(env.DATABASE_URL)) {
        console.log(`Skipped ${name}; that database does not exist.`);
        continue;
      }

      throw error;
    }
  }

  console.log(`Cleared ${cleared.join(" and ")}.`);
  console.log("Restart the dev server if it was running, then run pnpm db:migrate and pnpm db:seed.");

  if (cleared.includes("ia_booking_test")) {
    console.log(
      "Migrate ia_booking_test as well before integration tests. Those tests seed it themselves.",
    );
  }
});
