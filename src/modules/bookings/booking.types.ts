import type { BookingStatus, VisaType } from "../../db/schema/index.ts";

export type CreateBookingInput = {
  candidateName: string;
  visaType: VisaType;
  advisorId: string;
  startsAt: Date;
};

export type ListBookingsQuery = {
  status?: BookingStatus;
};

export type BookingView = {
  id: string;
  advisorId: string;
  advisorName: string;
  candidateName: string;
  visaType: VisaType;
  visaLabel: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  heldUntil: string | null;
};
