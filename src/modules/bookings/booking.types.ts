import {
  BookingStatus,
  bookingStatuses,
} from "../../shared/booking-status.ts";
import type { VisaType } from "../../shared/visa-types.ts";

export { BookingStatus, bookingStatuses };

export type CreateBookingInput = {
  advisorId: string;
  candidateName: string;
  visaType: VisaType;
  startsAt: Date;
};

export type ListBookingsQuery = {
  status?: BookingStatus;
  page: number;
  limit: number;
};

export type BookingView = {
  id: string;
  advisorId: string;
  advisorName: string;
  availabilityWindowId: string;
  candidateName: string;
  visaType: VisaType;
  visaLabel: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  confirmedAt: string | null;
};

export type HeldBookingInput = {
  advisorId: string;
  availabilityWindowId: string;
  candidateName: string;
  visaType: VisaType;
  startsAt: Date;
  endsAt: Date;
};

export type BookingRow = {
  id: string;
  advisorId: string;
  availabilityWindowId: string;
  candidateName: string;
  visaType: VisaType;
  startsAt: Date;
  endsAt: Date;
  status: BookingStatus;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
};

export type BookingListRow = BookingRow & {
  advisorName: string;
};