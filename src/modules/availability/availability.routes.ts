import type { FastifyPluginAsync } from "fastify";
import type { VisaType } from "../../db/schema/index.ts";
import { toHttpError } from "../../shared/errors.ts";
import {
  availabilityQuerySchema,
  availabilityResponseSchema,
} from "./availability.schemas.ts";
import {
  listBookableSlots,
  type AvailabilityQuery,
} from "./availability.service.ts";

function readQuery(query: {
  visaType?: string;
  advisorId?: string;
}): AvailabilityQuery {
  return {
    visaType: query.visaType === "A" || query.visaType === "B" ? query.visaType : undefined,
    advisorId: query.advisorId,
  };
}

export const availabilityRoutes: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { visaType?: VisaType; advisorId?: string };
  }>(
    "/availability",
    {
      schema: {
        querystring: availabilityQuerySchema,
        response: { 200: availabilityResponseSchema },
      },
    },
    async (request) => {
      try {
        const slots = await listBookableSlots(app.db, readQuery(request.query));
        return { slots };
      } catch (error) {
        throw toHttpError(app, error);
      }
    },
  );
};
