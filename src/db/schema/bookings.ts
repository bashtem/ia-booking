import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  bookingStatuses,
  type BookingStatus,
} from "../../modules/bookings/booking.types.ts";
import {
  visaTypeList,
  visaTypes,
  type VisaType,
} from "../../shared/visa-types.ts";
import { advisors } from "./advisors.ts";
import { availabilityWindows } from "./availability-windows.ts";
import { timestamps } from "./timestamps.ts";

function sqlLiteral(value: string): SQL {
  return sql.raw(`'${value}'`);
}

function sqlList(values: readonly string[]): SQL {
  return sql.join(
    values.map((value) => sqlLiteral(value)),
    sql`, `,
  );
}

function visaTypeAllowed(visaType: AnyColumn): SQL {
  return sql`${visaType} in (${sqlList(visaTypeList)})`;
}

function statusAllowed(status: AnyColumn): SQL {
  return sql`${status} in (${sqlList(bookingStatuses)})`;
}

function durationMatchesVisa(
  visaType: AnyColumn,
  startsAt: AnyColumn,
  endsAt: AnyColumn,
): SQL {
  const matches = visaTypeList.map((code) => {
    const minutes = String(visaTypes[code].durationMinutes);

    return sql`(${visaType} = ${sqlLiteral(code)} and ${endsAt} = ${startsAt} + interval '${sql.raw(`${minutes} minutes`)}')`;
  });

  return sql.join(matches, sql` or `);
}

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advisorId: varchar("advisor_id", { length: 50 })
      .notNull()
      .references(() => advisors.id),
    availabilityWindowId: uuid("availability_window_id")
      .notNull()
      .references(() => availabilityWindows.id),
    candidateName: varchar("candidate_name", { length: 150 }).notNull(),
    visaType: varchar("visa_type", { length: 1 }).$type<VisaType>().notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).$type<BookingStatus>().notNull(),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    check("bookings_visa_type", visaTypeAllowed(table.visaType)),
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
      sql`${table.status} <> 'held' or ${table.holdExpiresAt} is not null`,
    ),
    check(
      "bookings_confirmed_has_timestamp",
      sql`${table.status} <> 'confirmed' or ${table.confirmedAt} is not null`,
    ),
    index("bookings_advisor_starts_idx").on(table.advisorId, table.startsAt),
    index("bookings_availability_window_idx").on(table.availabilityWindowId),
    index("bookings_status_starts_idx").on(table.status, table.startsAt, table.id),
    index("bookings_active_holds_idx")
      .on(table.holdExpiresAt)
      .where(sql`${table.status} = 'held'`),
  ],
);
