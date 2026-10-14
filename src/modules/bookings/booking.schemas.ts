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
    visaType: {
      type: "string",
      enum: visaTypeList,
      description: "A is 30 minutes. B is 60 minutes.",
    },
    visaLabel: { type: "string", description: "Human-readable visa name." },
    startsAt: { type: "string", description: "Appointment start, ISO-8601." },
    endsAt: { type: "string", description: "Appointment end, ISO-8601." },
    status: {
      type: "string",
      enum: bookingStatuses,
      description: "held, confirmed, expired, or cancelled.",
    },
    holdExpiresAt: {
      type: ["string", "null"],
      description: "Hold deadline. Null after the hold is confirmed or expired.",
    },
    confirmedAt: {
      type: ["string", "null"],
      description: "When the hold was confirmed. Null while it is still held.",
    },
  },
} as const;

export const createBookingBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidateName", "visaType", "advisorId", "startsAt"],
  properties: {
    candidateName: {
      type: "string",
      minLength: 3,
      maxLength: 150,
      transform: ["trim"],
      description: "Candidate name. Trimmed. 3 to 150 characters.",
    },
    visaType: {
      type: "string",
      enum: visaTypeList,
      transform: ["toUpperCase"],
      description:
        "A (Skilled Worker, 30 minutes) or B (Family / Dependent, 60 minutes).",
    },
    advisorId: {
      type: "string",
      minLength: 1,
      maxLength: 50,
      description: "Advisor id, for example ia-001.",
    },
    startsAt: {
      type: "string",
      minLength: 1,
      description:
        "Slot start as an ISO-8601 timestamp on the 30-minute grid. Example: 2026-11-10T09:00:00Z.",
    },
  },
  examples: [
    {
      candidateName: "Alex Candidate",
      visaType: "A",
      advisorId: "ia-001",
      startsAt: "2026-11-10T09:00:00Z",
    },
  ],
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
      description: "Booking id.",
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
      description: "Filter by held, confirmed, expired, or cancelled.",
    },
    page: {
      type: "integer",
      minimum: 1,
      default: defaultPage,
      description: "Page number, starting at 1.",
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: maxPageLimit,
      default: defaultPageLimit,
      description: "Page size. Default 20, maximum 100.",
    },
  },
} as const;

export const bookingResponseSchema = successSchema(bookingSchema);

export const bookingListResponseSchema = paginatedSchema(bookingSchema);
