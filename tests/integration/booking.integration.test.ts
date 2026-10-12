import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
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
  visaType: string;
  startsAt: string;
  endsAt: string;
  status: string;
  heldUntil: string | null;
  candidateName: string;
};

before(async () => {
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
    typeof value.startsAt === "string" &&
    typeof value.endsAt === "string" &&
    typeof value.status === "string" &&
    (typeof value.heldUntil === "string" || value.heldUntil === null) &&
    typeof value.candidateName === "string"
  );
}

function readSlots(body: unknown): Slot[] {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    assert.fail("expected slot list");
  }

  const slots = body.data.filter(isSlot);
  assert.equal(slots.length, body.data.length);
  return slots;
}

function readBooking(body: unknown): Booking {
  if (!isRecord(body) || body.success !== true || !isBooking(body.data)) {
    assert.fail("expected booking");
  }

  return body.data;
}

function readBookings(body: unknown): Booking[] {
  if (!isRecord(body) || body.success !== true || !Array.isArray(body.data)) {
    assert.fail("expected booking list");
  }

  const rows = body.data.filter(isBooking);
  assert.equal(rows.length, body.data.length);
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
    assert.fail("expected error");
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
      assert.equal(response.statusCode, 200);
      const slots = readSlots(response.json());

      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z"), true);
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T10:30:00.000Z"), false);
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-11T14:00:00.000Z"), false);
      assert.equal(hasSlot(slots, "ia-002", "B", "2026-11-10T09:00:00.000Z"), false);
      assert.equal(hasSlot(slots, "ia-002", "A", "2026-11-10T09:33:00.000Z"), true);

      const filtered = await app.inject({
        method: "GET",
        url: "/availability?advisorId=missing&visaType=A",
      });
      assert.equal(filtered.statusCode, 200);
      assert.deepEqual(filtered.json(), { success: true, data: [] });
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
      assert.equal(created.statusCode, 200);
      const booking = readBooking(created.json());
      assert.equal(booking.startsAt, "2026-11-10T09:00:00.000Z");
      assert.equal(booking.endsAt, "2026-11-10T09:30:00.000Z");
      assert.equal(booking.status, "held");
      assert.ok(booking.heldUntil !== null);
      const remaining = new Date(booking.heldUntil).getTime() - Date.now();
      assert.ok(remaining > 8 * 60_000 && remaining < 12 * 60_000);

      const hidden = await app.inject({
        method: "GET",
        url: "/availability?advisorId=ia-001&visaType=A",
      });
      const slots = readSlots(hidden.json());
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z"), false);
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z"), true);

      const overlap = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "B",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(overlap.statusCode, 409);
      assert.equal(readError(overlap.json()).code, "slot_unavailable");

      const otherAdvisor = await book(app, {
        candidateName: "Grace Hopper",
        visaType: "A",
        advisorId: "ia-002",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(otherAdvisor.statusCode, 200);
      assert.equal(readBooking(otherAdvisor.json()).endsAt, "2026-11-10T09:30:00.000Z");
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
      assert.equal(offGrid.statusCode, 409);
      assert.equal(readError(offGrid.json()).code, "slot_unavailable");

      const shortWindow = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-11T14:00:00.000Z",
      });
      assert.equal(shortWindow.statusCode, 409);
      assert.equal(readError(shortWindow.json()).code, "slot_unavailable");

      const blank = await book(app, {
        candidateName: "   ",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(blank.statusCode, 400);
      assert.equal(readError(blank.json()).code, "invalid_request");

      const missingAdvisor = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "missing",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(missingAdvisor.statusCode, 404);
      assert.equal(readError(missingAdvisor.json()).code, "advisor_not_found");
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
      assert.equal(booking.endsAt, "2026-11-10T10:00:00.000Z");

      const confirmed = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      assert.equal(confirmed.statusCode, 200);
      assert.equal(readBooking(confirmed.json()).status, "confirmed");

      const again = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      assert.equal(again.statusCode, 200);
      assert.equal(readBooking(again.json()).id, booking.id);

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z"), false);
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:30:00.000Z"), false);
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
        .set({ heldUntil: new Date(Date.now() - 60_000) })
        .where(eq(bookings.id, booking.id));

      const confirm = await app.inject({
        method: "POST",
        url: `/bookings/${booking.id}/confirm`,
      });
      assert.equal(confirm.statusCode, 409);
      assert.equal(readError(confirm.json()).code, "hold_expired");

      const slots = readSlots(
        (
          await app.inject({
            method: "GET",
            url: "/availability?advisorId=ia-001&visaType=A",
          })
        ).json(),
      );
      assert.equal(hasSlot(slots, "ia-001", "A", "2026-11-10T09:00:00.000Z"), true);

      const listed = await app.inject({
        method: "GET",
        url: "/bookings?status=expired",
      });
      assert.equal(listed.statusCode, 200);
      const listedBody: unknown = listed.json();
      const rows = readBookings(listedBody);
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, "expired");
      assert.ok(isRecord(listedBody));
      assert.deepEqual(listedBody.pagination, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });

      const held = await app.inject({
        method: "GET",
        url: "/bookings?status=held",
      });
      assert.deepEqual(held.json(), {
        success: true,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const badPage = await app.inject({
        method: "GET",
        url: "/bookings?page=0",
      });
      assert.equal(badPage.statusCode, 400);
      assert.equal(readError(badPage.json()).code, "invalid_request");
    });
  });
});
