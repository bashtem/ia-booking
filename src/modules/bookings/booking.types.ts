import type { VisaType } from "../../shared/visa-types.ts";

export const BookingStatus = {
  held: "held",
  confirmed: "confirmed",
  expired: "expired",
  cancelled: "cancelled",
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const bookingStatuses = [
  BookingStatus.held,
  BookingStatus.confirmed,
  BookingStatus.expired,
  BookingStatus.cancelled,
] as const;

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