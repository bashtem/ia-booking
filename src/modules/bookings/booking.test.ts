import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BookingError,
  httpStatusForBookingError,
} from "./booking.errors.ts";

describe("booking errors", () => {
  it("maps missing records to 404 and slot conflicts to 409", () => {
    assert.equal(
      httpStatusForBookingError(
        new BookingError("advisor_not_found", "Advisor not found"),
      ),
      404,
    );
    assert.equal(
      httpStatusForBookingError(
        new BookingError("booking_not_found", "Booking not found"),
      ),
      404,
    );
    assert.equal(
      httpStatusForBookingError(
        new BookingError("slot_unavailable", "Slot is no longer available"),
      ),
      409,
    );
    assert.equal(
      httpStatusForBookingError(
        new BookingError("hold_expired", "Hold has expired"),
      ),
      409,
    );
    assert.equal(
      httpStatusForBookingError(new BookingError("invalid_request", "Candidate name is required")),
      400,
    );
  });
});
