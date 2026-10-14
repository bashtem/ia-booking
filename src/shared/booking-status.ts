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
