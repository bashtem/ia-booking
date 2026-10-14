import type { Database, Db } from "../../db/client.ts";
import { visaTypeList, visaTypes, type VisaType } from "../../shared/visa-types.ts";
import {
  deriveBookableSlots,
  type BookableSlot,
  type VisaDuration,
} from "../../shared/slots.ts";
import { listBusyRanges, listWindows } from "./availability.repository.ts";
import type { AvailabilityQuery, AvailabilitySlot } from "./availability.types.ts";

function durationsFor(visas: readonly VisaType[]): VisaDuration<VisaType>[] {
  return visas.map((visaType) => ({
    visaType,
    durationMinutes: visaTypes[visaType].durationMinutes,
  }));
}

async function listOfferedSlots(
  db: Db,
  query: AvailabilityQuery,
): Promise<BookableSlot<VisaType>[]> {
  const visas = query.visaType === undefined ? visaTypeList : [query.visaType];
  const windows = await listWindows(db, query.advisorId);
  const busy = await listBusyRanges(db, query.advisorId);

  return deriveBookableSlots(windows, busy, durationsFor(visas));
}

export async function listBookableSlots(
  db: Database,
  query: AvailabilityQuery,
): Promise<AvailabilitySlot[]> {
  const slots = await listOfferedSlots(db, query);

  return slots.map((slot) => ({
    advisorId: slot.advisorId,
    advisorName: slot.advisorName,
    visaType: slot.visaType,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
  }));
}
