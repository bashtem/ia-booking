import { timestamp } from "drizzle-orm/pg-core";

// Fresh column instances per table. Reusing one object would bind every
// table to the same Drizzle column.
export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}
