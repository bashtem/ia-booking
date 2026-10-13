import { asc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.ts";
import { advisors, availabilityWindows } from "../../db/schema/index.ts";
import type { SlotWindow } from "../../shared/slots.ts";

export async function listWindows(
  db: Db,
  advisorId?: string,
): Promise<SlotWindow[]> {
  const query = db
    .select({
      id: availabilityWindows.id,
      advisorId: advisors.id,
      advisorName: advisors.name,
      startsAt: availabilityWindows.startsAt,
      endsAt: availabilityWindows.endsAt,
    })
    .from(availabilityWindows)
    .innerJoin(advisors, eq(availabilityWindows.advisorId, advisors.id));

  const filtered = advisorId ? query.where(eq(advisors.id, advisorId)) : query;

  return filtered.orderBy(asc(availabilityWindows.startsAt), asc(advisors.id));
}
