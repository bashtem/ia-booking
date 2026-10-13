import type { FastifyPluginAsync } from "fastify";
import type { VisaType } from "../../db/schema/index.ts";
import { ok } from "../../shared/response.ts";
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
    async (request) =>
      ok(await listBookableSlots(app.db, readQuery(request.query))),
  );
};
