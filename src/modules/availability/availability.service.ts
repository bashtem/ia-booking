import type { Database } from "../../db/client.ts";
import { visaTypes, type VisaType } from "../../db/schema/index.ts";
import { deriveBookableSlots, type VisaDuration } from "../../shared/time.ts";
import {
  expireElapsedHolds,
  listActiveBookings,
} from "../bookings/booking.repository.ts";
import { listWindows } from "./availability.repository.ts";

export type AvailabilityQuery = {
  visaType?: VisaType;
  advisorId?: string;
};

export type AvailabilitySlot = {
  advisorId: string;
  advisorName: string;
  visaType: VisaType;
  startsAt: string;
  endsAt: string;
};

const allVisaTypes: readonly VisaType[] = ["A", "B"];

function durationsFor(visas: readonly VisaType[]): VisaDuration<VisaType>[] {
  return visas.map((visaType) => ({
    visaType,
    durationMinutes: visaTypes[visaType].durationMinutes,
  }));
}

export async function listBookableSlots(
  db: Database,
  query: AvailabilityQuery,
): Promise<AvailabilitySlot[]> {
  const visas = query.visaType === undefined ? allVisaTypes : [query.visaType];

  return db.transaction(async (tx) => {
    await expireElapsedHolds(tx);
    const windows = await listWindows(tx, query.advisorId);
    const busy = await listActiveBookings(tx, query.advisorId);
    const slots = deriveBookableSlots(windows, busy, durationsFor(visas));

    return slots.map((slot) => ({
      advisorId: slot.advisorId,
      advisorName: slot.advisorName,
      visaType: slot.visaType,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    }));
  });
}
