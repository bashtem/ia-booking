import { describe, expect, it } from "vitest";
import { testEnv, withApp } from "./app.ts";

describe("GET /health", () => {
  it("returns ok and baseline security headers", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({ method: "GET", url: "/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
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

        expect(response.headers["access-control-allow-origin"]).toBe(
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

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });
});

describe("unknown routes", () => {
  it("returns a JSON 404", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({ method: "GET", url: "/missing" });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        success: false,
        error: {
          code: "not_found",
          message: "Route GET /missing not found",
        },
      });
    });
  });
});
