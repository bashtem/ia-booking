import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { advisors } from "./advisors.ts";

export const availabilityWindows = pgTable(
  "availability_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => advisors.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("availability_windows_time_order", sql`${table.endsAt} > ${table.startsAt}`),
    unique("availability_windows_advisor_start_unique").on(table.advisorId, table.startsAt),
  ],
);
