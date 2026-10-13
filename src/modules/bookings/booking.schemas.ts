import {
  defaultPage,
  defaultPageLimit,
  maxPageLimit,
  paginatedSchema,
  successSchema,
} from "../../shared/response.ts";
import { visaTypeList, type VisaType } from "../../shared/visa-types.ts";
import { bookingStatuses } from "./booking.types.ts";

export type CreateBody = {
  candidateName: string;
  visaType: VisaType;
  advisorId: string;
  startsAt: string;
};

const bookingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "advisorId",
    "advisorName",
    "availabilityWindowId",
    "candidateName",
    "visaType",
    "visaLabel",
    "startsAt",
    "endsAt",
    "status",
    "holdExpiresAt",
    "confirmedAt",
  ],
  properties: {
    id: { type: "string" },
    advisorId: { type: "string" },
    advisorName: { type: "string" },
    availabilityWindowId: { type: "string" },
    candidateName: { type: "string" },
    visaType: { type: "string", enum: visaTypeList },
    visaLabel: { type: "string" },
    startsAt: { type: "string" },
    endsAt: { type: "string" },
    status: {
      type: "string",
      enum: bookingStatuses,
    },
    holdExpiresAt: { type: ["string", "null"] },
    confirmedAt: { type: ["string", "null"] },
  },
} as const;

export const createBookingBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidateName", "visaType", "advisorId", "startsAt"],
  properties: {
    candidateName: { type: "string", minLength: 3, maxLength: 150, transform: ["trim"] },
    visaType: { type: "string", enum: visaTypeList, transform: ["toUpperCase"] },
    advisorId: { type: "string", minLength: 1, maxLength: 50 },
    startsAt: { type: "string", minLength: 1 },
  },
} as const;

export const bookingParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: {
      type: "string",
      pattern:
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    },
  },
} as const;

export const listBookingsQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: bookingStatuses,
    },
    page: { type: "integer", minimum: 1, default: defaultPage },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: maxPageLimit,
      default: defaultPageLimit,
    },
  },
} as const;

export const bookingResponseSchema = successSchema(bookingSchema);

export const bookingListResponseSchema = paginatedSchema(bookingSchema);
