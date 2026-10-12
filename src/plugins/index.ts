import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { FastifyPluginAsync } from "fastify";
import { errorHandlerPlugin } from "./error-handler.ts";

export const registerPlugins: FastifyPluginAsync = async (app) => {
  await app.register(errorHandlerPlugin);
  await app.register(sensible);
  await app.register(helmet);

  const origins = app.config.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  await app.register(cors, {
    origin: origins.length > 0 ? origins : false,
  });
};
