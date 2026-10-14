import type { FastifyPluginAsync } from "fastify";
import { errorResponseSchema, ok } from "../../shared/response.ts";
import { isVisaType, type VisaType } from "../../shared/visa-types.ts";
import {
  availabilityQuerySchema,
  availabilityResponseSchema,
} from "./availability.schemas.ts";
import { listBookableSlots } from "./availability.service.ts";
import type { AvailabilityQuery } from "./availability.types.ts";

function readQuery(query: {
  visaType?: string;
  advisorId?: string;
}): AvailabilityQuery {
  return {
    visaType:
      query.visaType !== undefined && isVisaType(query.visaType)
        ? query.visaType
        : undefined,
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
        tags: ["Availability"],
        summary: "List bookable slots",
        operationId: "listAvailability",
        description:
          "Slots are derived from each advisor window on a 30-minute grid. A slot is omitted when it overlaps a confirmed booking or a hold that has not elapsed.",
        querystring: availabilityQuerySchema,
        response: {
          200: {
            ...availabilityResponseSchema,
            description: "Bookable slots",
          },
          400: errorResponseSchema(
            ["invalid_request"],
            "Query parameters are invalid",
          ),
        },
      },
    },
    async (request) => {
      const slots = await listBookableSlots(app.db, readQuery(request.query));

      return ok(slots);
    },
  );
};
