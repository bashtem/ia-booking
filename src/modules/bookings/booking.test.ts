import { describe, expect, it } from "vitest";
import {
  BookingError,
  httpStatusForBookingError,
} from "./booking.errors.ts";

describe("booking errors", () => {
  it("maps missing records to 404 and slot conflicts to 409", () => {
    expect(
      httpStatusForBookingError(
        new BookingError("advisor_not_found", "Advisor not found"),
      ),
    ).toBe(404);
    expect(
      httpStatusForBookingError(
        new BookingError("booking_not_found", "Booking not found"),
      ),
    ).toBe(404);
    expect(
      httpStatusForBookingError(
        new BookingError("slot_unavailable", "Slot is no longer available"),
      ),
    ).toBe(409);
    expect(
      httpStatusForBookingError(
        new BookingError("hold_expired", "Hold has expired"),
      ),
    ).toBe(409);
    expect(
      httpStatusForBookingError(new BookingError("invalid_request", "Candidate name is required")),
    ).toBe(400);
  });
});
