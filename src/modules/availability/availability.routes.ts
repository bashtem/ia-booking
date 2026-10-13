import type { FastifyPluginAsync } from "fastify";
import { ok } from "../../shared/response.ts";
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
        querystring: availabilityQuerySchema,
        response: { 200: availabilityResponseSchema },
      },
    },
    async (request) => {
      const slots = await listBookableSlots(app.db, readQuery(request.query));

      return ok(slots);
    },
  );
};
