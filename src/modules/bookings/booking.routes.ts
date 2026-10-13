import type { FastifyPluginAsync } from "fastify";
import {
  defaultPage,
  defaultPageLimit,
  ok,
  paginated,
} from "../../shared/response.ts";
import { parseInstant } from "../../shared/slots.ts";
import { BookingError } from "./booking.errors.ts";
import {
  bookingListResponseSchema,
  bookingParamsSchema,
  bookingResponseSchema,
  createBookingBodySchema,
  listBookingsQuerySchema,
  type CreateBody,
} from "./booking.schemas.ts";
import {
  confirmBooking,
  createBooking,
  listBookings,
} from "./booking.service.ts";
import type { BookingStatus } from "./booking.types.ts";

export const bookingRoutes: FastifyPluginAsync = async (app) => {
  // Create a new booking
  app.post<{ Body: CreateBody }>(
    "/bookings",
    {
      schema: {
        body: createBookingBodySchema,
        response: { 200: bookingResponseSchema },
      },
    },
    async (request) => {
      const startsAt = parseInstant(request.body.startsAt);

      if (startsAt === undefined) {
        throw new BookingError(
          "invalid_request",
          "startsAt must be an ISO-8601 timestamp e.g. 2026-10-13T10:00:00Z",
        );
      }

      const booking = await createBooking(app.db, {
        candidateName: request.body.candidateName,
        visaType: request.body.visaType,
        advisorId: request.body.advisorId,
        startsAt,
      });

      return ok(booking);
    },
  );

  // Confirm a booking
  app.post<{ Params: { id: string } }>(
    "/bookings/:id/confirm",
    {
      schema: {
        params: bookingParamsSchema,
        response: { 200: bookingResponseSchema },
      },
    },
    async (request) => ok(await confirmBooking(app.db, request.params.id)),
  );

  // List bookings
  app.get<{
    Querystring: { status?: BookingStatus; page?: number; limit?: number };
  }>(
    "/bookings",
    {
      schema: {
        querystring: listBookingsQuerySchema,
        response: { 200: bookingListResponseSchema },
      },
    },
    async (request) => {
      const page = request.query.page ?? defaultPage;
      const limit = request.query.limit ?? defaultPageLimit;
      const { bookings, total } = await listBookings(app.db, {
        status: request.query.status,
        page,
        limit,
      });

      return paginated(bookings, { page, limit, total });
    },
  );
};
