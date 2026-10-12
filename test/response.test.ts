import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fail, ok, paginated } from "../src/shared/response.ts";

describe("response helper", () => {
  it("wraps a resource in a success body", () => {
    assert.deepEqual(ok({ id: "booking-uuid", status: "held" }), {
      success: true,
      data: { id: "booking-uuid", status: "held" },
    });
  });

  it("wraps a failure code and message", () => {
    assert.deepEqual(fail("slot_unavailable", "Slot is no longer available"), {
      success: false,
      error: {
        code: "slot_unavailable",
        message: "Slot is no longer available",
      },
    });
  });

  it("adds pagination for a list", () => {
    assert.deepEqual(
      paginated([{ id: "booking-uuid" }], { page: 1, limit: 20, total: 45 }),
      {
        success: true,
        data: [{ id: "booking-uuid" }],
        pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
      },
    );
  });

  it("reports zero pages when nothing matches", () => {
    assert.deepEqual(paginated([], { page: 1, limit: 20, total: 0 }), {
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
