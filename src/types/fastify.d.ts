import type { Env } from "../config/env.ts";
import type { Database } from "../db/client.ts";

declare module "fastify" {
  interface FastifyInstance {
    config: Env;
    db: Database;
  }
}
