import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { advisors } from "./advisors.ts";
import { timestamps } from "./timestamps.ts";

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

function sqlLiteral(value: string): SQL {
  return sql.raw(`'${value}'`);
}

function sqlList(values: readonly string[]): SQL {
  return sql.join(
    values.map((value) => sqlLiteral(value)),
    sql`, `,
  );
}

function isVisaType(code: string): code is VisaType {
  return code in visaTypes;
}

function statusAllowed(status: AnyColumn): SQL {
  return sql`${status} in (${sqlList(bookingStatuses)})`;
}

function durationMatchesVisa(
  visaType: AnyColumn,
  startsAt: AnyColumn,
  endsAt: AnyColumn,
): SQL {
  const matches = Object.keys(visaTypes).filter(isVisaType).map((code) => {
    const minutes = String(visaTypes[code].durationMinutes);

    return sql`(${visaType} = ${sqlLiteral(code)} and ${endsAt} = ${startsAt} + interval '${sql.raw(`${minutes} minutes`)}')`;
  });

  return sql.join(matches, sql` or `);
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
    ...timestamps(),
  },
  (table) => [
    check("bookings_status", statusAllowed(table.status)),
    check(
      "bookings_duration",
      durationMatchesVisa(table.visaType, table.startsAt, table.endsAt),
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
