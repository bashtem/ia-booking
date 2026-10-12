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
  assert.ok(isRecord(body) && Array.isArray(body.slots));
  const slots = body.slots.filter(isSlot);
  assert.equal(slots.length, body.slots.length);
  return slots;
}

function readBooking(body: unknown): Booking {
  assert.ok(isBooking(body));
  return body;
}

function readBookings(body: unknown): Booking[] {
  assert.ok(isRecord(body) && Array.isArray(body.bookings));
  const rows = body.bookings.filter(isBooking);
  assert.equal(rows.length, body.bookings.length);
  return rows;
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
      assert.deepEqual(filtered.json(), { slots: [] });
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

      const shortWindow = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-11T14:00:00.000Z",
      });
      assert.equal(shortWindow.statusCode, 409);

      const blank = await book(app, {
        candidateName: "   ",
        visaType: "A",
        advisorId: "ia-001",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(blank.statusCode, 400);

      const missingAdvisor = await book(app, {
        candidateName: "Ada Lovelace",
        visaType: "A",
        advisorId: "missing",
        startsAt: "2026-11-10T09:00:00.000Z",
      });
      assert.equal(missingAdvisor.statusCode, 404);
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
      const rows = readBookings(listed.json());
      assert.equal(rows.length, 1);
      assert.equal(rows[0]?.status, "expired");

      const held = await app.inject({
        method: "GET",
        url: "/bookings?status=held",
      });
      assert.deepEqual(held.json(), { bookings: [] });
    });
  });
});
