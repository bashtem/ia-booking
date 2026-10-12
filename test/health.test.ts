import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { testEnv, withApp } from "./app.ts";

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
