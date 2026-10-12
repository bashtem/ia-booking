import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { loadEnv } from "../config/env.ts";
import { runMain } from "./cli.ts";
import { withDatabase } from "./client.ts";
import { advisors, availabilityWindows } from "./schema/index.ts";

type SeedWindow = {
  startsAt: Date;
  endsAt: Date;
};

type SeedAdvisor = {
  id: string;
  name: string;
  availability: SeedWindow[];
};

type SeedFile = {
  advisors: {
    id: string;
    name: string;
    availability: { start: string; end: string }[];
  }[];
};

function isSeedFile(value: unknown): value is SeedFile {
  if (typeof value !== "object" || value === null || !("advisors" in value)) {
    return false;
  }

  if (!Array.isArray(value.advisors)) {
    return false;
  }

  return value.advisors.every((advisor) => {
    if (typeof advisor !== "object" || advisor === null) {
      return false;
    }

    if (!("id" in advisor) || typeof advisor.id !== "string" || advisor.id.length === 0) {
      return false;
    }

    if (!("name" in advisor) || typeof advisor.name !== "string" || advisor.name.length === 0) {
      return false;
    }

    if (!("availability" in advisor) || !Array.isArray(advisor.availability)) {
      return false;
    }

    return advisor.availability.every((window: unknown) => {
      if (typeof window !== "object" || window === null) {
        return false;
      }

      return (
        "start" in window &&
        "end" in window &&
        typeof window.start === "string" &&
        typeof window.end === "string"
      );
    });
  });
}

// Fixture times are the brief's March 2025 windows, shifted to November 2026.
export function loadSeedAdvisors(): SeedAdvisor[] {
  const fileUrl = new URL("../../data/advisors.json", import.meta.url);
  const parsed: unknown = JSON.parse(readFileSync(fileUrl, "utf8"));

  if (!isSeedFile(parsed)) {
    throw new Error("data/advisors.json is not a valid advisor fixture");
  }

  return parsed.advisors.map((advisor) => ({
    id: advisor.id,
    name: advisor.name,
    availability: advisor.availability.map((window) => ({
      startsAt: new Date(window.start),
      endsAt: new Date(window.end),
    })),
  }));
}

export async function seedDatabase(connectionString: string) {
  const seedAdvisors = loadSeedAdvisors();
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
