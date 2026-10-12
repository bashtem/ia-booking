import type { FastifyPluginAsync } from "fastify";
import type { BookingStatus, VisaType } from "../../db/schema/index.ts";
import { toHttpError } from "../../shared/errors.ts";
import { parseInstant } from "../../shared/time.ts";
import {
  bookingListResponseSchema,
  bookingParamsSchema,
  bookingResponseSchema,
  createBookingBodySchema,
  listBookingsQuerySchema,
} from "./booking.schemas.ts";
import {
  confirmBooking,
  createBooking,
  listBookings,
} from "./booking.service.ts";

type CreateBody = {
  candidateName: string;
  visaType: VisaType;
  advisorId: string;
  startsAt: string;
};

export const bookingRoutes: FastifyPluginAsync = async (app) => {
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
        throw app.httpErrors.badRequest(
          "startsAt must be an ISO-8601 timestamp",
        );
      }

      try {
        return await createBooking(app.db, {
          candidateName: request.body.candidateName,
          visaType: request.body.visaType,
          advisorId: request.body.advisorId,
          startsAt,
        });
      } catch (error) {
        throw toHttpError(app, error);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/bookings/:id/confirm",
    {
      schema: {
        params: bookingParamsSchema,
        response: { 200: bookingResponseSchema },
      },
    },
    async (request) => {
      try {
        return await confirmBooking(app.db, request.params.id);
      } catch (error) {
        throw toHttpError(app, error);
      }
    },
  );

  app.get<{ Querystring: { status?: BookingStatus } }>(
    "/bookings",
    {
      schema: {
        querystring: listBookingsQuerySchema,
        response: { 200: bookingListResponseSchema },
      },
    },
    async (request) => {
      try {
        const bookings = await listBookings(app.db, {
          status: request.query.status,
        });
        return { bookings };
      } catch (error) {
        throw toHttpError(app, error);
      }
    },
  );
};
