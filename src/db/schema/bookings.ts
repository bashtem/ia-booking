import { sql, type SQL } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { advisors } from "./advisors.ts";

export const visaTypes = {
  A: { label: "Skilled Worker", durationMinutes: 30 },
  B: { label: "Family / Dependent", durationMinutes: 60 },
} as const;

export type VisaType = keyof typeof visaTypes;

export const bookingStatuses = [
  "held",
  "confirmed",
  "expired",
  "cancelled",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

function quotedList(values: readonly string[]): SQL {
  return sql.join(
    values.map((value) => sql.raw(`'${value}'`)),
    sql`, `,
  );
}

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => advisors.id),
    candidateName: text("candidate_name").notNull(),
    visaType: text("visa_type").$type<VisaType>().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").$type<BookingStatus>().notNull(),
    heldUntil: timestamp("held_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "bookings_status",
      sql`${table.status} in (${quotedList(bookingStatuses)})`,
    ),
    check(
      "bookings_duration",
      sql.join(
        (
          Object.entries(visaTypes) as [
            VisaType,
            (typeof visaTypes)[VisaType],
          ][]
        ).map(
          ([code, spec]) =>
            sql`(${table.visaType} = ${sql.raw(`'${code}'`)} and ${table.endsAt} = ${table.startsAt} + interval '${sql.raw(String(spec.durationMinutes))} minutes')`,
        ),
        sql` or `,
      ),
    ),
    check(
      "bookings_candidate_name_not_blank",
      sql`length(btrim(${table.candidateName})) > 0`,
    ),
    check(
      "bookings_hold_has_deadline",
      sql`${table.status} <> 'held' or ${table.heldUntil} is not null`,
    ),
    index("bookings_advisor_starts_idx").on(table.advisorId, table.startsAt),
    index("bookings_active_holds_idx")
      .on(table.heldUntil)
      .where(sql`${table.status} = 'held'`),
  ],
);
