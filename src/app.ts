import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import { loadEnv, type Env } from "./config/env.ts";
import { registerPlugins } from "./plugins/index.ts";
import { registerRoutes } from "./routes/index.ts";

export interface BuildAppOptions {
  env?: Env;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? loadEnv();

  const logger: FastifyServerOptions["logger"] =
    env.NODE_ENV === "development"
      ? {
          level: env.LOG_LEVEL,
          transport: {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
        }
      : { level: env.LOG_LEVEL };

  const app = Fastify({
    logger,
    logController: new LogController({
      disableRequestLogging: env.NODE_ENV === "test",
    }),
  });

  app.decorate("config", env);

  await app.register(registerPlugins);
  await app.register(registerRoutes);

  await app.ready();

  return app;
}
