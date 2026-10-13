import type { Database } from "../../db/client.ts";
import { visaTypes } from "../../shared/visa-types.ts";
import { BookingError } from "./booking.errors.ts";
import { findAdvisorById } from "../advisors/advisor.repository.ts";
import { listOfferedSlots } from "../availability/availability.service.ts";
import {
  confirmOpenHold,
  countBookingRows,
  expireOverlappingElapsedHolds,
  insertHeldBooking,
  listBookingRows,
  lockBookingById,
  markHoldExpired,
} from "./booking.repository.ts";
import {
  BookingStatus,
  type BookingRow,
  type BookingView,
  type CreateBookingInput,
  type ListBookingsQuery,
} from "./booking.types.ts";

const slotUnavailable = "Slot is no longer available";

function toView(row: BookingRow, advisorName: string): BookingView {
  return {
    id: row.id,
    advisorId: row.advisorId,
    advisorName,
    availabilityWindowId: row.availabilityWindowId,
    candidateName: row.candidateName,
    visaType: row.visaType,
    visaLabel: visaTypes[row.visaType].label,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: row.status,
    holdExpiresAt:
      row.holdExpiresAt === null ? null : row.holdExpiresAt.toISOString(),
    confirmedAt:
      row.confirmedAt === null ? null : row.confirmedAt.toISOString(),
  };
}

function isSlotConstraint(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;
  const code =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string"
      ? cause.code
      : undefined;

  return code === "23P01" || code === "23514";
}

export async function createBooking(
  db: Database,
  input: CreateBookingInput,
): Promise<BookingView> {
  return db.transaction(async (tx) => {
    const advisor = await findAdvisorById(tx, input.advisorId);

    if (!advisor)
      throw new BookingError("advisor_not_found", "Advisor not found");

    const offered = await listOfferedSlots(tx, {
      advisorId: input.advisorId,
      visaType: input.visaType,
    });

    const slot = offered.find(
      (item) => item.startsAt.getTime() === input.startsAt.getTime(),
    );

    if (!slot) throw new BookingError("slot_unavailable", slotUnavailable);

    await expireOverlappingElapsedHolds(tx, {
      advisorId: input.advisorId,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
    });

    try {
      const row = await insertHeldBooking(tx, {
        advisorId: input.advisorId,
        availabilityWindowId: slot.id,
        candidateName: input.candidateName,
        visaType: input.visaType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      return toView(row, advisor.name);
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
  const outcome = await db.transaction(async (tx) => {
    const existing = await lockBookingById(tx, id);

    if (!existing)
      return new BookingError("booking_not_found", "Booking not found");

    if (existing.status === BookingStatus.confirmed)
      return toView(existing, existing.advisorName);

    if (existing.status === BookingStatus.held) {
      const confirmed = await confirmOpenHold(tx, existing.id);

      if (confirmed) return toView(confirmed, existing.advisorName);

      const expired = await markHoldExpired(tx, existing.id);

      if (!expired)
        return new BookingError("not_held", "Booking cannot be confirmed");

      return new BookingError("hold_expired", "Hold has expired");
    }

    if (existing.status === BookingStatus.expired)
      return new BookingError("hold_expired", "Hold has expired");

    return new BookingError("not_held", "Booking cannot be confirmed");
  });

  if (outcome instanceof BookingError) throw outcome;

  return outcome;
}

export async function listBookings(
  db: Database,
  query: ListBookingsQuery,
): Promise<{ bookings: BookingView[]; total: number }> {
  return db.transaction(async (tx) => {
    const total = await countBookingRows(tx, query.status);
    const rows = await listBookingRows(tx, {
      status: query.status,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });

    return { bookings: rows.map((row) => toView(row, row.advisorName)), total };
  });
}
