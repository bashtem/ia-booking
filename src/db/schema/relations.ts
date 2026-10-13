import { relations } from "drizzle-orm";
import { advisors } from "./advisors.ts";
import { availabilityWindows } from "./availability-windows.ts";
import { bookings } from "./bookings.ts";

export const advisorsRelations = relations(advisors, ({ many }) => ({
  availabilityWindows: many(availabilityWindows),
  bookings: many(bookings),
}));

export const availabilityWindowsRelations = relations(
  availabilityWindows,
  ({ one, many }) => ({
    advisor: one(advisors, {
      fields: [availabilityWindows.advisorId],
      references: [advisors.id],
    }),
    bookings: many(bookings),
  }),
);

export const bookingsRelations = relations(bookings, ({ one }) => ({
  advisor: one(advisors, {
    fields: [bookings.advisorId],
    references: [advisors.id],
  }),
  availabilityWindow: one(availabilityWindows, {
    fields: [bookings.availabilityWindowId],
    references: [availabilityWindows.id],
  }),
}));
