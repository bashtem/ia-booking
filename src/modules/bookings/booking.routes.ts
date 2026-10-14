import type { FastifyPluginAsync } from "fastify";
import {
  defaultPage,
  defaultPageLimit,
  errorResponseSchema,
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
        tags: ["Bookings"],
        summary: "Hold a slot",
        operationId: "createBooking",
        description:
          "Creates a held booking for 10 minutes. startsAt must fall on the 30-minute grid and fit inside one of that advisor's windows.",
        body: createBookingBodySchema,
        response: {
          200: {
            ...bookingResponseSchema,
            description: "Hold created",
          },
          400: errorResponseSchema(
            ["invalid_request"],
            "Body is invalid, or startsAt is not an ISO-8601 timestamp",
          ),
          404: errorResponseSchema(
            ["advisor_not_found"],
            "Advisor does not exist",
          ),
          409: errorResponseSchema(
            ["slot_unavailable"],
            "Slot is outside a window, off the 30-minute grid, or already taken",
          ),
        },
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
        tags: ["Bookings"],
        summary: "Confirm a hold",
        operationId: "confirmBooking",
        description:
          "Confirms an open hold. Confirming an already confirmed booking returns that booking. An elapsed hold is marked expired.",
        params: bookingParamsSchema,
        response: {
          200: {
            ...bookingResponseSchema,
            description: "Booking confirmed",
          },
          400: errorResponseSchema(
            ["invalid_request"],
            "Booking id is not a UUID",
          ),
          404: errorResponseSchema(
            ["booking_not_found"],
            "Booking does not exist",
          ),
          409: errorResponseSchema(
            ["hold_expired", "not_held"],
            "Hold has elapsed, or the booking is not held",
          ),
        },
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
        tags: ["Bookings"],
        summary: "List bookings",
        operationId: "listBookings",
        description:
          "Paginated list. An elapsed hold can still appear as held until a later booking or confirm marks it expired.",
        querystring: listBookingsQuerySchema,
        response: {
          200: {
            ...bookingListResponseSchema,
            description: "Bookings page",
          },
          400: errorResponseSchema(
            ["invalid_request"],
            "Query parameters are invalid",
          ),
        },
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
