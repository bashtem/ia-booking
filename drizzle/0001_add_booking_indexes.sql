CREATE INDEX "bookings_availability_window_idx" ON "bookings" USING btree ("availability_window_id");
CREATE INDEX "bookings_status_starts_idx" ON "bookings" USING btree ("status","starts_at","id");