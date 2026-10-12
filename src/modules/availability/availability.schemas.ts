import { successSchema } from "../../shared/response.ts";

const slotSchema = {
  type: "object",
  additionalProperties: false,
  required: ["advisorId", "advisorName", "visaType", "startsAt", "endsAt"],
  properties: {
    advisorId: { type: "string" },
    advisorName: { type: "string" },
    visaType: { type: "string", enum: ["A", "B"] },
    startsAt: { type: "string" },
    endsAt: { type: "string" },
  },
} as const;

export const availabilityQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visaType: { type: "string", enum: ["A", "B"] },
    advisorId: { type: "string", minLength: 1 },
  },
} as const;

export const availabilityResponseSchema = successSchema({
  type: "array",
  items: slotSchema,
});
