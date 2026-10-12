import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../db/client.ts";
import {
  advisors,
  bookings,
  type BookingStatus,
  type VisaType,
} from "../../db/schema/index.ts";
import { holdMinutes } from "../../shared/time.ts";
import type { BusyRange } from "../../shared/time.ts";

export type BookingRow = {
  id: string;
  advisorId: string;
  advisorName: string;
  candidateName: string;
  visaType: VisaType;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  heldUntil: Date | null;
};

const bookingColumns = {
  id: bookings.id,
  advisorId: bookings.advisorId,
  advisorName: advisors.name,
  candidateName: bookings.candidateName,
  visaType: bookings.visaType,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  status: bookings.status,
  heldUntil: bookings.heldUntil,
};

export async function expireElapsedHolds(db: Db): Promise<void> {
  await db
    .update(bookings)
    .set({ status: "expired" })
    .where(
      and(eq(bookings.status, "held"), sql`${bookings.heldUntil} <= now()`),
    );
}

export async function listActiveBookings(
  db: Db,
  advisorId?: string,
): Promise<BusyRange[]> {
  const conditions = [inArray(bookings.status, ["held", "confirmed"])];

  if (advisorId !== undefined) {
    conditions.push(eq(bookings.advisorId, advisorId));
  }

  return db
    .select({
      advisorId: bookings.advisorId,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
    })
    .from(bookings)
    .where(and(...conditions));
}

export async function findBookingById(
  db: Db,
  id: string,
): Promise<BookingRow | null> {
  const [row] = await db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(advisors, eq(bookings.advisorId, advisors.id))
    .where(eq(bookings.id, id))
    .limit(1);

  return row ?? null;
}

export async function listBookingRows(
  db: Db,
  status?: BookingStatus,
): Promise<BookingRow[]> {
  const query = db
    .select(bookingColumns)
    .from(bookings)
    .innerJoin(advisors, eq(bookings.advisorId, advisors.id));

  const filtered =
    status === undefined ? query : query.where(eq(bookings.status, status));

  return filtered.orderBy(asc(bookings.startsAt), asc(bookings.id));
}

export async function insertHeldBooking(
  db: Db,
  input: {
    advisorId: string;
    candidateName: string;
    visaType: VisaType;
    startsAt: Date;
    endsAt: Date;
  },
): Promise<BookingRow> {
  const [inserted] = await db
    .insert(bookings)
    .values({
      advisorId: input.advisorId,
      candidateName: input.candidateName,
      visaType: input.visaType,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "held",
      heldUntil: sql`now() + make_interval(mins => ${holdMinutes})`,
    })
    .returning({ id: bookings.id });

  if (inserted === undefined) {
    throw new Error("Insert did not return a booking id");
  }

  const row = await findBookingById(db, inserted.id);

  if (row === null) {
    throw new Error("Inserted booking could not be loaded");
  }

  return row;
}

export async function confirmOpenHold(
  db: Db,
  id: string,
): Promise<BookingRow | null> {
  const [updated] = await db
    .update(bookings)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.status, "held"),
        sql`${bookings.heldUntil} > now()`,
      ),
    )
    .returning({ id: bookings.id });

  if (updated === undefined) {
    return null;
  }

  return findBookingById(db, updated.id);
}

export async function markHoldExpired(db: Db, id: string): Promise<void> {
  await db
    .update(bookings)
    .set({ status: "expired" })
    .where(and(eq(bookings.id, id), eq(bookings.status, "held")));
}
