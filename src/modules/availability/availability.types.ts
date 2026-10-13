import type { VisaType } from "../../shared/visa-types.ts";

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
