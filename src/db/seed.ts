import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { createDatabase } from "./client.ts";
import { seedAdvisors } from "./seed-data.ts";
import { advisors, availabilityWindows } from "./schema/index.ts";

export async function seedDatabase(connectionString: string) {
  const { db, pool } = createDatabase(connectionString);
  const windows = seedAdvisors.flatMap((advisor) =>
    advisor.availability.map((slot) => ({
      advisorId: advisor.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    })),
  );

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(advisors)
        .values(seedAdvisors.map(({ id, name }) => ({ id, name })))
        .onConflictDoUpdate({
          target: advisors.id,
          set: { name: sql<string>`excluded.name` },
        });

      await tx
        .insert(availabilityWindows)
        .values(windows)
        .onConflictDoNothing({
          target: [availabilityWindows.advisorId, availabilityWindows.startsAt],
        });
    });
  } finally {
    await pool.end();
  }

  return {
    advisors: seedAdvisors.length,
    availabilityWindows: windows.length,
  };
}

function isDirectRun() {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }

  return import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

async function runCli() {
  const env = loadEnv();

  if (env.NODE_ENV === "production") {
    throw new Error(
      "db:seed refuses to load fixture data when NODE_ENV is production",
    );
  }

  const seeded = await seedDatabase(env.DATABASE_URL);
  console.log(
    `Seeded ${seeded.advisors} advisors and ${seeded.availabilityWindows} availability windows.`,
  );
}

if (isDirectRun()) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
