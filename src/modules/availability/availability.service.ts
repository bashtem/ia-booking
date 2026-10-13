import type { Database, Db } from "../../db/client.ts";
import { visaTypes, type VisaType } from "../../db/schema/index.ts";
import {
  deriveBookableSlots,
  type BookableSlot,
  type VisaDuration,
} from "../../shared/slots.ts";
import {
  expireElapsedHolds,
  listActiveBookings,
} from "../bookings/booking.repository.ts";
import { listWindows } from "./availability.repository.ts";
import type { AvailabilityQuery, AvailabilitySlot } from "./availability.types.ts";

const allVisaTypes: readonly VisaType[] = ["A", "B"];

function durationsFor(visas: readonly VisaType[]): VisaDuration<VisaType>[] {
  return visas.map((visaType) => ({
    visaType,
    durationMinutes: visaTypes[visaType].durationMinutes,
  }));
}

export async function listOfferedSlots(
  db: Db,
  query: AvailabilityQuery,
): Promise<BookableSlot<VisaType>[]> {
  const visas = query.visaType === undefined ? allVisaTypes : [query.visaType];
  const windows = await listWindows(db, query.advisorId);
  const busy = await listActiveBookings(db, query.advisorId);

  return deriveBookableSlots(windows, busy, durationsFor(visas));
}

export async function listBookableSlots(
  db: Database,
  query: AvailabilityQuery,
): Promise<AvailabilitySlot[]> {
  return db.transaction(async (tx) => {
    await expireElapsedHolds(tx);
    const slots = await listOfferedSlots(tx, query);

    return slots.map((slot) => ({
      advisorId: slot.advisorId,
      advisorName: slot.advisorName,
      visaType: slot.visaType,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    }));
  });
}
