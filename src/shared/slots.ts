export const slotStepMinutes = 30;

export type Interval = {
  startsAt: Date;
  endsAt: Date;
};

export type SlotWindow = Interval & {
  id: string;
  advisorId: string;
  advisorName: string;
};

export type BusyRange = Interval & {
  advisorId: string;
};

export type VisaDuration<Visa extends string = string> = {
  visaType: Visa;
  durationMinutes: number;
};

export type BookableSlot<Visa extends string = string> = SlotWindow & {
  visaType: Visa;
};

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

export function parseInstant(value: string): Date | undefined {
  if (!value.includes("T") || !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value)) {
    return undefined;
  }

  const instant = new Date(value);

  if (Number.isNaN(instant.getTime())) {
    return undefined;
  }

  return instant;
}

export function overlaps(left: Interval, right: Interval): boolean {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

export function onSlotGrid(windowStart: Date, slotStart: Date): boolean {
  const elapsed = slotStart.getTime() - windowStart.getTime();
  const step = slotStepMinutes * 60_000;

  return elapsed >= 0 && elapsed % step === 0;
}

function busyByAdvisor(ranges: readonly BusyRange[]): Map<string, BusyRange[]> {
  const grouped = new Map<string, BusyRange[]>();

  for (const range of ranges) {
    const existing = grouped.get(range.advisorId);

    if (existing) {
      existing.push(range);
    } else {
      grouped.set(range.advisorId, [range]);
    }
  }

  return grouped;
}

function slotsInWindow<Visa extends string>(
  window: SlotWindow,
  blocked: readonly BusyRange[],
  visas: readonly VisaDuration<Visa>[],
): BookableSlot<Visa>[] {
  const slots: BookableSlot<Visa>[] = [];

  for (
    let start = window.startsAt;
    start < window.endsAt;
    start = addMinutes(start, slotStepMinutes)
  ) {
    for (const visa of visas) {
      const endsAt = addMinutes(start, visa.durationMinutes);

      if (endsAt > window.endsAt) {
        continue;
      }

      const slot: BookableSlot<Visa> = {
        id: window.id,
        advisorId: window.advisorId,
        advisorName: window.advisorName,
        visaType: visa.visaType,
        startsAt: start,
        endsAt,
      };

      if (blocked.some((range) => overlaps(slot, range))) {
        continue;
      }

      slots.push(slot);
    }
  }

  return slots;
}

function compareBookableSlots<Visa extends string>(
  left: BookableSlot<Visa>,
  right: BookableSlot<Visa>,
): number {
  return (
    left.startsAt.getTime() - right.startsAt.getTime() ||
    left.advisorId.localeCompare(right.advisorId) ||
    left.visaType.localeCompare(right.visaType)
  );
}

export function deriveBookableSlots<Visa extends string>(
  windows: readonly SlotWindow[],
  busy: readonly BusyRange[],
  visas: readonly VisaDuration<Visa>[],
): BookableSlot<Visa>[] {
  const blocked = busyByAdvisor(busy);

  return windows
    .flatMap((window) => slotsInWindow(window, blocked.get(window.advisorId) ?? [], visas))
    .sort(compareBookableSlots);
}
