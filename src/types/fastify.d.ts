import type { Env } from "../config/env.ts";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
  }
}
