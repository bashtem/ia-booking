import { beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { seedDatabase } from "../../src/db/seed.ts";
import { bookings } from "../../src/db/schema/index.ts";
import { testEnv, withApp } from "../../test/app.ts";

type Slot = {
  advisorId: string;
  visaType: string;
  startsAt: string;
  endsAt: string;
};

type Booking = {
  id: string;
  advisorId: string;
  availabilityWindowId: string;
  visaType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
  candidateName: string;
};

beforeAll(async () => {
  await seedDatabase(testEnv.DATABASE_URL);
});

async function withApi(
  run: (app: FastifyInstance) => Promise<void>,
): Promise<void> {
  await withApp(testEnv, async (app) => {
    await app.db.delete(bookings);
    await run(app);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSlot(value: unknown): value is Slot {
  return (
    isRecord(value) &&
    typeof value.advisorId === "string" &&
    typeof value.visaType === "string" &&
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string"
  );
}

function isBooking(value: unknown): value is Booking {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.advisorId === "string" &&
    typeof value.visaType === "string" &&
    typeof value.availabilityWindowId === "string" &&
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    typeof value.status === "string" &&
    (typeof value.holdExpiresAt === "string" || value.holdExpiresAt === null) &&
    (typeof value.confirmedAt === "string" || value.confirmedAt === null) &&
    typeof value.candidateName === "string"
  );
}

function readSlots(body: unknown): Slot[] {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    expect.fail("expected slot list");
  }

  const slots = body.data.filter(isSlot);
  expect(slots).toHaveLength(body.data.length);
  return slots;
}

function readBooking(body: unknown): Booking {
  if (!isRecord(body) || body.success !== true || !isBooking(body.data)) {
    expect.fail("expected booking");
  }

  return body.data;
}

function readBookings(body: unknown): Booking[] {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    expect.fail("expected booking list");
  }

  const rows = body.data.filter(isBooking);
  expect(rows).toHaveLength(body.data.length);
  return rows;
}

function readError(body: unknown): { code: string; message: string } {
  if (
    !isRecord(body) ||
    body.success !== false ||
    !isRecord(body.error) ||
    typeof body.error.code !== "string" ||
    typeof body.error.message !== "string"
  ) {
    expect.fail("expected error");
  }

  return { code: body.error.code, message: body.error.message };
}

function hasSlot(
  slots: readonly Slot[],
  advisorId: string,
  visaType: string,
  startsAt: string,
): boolean {
  return slots.some(
    (slot) =>
      slot.advisorId === advisorId &&
      slot.visaType === visaType &&
      slot.startsAt === startsAt,
  );
}

async function book(
  app: FastifyInstance,
  body: {
    candidateName: string;
    visaType: string;
    advisorId: string;
    startsAt: string;
  },
) {
  return app.inject({
    method: "POST",
    url: "/bookings",
    payload: body,
  });
}

describe("booking flow", () => {
  it("returns bookable slots and an empty list for an unknown advisor", async () => {
    await withApi(async (app) => {
      const response = await app.inject({ method: "GET", url: "/availability" });
      expect(response.statusCode).toBe(200);
      const slots = readSlots(response.json());

      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(true);
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T10:30:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-001", "A", "2026-11-11T14:00:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-002", "B", "2026-11-10T09:00:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-002", "A", "2026-11-10T09:33:00.000Z")).toBe(true);

      const filtered = await app.inject({
        method: "GET",
        url: "/availability?advisorId=missing&visaType=A",
      });
      expect(filtered.statusCode).toBe(200);
      expect(filtered.json()).toEqual({ success: true, data: [] });
    });
  });

  it("returns only the requested advisor and visa", async () => {
    await withApi(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/availability?advisorId=ia-001&visaType=A",
      });
      expect(response.statusCode).toBe(200);
      const slots = readSlots(response.json());

      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(true);
      expect(slots.every((slot) => slot.advisorId === "ia-001" && slot.visaType === "A")).toBe(
        true,
      );
    });
  });

  it("holds a chosen slot for about 10 minutes and blocks an overlapping request", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T10:00:00+01:00",
      });
      expect(created.statusCode).toBe(200);
      const booking = readBooking(created.json());
      expect(booking.startsAt).toBe("2026-11-10T09:00:00.000Z");
      expect(booking.endsAt).toBe("2026-11-10T09:30:00.000Z");
      expect(booking.status).toBe("held");
      expect(booking.confirmedAt).toBeNull();
      expect(booking.availabilityWindowId.length).toBeGreaterThan(0);
      if (booking.holdExpiresAt === null) {
        expect.fail("expected hold expiry");
      }
      const remaining = new Date(booking.holdExpiresAt).getTime() - Date.now();
      expect(remaining).toBeGreaterThan(8 * 60_000);
      expect(remaining).toBeLessThan(12 * 60_000);

      const hidden = await app.inject({
        method: "GET",
        url: "/availability?advisorId=ia-001&visaType=A",
      });
      const slots = readSlots(hidden.json());
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z")).toBe(true);

      const overlap = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "B",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(overlap.statusCode).toBe(409);
      expect(readError(overlap.json()).code).toBe("slot_unavailable");

      const otherAdvisor = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "A",
        advisorId: "ia-002",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(otherAdvisor.statusCode).toBe(200);
      expect(readBooking(otherAdvisor.json()).endsAt).toBe("2026-11-10T09:30:00.000Z");
    });
  });

  it("rebooks an elapsed hold and leaves unrelated lapsed holds in place", async () => {
    await withApi(async (app) => {
      const blocked = readBooking(
        (
          await book(app, {
            candidateName: "Ada Lovelace",
            visaType: "A",
            advisorId: "ia-001",
            startsAt: "2026-11-10T09:00:00.000Z",
          })
        ).json(),
      );
      const later = readBooking(
        (
          await book(app, {
            candidateName: "Grace Hopper",
            visaType: "A",
            advisorId: "ia-001",
            startsAt: "2026-11-10T09:30:00.000Z",
          })
        ).json(),
      );
      const otherAdvisor = readBooking(
        (
          await book(app, {
            candidateName: "Katherine Johnson",
            visaType: "A",
            advisorId: "ia-002",
            startsAt: "2026-11-10T09:00:00.000Z",
          })
        ).json(),
      );

      await app.db
        .update(bookings)
        .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
        .where(inArray(bookings.id, [blocked.id, later.id, otherAdvisor.id]));

      const replacement = await book(app, {
        candidateName: "Margaret Hamilton",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(replacement.statusCode).toBe(200);
      expect(readBooking(replacement.json()).status).toBe("held");

      const rows = await app.db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings);
      const statusOf = (id: string) => rows.find((row) => row.id === id)?.status;

      expect(statusOf(blocked.id)).toBe("expired");
      expect(statusOf(later.id)).toBe("held");
      expect(statusOf(otherAdvisor.id)).toBe("held");
    });
  });

  it("rejects an off-grid start, a short window, a blank name, and an unknown advisor", async () => {
    await withApi(async (app) => {
      const offGrid = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:07:00.000Z",
      });
      expect(offGrid.statusCode).toBe(409);
      expect(readError(offGrid.json()).code).toBe("slot_unavailable");

      const shortWindow = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-11T14:00:00.000Z",
      });
      expect(shortWindow.statusCode).toBe(409);
      expect(readError(shortWindow.json()).code).toBe("slot_unavailable");

      const blank = await book(app, {
        candidateName: "   ",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(blank.statusCode).toBe(400);
      expect(readError(blank.json()).code).toBe("invalid_request");

      const missingAdvisor = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "missing",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(missingAdvisor.statusCode).toBe(404);
      expect(readError(missingAdvisor.json()).code).toBe("advisor_not_found");
    });
  });

  it("confirms a live hold and keeps the slot out of availability", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "B",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      const booking = readBooking(created.json());
      expect(booking.endsAt).toBe("2026-11-10T10:00:00.000Z");

      const confirmed = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      expect(confirmed.statusCode).toBe(200);
      const confirmedBooking = readBooking(confirmed.json());
      expect(confirmedBooking.status).toBe("confirmed");
      expect(confirmedBooking.confirmedAt).toEqual(expect.any(String));

      const again = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      expect(again.statusCode).toBe(200);
      expect(readBooking(again.json()).id).toBe(booking.id);

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z")).toBe(false);
    });
  });

  it("keeps a confirmed booking after the hold deadline and rejects a second request", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      const booking = readBooking(created.json());
      const confirmed = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      expect(confirmed.statusCode).toBe(200);

      await app.db
        .update(bookings)
        .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(bookings.id, booking.id));

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(false);
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z")).toBe(true);

      const overlap = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(overlap.statusCode).toBe(409);
      expect(readError(overlap.json()).code).toBe("slot_unavailable");
    });
  });

  it("releases an elapsed hold and lists it as expired", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      const booking = readBooking(created.json());
      await app.db
        .update(bookings)
        .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(bookings.id, booking.id));

      const confirm = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      expect(confirm.statusCode).toBe(409);
      expect(readError(confirm.json()).code).toBe("hold_expired");

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z")).toBe(true);

      const listed = await app.inject({
        method: "GET",
        url: "/bookings?status=expired",
      });
      expect(listed.statusCode).toBe(200);
      const listedBody: unknown = listed.json();
      const rows = readBookings(listedBody);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("expired");
      if (!isRecord(listedBody)) {
        expect.fail("expected booking list");
      }
      expect(listedBody.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });

      const held = await app.inject({
        method: "GET",
        url: "/bookings?status=held",
      });
      expect(held.json()).toEqual({
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const badPage = await app.inject({
        method: "GET",
        url: "/bookings?page=0",
      });
      expect(badPage.statusCode).toBe(400);
      expect(readError(badPage.json()).code).toBe("invalid_request");
    });
  });

  it("returns 404 when the booking id does not exist", async () => {
    await withApi(async (app) => {
      const confirm = await app.inject({
        method: "POST",
        url: "/bookings/00000000-0000-4000-8000-000000000000/confirm",
      });
      expect(confirm.statusCode).toBe(404);
      expect(readError(confirm.json()).code).toBe("booking_not_found");
    });
  });

  it("returns hold_expired for a rebooked elapsed hold and not_held for a cancelled booking", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      const booking = readBooking(created.json());
      await app.db
        .update(bookings)
        .set({ holdExpiresAt: new Date(Date.now() - 60_000) })
        .where(eq(bookings.id, booking.id));

      const replacement = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      expect(replacement.statusCode).toBe(200);

      const taken = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      expect(taken.statusCode).toBe(409);
      expect(readError(taken.json()).code).toBe("hold_expired");

      const cancelled = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:30:00.000Z",
      });
      const cancelledBooking = readBooking(cancelled.json());
      await app.db
        .update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, cancelledBooking.id));

      const confirmCancelled = await app.inject({
        method: "POST",
        url: `/bookings/${cancelledBooking.id}/confirm`,
      });
      expect(confirmCancelled.statusCode).toBe(409);
      expect(readError(confirmCancelled.json()).code).toBe("not_held");
    });
  });

  it("frees a slot when the booking is cancelled", async () => {
    await withApi(async (app) => {
      const created = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:30:00.000Z",
      });
      const booking = readBooking(created.json());
      await app.db
        .update(bookings)
        .set({ status: "cancelled" })
        .where(eq(bookings.id, booking.id));

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      expect(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z")).toBe(true);

      const replacement = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:30:00.000Z",
      });
      expect(replacement.statusCode).toBe(200);
      expect(readBooking(replacement.json()).status).toBe("held");
    });
  });
});
