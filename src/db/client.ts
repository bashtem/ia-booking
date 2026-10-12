import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  advisors,
  advisorsRelations,
  availabilityWindows,
  availabilityWindowsRelations,
  bookings,
  bookingsRelations,
} from "./schema/index.ts";

const schema = {
  advisors,
  availabilityWindows,
  bookings,
  advisorsRelations,
  availabilityWindowsRelations,
  bookingsRelations,
};

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle({ client: pool, schema });

  return { db, pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];

export async function withDatabase<T>(
  connectionString: string,
  run: (db: Database) => Promise<T>,
): Promise<T> {
  const { db, pool } = createDatabase(connectionString);

  try {
    return await run(db);
  } finally {
    await pool.end();
  }
}
