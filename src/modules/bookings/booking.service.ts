import type { Database } from "../../db/client.ts";
import { visaTypes } from "../../db/schema/index.ts";
import { BookingError } from "../../shared/errors.ts";
import { deriveBookableSlots } from "../../shared/time.ts";
import { findAdvisorById } from "../advisors/advisor.repository.ts";
import { listWindows } from "../availability/availability.repository.ts";
import {
  confirmOpenHold,
  expireElapsedHolds,
  findBookingById,
  insertHeldBooking,
  listActiveBookings,
  listBookingRows,
  markHoldExpired,
  type BookingRow,
} from "./booking.repository.ts";
import type {
  BookingView,
  CreateBookingInput,
  ListBookingsQuery,
} from "./booking.types.ts";

const slotUnavailable = "Slot is no longer available";

function toView(row: BookingRow): BookingView {
  return {
    id: row.id,
    advisorId: row.advisorId,
    advisorName: row.advisorName,
    candidateName: row.candidateName,
    visaType: row.visaType,
    visaLabel: visaTypes[row.visaType].label,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    heldUntil: row.heldUntil === null ? null : row.heldUntil.toISOString(),
  };
}

function postgresCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if ("cause" in error) {
    return postgresCode(error.cause);
  }

  return undefined;
}

function isSlotConstraint(error: unknown): boolean {
  const code = postgresCode(error);
  return code === "23P01" || code === "23514";
}

export async function createBooking(
  db: Database,
  input: CreateBookingInput,
): Promise<BookingView> {
  const candidateName = input.candidateName.trim();

  if (candidateName.length === 0) {
    throw new BookingError("invalid_request", "Candidate name is required");
  }

  await db.transaction(async (tx) => {
    await expireElapsedHolds(tx);
  });

  return db.transaction(async (tx) => {
    const advisor = await findAdvisorById(tx, input.advisorId);

    if (advisor === null) {
      throw new BookingError("advisor_not_found", "Advisor not found");
    }

    const windows = await listWindows(tx, input.advisorId);
    const busy = await listActiveBookings(tx, input.advisorId);
    const offered = deriveBookableSlots(windows, busy, [
      {
        visaType: input.visaType,
        durationMinutes: visaTypes[input.visaType].durationMinutes,
      },
    ]);
    const slot = offered.find(
      (item) => item.startsAt.getTime() === input.startsAt.getTime(),
    );

    if (slot === undefined) {
      throw new BookingError("slot_unavailable", slotUnavailable);
    }

    try {
      const row = await insertHeldBooking(tx, {
        advisorId: input.advisorId,
        candidateName,
        visaType: input.visaType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      return toView(row);
    } catch (error) {
      if (isSlotConstraint(error)) {
        throw new BookingError("slot_unavailable", slotUnavailable);
      }

      throw error;
    }
  });
}

export async function confirmBooking(
  db: Database,
  id: string,
): Promise<BookingView> {
  await db.transaction(async (tx) => {
    await expireElapsedHolds(tx);
  });

  const outcome = await db.transaction(async (tx) => {
    const confirmed = await confirmOpenHold(tx, id);

    if (confirmed !== null) {
      return { kind: "view" as const, view: toView(confirmed) };
    }

    const existing = await findBookingById(tx, id);

    if (existing === null) {
      return { kind: "missing" as const };
    }

    if (existing.status === "confirmed") {
      return { kind: "view" as const, view: toView(existing) };
    }

    if (existing.status === "held") {
      await markHoldExpired(tx, id);
    }

    if (existing.status === "held" || existing.status === "expired") {
      return { kind: "expired" as const };
    }

    return { kind: "not_held" as const };
  });

  if (outcome.kind === "view") {
    return outcome.view;
  }

  if (outcome.kind === "missing") {
    throw new BookingError("booking_not_found", "Booking not found");
  }

  if (outcome.kind === "expired") {
    throw new BookingError("hold_expired", "Hold has expired");
  }

  throw new BookingError("not_held", "Booking cannot be confirmed");
}

export async function listBookings(
  db: Database,
  query: ListBookingsQuery,
): Promise<BookingView[]> {
  return db.transaction(async (tx) => {
    await expireElapsedHolds(tx);
    const rows = await listBookingRows(tx, query.status);
    return rows.map(toView);
  });
}
