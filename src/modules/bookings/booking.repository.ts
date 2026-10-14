import { and, asc, eq, gt, gte, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "../../db/client.ts";
import { advisors, availabilityWindows, bookings } from "../../db/schema/index.ts";
import type { Interval } from "../../shared/slots.ts";
import {
  BookingStatus,
  type BookingListRow,
  type BookingRow,
  type HeldBookingInput,
} from "./booking.types.ts";

const holdMinutes = 10;
const holdIsOpen = sql`${bookings.holdExpiresAt} > clock_timestamp()`;
const holdHasElapsed = sql`${bookings.holdExpiresAt} <= clock_timestamp()`;
const stillReserved = or(
  eq(bookings.status, BookingStatus.confirmed),
  and(eq(bookings.status, BookingStatus.held), holdIsOpen),
);

const bookingColumns = {
  id: bookings.id,
  advisorId: bookings.advisorId,
  advisorName: advisors.name,
  availabilityWindowId: bookings.availabilityWindowId,
  candidateName: bookings.candidateName,
  visaType: bookings.visaType,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  status: bookings.status,
  holdExpiresAt: bookings.holdExpiresAt,
  confirmedAt: bookings.confirmedAt,
};

export async function expireOverlappingElapsedHolds(
  db: Db,
  range: {
    advisorId: string;
    startsAt: Date;
    endsAt: Date;
  },
): Promise<void> {
  await db
    .update(bookings)
    .set({ status: BookingStatus.expired })
    .where(
      and(
        eq(bookings.advisorId, range.advisorId),
        eq(bookings.status, BookingStatus.held),
        holdHasElapsed,
        lt(bookings.startsAt, range.endsAt),
        gt(bookings.endsAt, range.startsAt),
      ),
    );
}

export async function listContainingWindows(
  db: Db,
  advisorId: string,
  slot: Interval,
): Promise<{ id: string; startsAt: Date }[]> {
  return db
    .select({
      id: availabilityWindows.id,
      startsAt: availabilityWindows.startsAt,
    })
    .from(availabilityWindows)
    .where(
      and(
        eq(availabilityWindows.advisorId, advisorId),
        lte(availabilityWindows.startsAt, slot.startsAt),
        gte(availabilityWindows.endsAt, slot.endsAt),
      ),
    )
    .orderBy(asc(availabilityWindows.startsAt));
}

export async function hasActiveOverlap(
  db: Db,
  range: Interval & { advisorId: string },
): Promise<boolean> {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        stillReserved,
        eq(bookings.advisorId, range.advisorId),
        lt(bookings.startsAt, range.endsAt),
        gt(bookings.endsAt, range.startsAt),
      ),
    )
    .limit(1);

  return row !== undefined;
}

export async function lockBookingById(
  db: Db,
  id: string,
): Promise<BookingListRow | undefined> {
  const [row] = await db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(advisors, eq(bookings.advisorId, advisors.id))
    .where(eq(bookings.id, id))
    .limit(1)
    .for("update", { of: bookings });

  return row;
}

export async function countBookingRows(
  db: Db,
  status?: BookingStatus,
): Promise<number> {
  const total = sql<number>`cast(count(*) as int)`;
  const query = db.select({ total }).from(bookings);
  const filtered =
    status === undefined ? query : query.where(eq(bookings.status, status));
  const [row] = await filtered;

  return row?.total ?? 0;
}

export async function listBookingRows(
  db: Db,
  query: {
    status?: BookingStatus;
    limit: number;
    offset: number;
  },
): Promise<BookingListRow[]> {
  const selection = db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(advisors, eq(bookings.advisorId, advisors.id));

  const filtered =
    query.status === undefined
      ? selection
      : selection.where(eq(bookings.status, query.status));

  return filtered
    .orderBy(asc(bookings.startsAt), asc(bookings.id))
    .limit(query.limit)
    .offset(query.offset);
}

export async function insertHeldBooking(
  db: Db,
  input: HeldBookingInput,
): Promise<BookingRow> {
  const [inserted] = await db
    .insert(bookings)
    .values({
      advisorId: input.advisorId,
      availabilityWindowId: input.availabilityWindowId,
      candidateName: input.candidateName,
      visaType: input.visaType,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: BookingStatus.held,
      holdExpiresAt: sql`clock_timestamp() + make_interval(mins => ${holdMinutes})`,
    })
    .returning();

  return inserted as BookingRow;
}

export async function confirmOpenHold(
  db: Db,
  id: string,
): Promise<BookingRow | undefined> {
  const [updated] = await db
    .update(bookings)
    .set({
      status: BookingStatus.confirmed,
      confirmedAt: sql`clock_timestamp()`,
    })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.status, BookingStatus.held),
        holdIsOpen,
      ),
    )
    .returning();

  return updated;
}

export async function markHoldExpired(db: Db, id: string): Promise<boolean> {
  const [updated] = await db
    .update(bookings)
    .set({ status: BookingStatus.expired })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.status, BookingStatus.held),
        holdHasElapsed,
      ),
    )
    .returning({ id: bookings.id });

  return updated !== undefined;
}
