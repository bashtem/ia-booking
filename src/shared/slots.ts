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

export function fitsInside(slot: Interval, window: Interval): boolean {
  return slot.startsAt >= window.startsAt && slot.endsAt <= window.endsAt;
}

export function onSlotGrid(windowStart: Date, slotStart: Date): boolean {
  const elapsed = slotStart.getTime() - windowStart.getTime();
  const step = slotStepMinutes * 60_000;

  return elapsed >= 0 && elapsed % step === 0;
}

export function deriveBookableSlots<Visa extends string>(
  windows: readonly SlotWindow[],
  busy: readonly BusyRange[],
  visas: readonly VisaDuration<Visa>[],
): BookableSlot<Visa>[] {
  const slots: BookableSlot<Visa>[] = [];

  for (const window of windows) {
    let start = window.startsAt;

    while (start < window.endsAt) {
      for (const visa of visas) {
        const slot = {
          id: window.id,
          advisorId: window.advisorId,
          advisorName: window.advisorName,
          visaType: visa.visaType,
          startsAt: start,
          endsAt: addMinutes(start, visa.durationMinutes),
        };

        const blocked = busy.some(
          (range) => range.advisorId === window.advisorId && overlaps(slot, range),
        );

        if (fitsInside(slot, window) && !blocked) {
          slots.push(slot);
        }
      }

      start = addMinutes(start, slotStepMinutes);
    }
  }

  slots.sort((left, right) => {
    const byStart = left.startsAt.getTime() - right.startsAt.getTime();

    if (byStart !== 0) {
      return byStart;
    }

    if (left.advisorId !== right.advisorId) {
      return left.advisorId < right.advisorId ? -1 : 1;
    }

    if (left.visaType !== right.visaType) {
      return left.visaType < right.visaType ? -1 : 1;
    }

    return 0;
  });

  return slots;
}
