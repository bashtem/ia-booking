import { sql } from "drizzle-orm";
import { check, pgTable, text } from "drizzle-orm/pg-core";
import { timestamps } from "./timestamps.ts";

export const advisors = pgTable(
  "advisors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ...timestamps(),
  },
  (table) => [
    check("advisors_id_not_blank", sql`length(btrim(${table.id})) > 0`),
    check("advisors_name_not_blank", sql`length(btrim(${table.name})) > 0`),
  ],
);
