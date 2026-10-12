import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { errorHandler } from "./error-handler.ts";

function corsOrigin(configured: string): false | string[] {
  const origins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : false;
}

const appPlugins: FastifyPluginAsync = async (app) => {
  await app.register(errorHandler);
  await app.register(sensible);
  await app.register(helmet);
  await app.register(cors, {
    origin: corsOrigin(app.config.CORS_ORIGIN),
  });
};

export const registerPlugins = fp(appPlugins, { name: "app-plugins" });
