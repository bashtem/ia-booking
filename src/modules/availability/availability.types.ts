import type { VisaType } from "../../db/schema/index.ts";

export type AvailabilityQuery = {
  visaType?: VisaType;
  advisorId?: string;
};

export type AvailabilitySlot = {
  advisorId: string;
  advisorName: string;
  visaType: VisaType;
  startsAt: string;
  endsAt: string;
};
