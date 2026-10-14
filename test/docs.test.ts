import { describe, expect, it } from "vitest";
import { testEnv, withApp } from "./app.ts";

function pathKeys(document: unknown): string[] {
  if (
    typeof document !== "object" ||
    document === null ||
    !("paths" in document) ||
    typeof document.paths !== "object" ||
    document.paths === null
  ) {
    return [];
  }

  return Object.keys(document.paths).sort();
}

describe("API docs", () => {
  it("serves Swagger UI over plain HTTP", async () => {
    await withApp(testEnv, async (app) => {
      const docs = await app.inject({ method: "GET", url: "/docs" });

      expect(docs.statusCode).toBe(200);
      expect(docs.headers["content-type"]).toContain("text/html");
      expect(docs.body).toContain("swagger-ui");

      const docsCsp = String(docs.headers["content-security-policy"]);
      expect(docsCsp).toContain("script-src 'self'");
      expect(docsCsp).not.toContain("upgrade-insecure-requests");

      const health = await app.inject({ method: "GET", url: "/health" });
      expect(String(health.headers["content-security-policy"])).toContain(
        "upgrade-insecure-requests",
      );
    });
  });

  it("publishes an OpenAPI document for the booking API", async () => {
    await withApp(testEnv, async (app) => {
      const response = await app.inject({ method: "GET", url: "/docs/json" });
      const spec: unknown = response.json();

      expect(response.statusCode).toBe(200);
      expect(spec).toMatchObject({
        openapi: "3.0.3",
        info: { title: "ia-booking", version: "0.1.0" },
      });
      expect(pathKeys(spec)).toEqual([
        "/availability",
        "/bookings",
        "/bookings/{id}/confirm",
        "/health",
      ]);
      expect(JSON.stringify(spec)).not.toContain('"transform"');
    });
  });
});
