import { describe, expect, it } from "vitest";
import { fail, ok, paginated } from "../src/shared/response.ts";

describe("response helper", () => {
  it("wraps a resource in a success body", () => {
    expect(ok({ id: "booking-uuid", status: "held" })).toEqual({
      success: true,
      data: { id: "booking-uuid", status: "held" },
    });
  });

  it("wraps a failure code and message", () => {
    expect(fail("slot_unavailable", "Slot is no longer available")).toEqual({
      success: false,
      error: {
        code: "slot_unavailable",
        message: "Slot is no longer available",
      },
    });
  });

  it("adds pagination for a list", () => {
    expect(
      paginated([{ id: "booking-uuid" }], { page: 1, limit: 20, total: 45 }),
    ).toEqual({
      success: true,
      data: [{ id: "booking-uuid" }],
      pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
    });
  });

  it("reports zero pages when nothing matches", () => {
    expect(paginated([], { page: 1, limit: 20, total: 0 })).toEqual({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
