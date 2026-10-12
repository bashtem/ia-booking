import type { FastifyPluginAsync } from "fastify";
import { availabilityRoutes } from "./modules/availability/availability.routes.ts";
import { bookingRoutes } from "./modules/bookings/booking.routes.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";

export const registerRoutes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
  await app.register(availabilityRoutes);
  await app.register(bookingRoutes);
};
