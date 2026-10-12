import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createDatabase } from "../db/client.ts";

const databasePlugin: FastifyPluginAsync = async (app) => {
  const { db, pool } = createDatabase(app.config.DATABASE_URL);

  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await pool.end();
  });
};

export const database = fp(databasePlugin, {
  name: "database",
  decorators: {
    fastify: ["config"],
  },
});
