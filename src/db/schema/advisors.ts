import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const advisors = pgTable(
  "advisors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("advisors_id_not_blank", sql`length(btrim(${table.id})) > 0`),
    check("advisors_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);
