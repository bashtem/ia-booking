import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Env } from "../src/config/env.ts";
import { buildApp } from "../src/app.ts";

const testEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 0,
  LOG_LEVEL: "silent",
  CORS_ORIGIN: "",
  DATABASE_URL: "postgres://ia:ia@127.0.0.1:5432/ia_booking_test",
} satisfies Env;

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = await buildApp({ env: testEnv });

    try {
      const response = await app.inject({ method: "GET", url: "/health" });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { status: "ok" });
    } finally {
      await app.close();
    }
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    const app = await buildApp({ env: testEnv });

    try {
      const response = await app.inject({ method: "GET", url: "/missing" });

      assert.equal(response.statusCode, 404);
      assert.deepEqual(response.json(), {
        statusCode: 404,
        error: "Not Found",
        message: "Route GET /missing not found",
      });
    } finally {
      await app.close();
    }
  });
});
