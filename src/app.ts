import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import { loadEnv, type Env } from "./config/env.ts";
import { database } from "./plugins/database.ts";
import { registerPlugins } from "./plugins/index.ts";
import { registerRoutes } from "./routes/index.ts";

export interface BuildAppOptions {
  env?: Env;
}

function loggerOptions(env: Env): FastifyServerOptions["logger"] {
  if (env.NODE_ENV !== "development") {
    return { level: env.LOG_LEVEL };
  }

  return {
    level: env.LOG_LEVEL,
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  };
}

export async function buildApp(options: BuildAppOptions = {}) {
  const env = options.env ?? loadEnv();
  const app = Fastify({
    logger: loggerOptions(env),
    logController: new LogController({
      disableRequestLogging: env.NODE_ENV === "test",
    }),
  });

  app.decorate("config", env);

  try {
    await app.register(database);
    await app.register(registerPlugins);
    await app.register(registerRoutes);
    await app.ready();
  } catch (error) {
    await app.close();
    throw error;
  }

  return app;
}
