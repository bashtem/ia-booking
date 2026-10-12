const bookingSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "advisorId",
    "advisorName",
    "candidateName",
    "visaType",
    "visaLabel",
    "startsAt",
    "endsAt",
    "status",
    "heldUntil",
  ],
  properties: {
    id: { type: "string" },
    advisorId: { type: "string" },
    advisorName: { type: "string" },
    candidateName: { type: "string" },
    visaType: { type: "string", enum: ["A", "B"] },
    visaLabel: { type: "string" },
    startsAt: { type: "string" },
    endsAt: { type: "string" },
    status: {
      type: "string",
      enum: ["held", "confirmed", "expired", "cancelled"],
    },
    heldUntil: { type: ["string", "null"] },
  },
} as const;

export const createBookingBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidateName", "visaType", "advisorId", "startsAt"],
  properties: {
    candidateName: { type: "string", minLength: 1 },
    visaType: { type: "string", enum: ["A", "B"] },
    advisorId: { type: "string", minLength: 1 },
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
      enum: ["held", "confirmed", "expired", "cancelled"],
    },
  },
} as const;

export const bookingResponseSchema = bookingSchema;

export const bookingListResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["bookings"],
  properties: {
    bookings: {
      type: "array",
      items: bookingSchema,
    },
  },
} as const;
