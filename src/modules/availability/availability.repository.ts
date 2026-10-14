import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client.ts";
import { advisors, availabilityWindows, bookings } from "../../db/schema/index.ts";
import { BookingStatus } from "../../shared/booking-status.ts";
import type { BusyRange, SlotWindow } from "../../shared/slots.ts";

const holdIsOpen = sql`${bookings.holdExpiresAt} > clock_timestamp()`;

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

export async function listBusyRanges(
  db: Db,
  advisorId?: string,
): Promise<BusyRange[]> {
  const stillReserved = or(
    eq(bookings.status, BookingStatus.confirmed),
    and(eq(bookings.status, BookingStatus.held), holdIsOpen),
  );

  return db
    .select({
      advisorId: bookings.advisorId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(
      advisorId === undefined
        ? stillReserved
        : and(stillReserved, eq(bookings.advisorId, advisorId)),
    );
}
