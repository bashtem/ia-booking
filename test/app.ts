import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";
import type { Env } from "../src/config/env.ts";

export const testEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  CORS_ORIGIN: "",
  DATABASE_URL: "postgres://ia:ia@127.0.0.1:5432/ia_booking_test",
} satisfies Env;

export async function withApp(
  env: Env,
  run: (app: FastifyInstance) => Promise<void>,
): Promise<void> {
  const app = await buildApp({ env });

  try {
    await run(app);
  } finally {
    await app.close();
  }
}
