import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.ts";
import { advisors } from "../../db/schema/index.ts";
import type { Advisor } from "./advisor.types.ts";

export async function findAdvisorById(
  db: Db,
  id: string,
): Promise<Advisor | null> {
  const [row] = await db
    .select({ id: advisors.id, name: advisors.name })
    .from(advisors)
    .where(eq(advisors.id, id))
    .limit(1);

  return row ?? null;
}
