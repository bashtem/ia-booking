import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveBookableSlots,
  parseInstant,
  type BookableSlot,
  type BusyRange,
  type SlotWindow,
  type VisaDuration,
} from "../../shared/slots.ts";

const visas: readonly VisaDuration[] = [
  { visaType: "A", durationMinutes: 30 },
  { visaType: "B", durationMinutes: 60 },
];

function at(value: string): Date {
  return new Date(value);
}

function window(
  advisorId: string,
  advisorName: string,
  start: string,
  end: string,
): SlotWindow {
  return {
    id: `${advisorId}:${start}`,
    advisorId,
    advisorName,
    startsAt: at(start),
    endsAt: at(end),
  };
}

function starts(
  slots: readonly BookableSlot[],
  advisorId: string,
  visaType: string,
): string[] {
  return slots
    .filter((slot) => slot.advisorId === advisorId && slot.visaType === visaType)
    .map((slot) => slot.startsAt.toISOString());
}

const sofia = window(
  "ia-001",
  "Sofia Andersson",
  "2026-11-10T09:00:00Z",
  "2026-11-10T10:50:00Z",
);
const sofiaShort = window(
  "ia-001",
  "Sofia Andersson",
  "2026-11-11T14:00:00Z",
  "2026-11-11T14:20:00Z",
);
const rajanExact = window(
  "ia-002",
  "Rajan Patel",
  "2026-11-10T09:00:00Z",
  "2026-11-10T09:30:00Z",
);
const rajanLater = window(
  "ia-002",
  "Rajan Patel",
  "2026-11-10T09:33:00Z",
  "2026-11-10T11:30:00Z",
);
const rajanTiny = window(
  "ia-002",
  "Rajan Patel",
  "2026-11-18T14:00:00Z",
  "2026-11-18T14:25:00Z",
);

describe("deriveBookableSlots", () => {
  const slots = deriveBookableSlots(
    [sofia, sofiaShort, rajanExact, rajanLater, rajanTiny],
    [],
    visas,
  );

  it("steps 30 minutes from each window and keeps a slot that ends on the window end", () => {
    assert.deepEqual(starts(slots, "ia-001", "A"), [
      "2026-11-10T09:00:00.000Z",
      "2026-11-10T09:30:00.000Z",
      "2026-11-10T10:00:00.000Z",
    ]);
    assert.deepEqual(starts(slots, "ia-001", "B"), [
      "2026-11-10T09:00:00.000Z",
      "2026-11-10T09:30:00.000Z",
    ]);
    assert.deepEqual(starts(slots, "ia-002", "A"), [
      "2026-11-10T09:00:00.000Z",
      "2026-11-10T09:33:00.000Z",
      "2026-11-10T10:03:00.000Z",
      "2026-11-10T10:33:00.000Z",
    ]);
    assert.deepEqual(starts(slots, "ia-002", "B"), [
      "2026-11-10T09:33:00.000Z",
      "2026-11-10T10:03:00.000Z",
    ]);
  });

  it("drops windows that cannot hold the appointment", () => {
    assert.equal(
      slots.some((slot) => slot.startsAt.getTime() === at("2026-11-11T14:00:00Z").getTime()),
      false,
    );
    assert.equal(
      slots.some((slot) => slot.startsAt.getTime() === at("2026-11-18T14:00:00Z").getTime()),
      false,
    );
  });

  it("does not build a slot across the three-minute gap", () => {
    assert.equal(
      slots.some(
        (slot) =>
          slot.advisorId === "ia-002" &&
          slot.startsAt.getTime() === at("2026-11-10T09:00:00Z").getTime() &&
          slot.endsAt.getTime() === at("2026-11-10T10:00:00Z").getTime(),
      ),
      false,
    );
  });

  it("sorts by start, advisor, then visa", () => {
    assert.deepEqual(
      slots.slice(0, 3).map((slot) => `${slot.advisorId}:${slot.visaType}`),
      ["ia-001:A", "ia-001:B", "ia-002:A"],
    );
  });

  it("removes every overlapping slot for that advisor and keeps the next adjacent one", () => {
    const busy: BusyRange[] = [
      {
        advisorId: "ia-001",
        startsAt: at("2026-11-10T09:00:00Z"),
        endsAt: at("2026-11-10T09:30:00Z"),
      },
    ];
    const remaining = deriveBookableSlots([sofia, rajanExact], busy, visas);

    assert.deepEqual(starts(remaining, "ia-001", "A"), [
      "2026-11-10T09:30:00.000Z",
      "2026-11-10T10:00:00.000Z",
    ]);
    assert.deepEqual(starts(remaining, "ia-001", "B"), [
      "2026-11-10T09:30:00.000Z",
    ]);
    assert.deepEqual(starts(remaining, "ia-002", "A"), [
      "2026-11-10T09:00:00.000Z",
    ]);
  });

  it("keeps a total order when the same start, advisor, and visa appear twice", () => {
    const duplicated = deriveBookableSlots([rajanExact, rajanExact], [], visas);

    assert.deepEqual(
      duplicated.map((slot) => `${slot.advisorId}:${slot.visaType}:${slot.startsAt.toISOString()}`),
      ["ia-002:A:2026-11-10T09:00:00.000Z", "ia-002:A:2026-11-10T09:00:00.000Z"],
    );
  });
});

describe("parseInstant", () => {
  it("accepts a timestamp with Z or a numeric offset", () => {
    assert.equal(parseInstant("2026-11-10T09:00:00Z")?.toISOString(), "2026-11-10T09:00:00.000Z");
    assert.equal(
      parseInstant("2026-11-10T10:00:00+01:00")?.toISOString(),
      "2026-11-10T09:00:00.000Z",
    );
  });

  it("rejects a date and a timestamp with no timezone", () => {
    assert.equal(parseInstant("2026-11-10"), undefined);
    assert.equal(parseInstant("2026-11-10T09:00:00"), undefined);
  });
});
