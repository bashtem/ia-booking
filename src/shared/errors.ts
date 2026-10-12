import type { FastifyInstance } from "fastify";

export const bookingErrorCodes = [
  "invalid_request",
  "slot_unavailable",
  "advisor_not_found",
  "booking_not_found",
  "hold_expired",
  "not_held",
] as const;

export type BookingErrorCode = (typeof bookingErrorCodes)[number];

export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message: string) {
    super(message);
    this.name = "BookingError";
    this.code = code;
  }
}

export function httpStatusForBookingError(
  error: BookingError,
): 400 | 404 | 409 {
  switch (error.code) {
    case "invalid_request":
      return 400;
    case "advisor_not_found":
    case "booking_not_found":
      return 404;
    default:
      return 409;
  }
}

export function toHttpError(app: FastifyInstance, error: unknown): Error {
  if (!(error instanceof BookingError)) {
    return error instanceof Error ? error : new Error("Request failed");
  }

  const message = error.message;
  const statusCode = httpStatusForBookingError(error);

  if (statusCode === 400) {
    return app.httpErrors.badRequest(message);
  }

  if (statusCode === 404) {
    return app.httpErrors.notFound(message);
  }

  return app.httpErrors.conflict(message);
}
