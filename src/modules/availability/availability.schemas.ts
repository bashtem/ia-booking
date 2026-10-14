import { successSchema } from "../../shared/response.ts";
import { visaTypeList } from "../../shared/visa-types.ts";

const slotSchema = {
  type: "object",
  additionalProperties: false,
  required: ["advisorId", "advisorName", "visaType", "startsAt", "endsAt"],
  properties: {
    advisorId: { type: "string", description: "Advisor id, for example ia-001." },
    advisorName: { type: "string" },
    visaType: {
      type: "string",
      enum: visaTypeList,
      description: "A is 30 minutes. B is 60 minutes.",
    },
    startsAt: { type: "string", description: "Slot start, ISO-8601." },
    endsAt: { type: "string", description: "Slot end, ISO-8601." },
  },
} as const;

export const availabilityQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    visaType: {
      type: "string",
      enum: visaTypeList,
      transform: ["toUpperCase"],
      description:
        "A (Skilled Worker, 30 minutes) or B (Family / Dependent, 60 minutes). Case-insensitive.",
    },
    advisorId: {
      type: "string",
      minLength: 1,
      description: "Limit slots to one advisor, for example ia-001.",
    },
  },
} as const;

export const availabilityResponseSchema = successSchema({
  type: "array",
  items: slotSchema,
});
