import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.ts";
import type { Env } from "../src/config/env.ts";

const testEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  CORS_ORIGIN: "",
  DATABASE_URL: "postgres://ia:ia@127.0.0.1:5432/ia_booking_test",
} satisfies Env;

async function withApp(
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

describe("GET /health", () => {
  it("returns ok and baseline security headers", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({ method: "GET", url: "/health" });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { status: "ok" });
      assert.equal(response.headers["x-content-type-options"], "nosniff");
    });
  });
});

describe("CORS", () => {
  it("allows a configured browser origin", async () => {
    await withApp(
      { ...testEnv, CORS_ORIGIN: "http://localhost:5173" },
      async (app) => {
        const response = await app.inject({
          method: "GET",
          url: "/health",
          headers: { origin: "http://localhost:5173" },
        });

        assert.equal(
          response.headers["access-control-allow-origin"],
          "http://localhost:5173",
        );
      },
    );
  });

  it("stays disabled when no origin is configured", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { origin: "http://localhost:5173" },
      });

      assert.equal(response.headers["access-control-allow-origin"], undefined);
    });
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({ method: "GET", url: "/missing" });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.json(), {
        statusCode: 404,
        error: "Not Found",
        message: "Route GET /missing not found",
      });
    });
  });
});
