import { sql } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { runMain } from "./cli.ts";
import { withDatabase } from "./client.ts";
import { seedAdvisors } from "./seed-data.ts";
import { advisors, availabilityWindows } from "./schema/index.ts";

export async function seedDatabase(connectionString: string) {
  const advisorRows = seedAdvisors.map(({ id, name }) => ({ id, name }));
  const windowRows = seedAdvisors.flatMap((advisor) =>
    advisor.availability.map((slot) => ({
      advisorId: advisor.id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    })),
  );

  await withDatabase(connectionString, (db) =>
    db.transaction(async (tx) => {
      await tx
        .insert(advisors)
        .values(advisorRows)
        .onConflictDoUpdate({
          target: advisors.id,
          set: { name: sql<string>`excluded.name` },
        });

      await tx
        .insert(availabilityWindows)
        .values(windowRows)
        .onConflictDoNothing({
          target: [availabilityWindows.advisorId, availabilityWindows.startsAt],
        });
    }),
  );

  return {
    advisors: advisorRows.length,
    availabilityWindows: windowRows.length,
  };
}

runMain(import.meta.url, async () => {
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
});
