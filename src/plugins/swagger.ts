import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyPluginAsync, FastifySchema } from "fastify";
import fp from "fastify-plugin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function packageVersion(): string {
  const loaded: unknown = require("../../package.json");

  if (
    typeof loaded === "object" &&
    loaded !== null &&
    "version" in loaded &&
    typeof loaded.version === "string"
  ) {
    return loaded.version;
  }

  throw new Error("package.json is missing a version");
}

const docsRoutePrefix = "/docs";

// `transform` is an Ajv keyword used to trim and uppercase input. It is not
// part of the OpenAPI document.
function omitAjvTransform(value: unknown): void {
  if (Array.isArray(value)) {
    for (const entry of value) omitAjvTransform(entry);
    return;
  }

  if (typeof value !== "object" || value === null) return;

  if (Object.hasOwn(value, "transform")) {
    Reflect.deleteProperty(value, "transform");
  }

  for (const child of Object.values(value)) {
    omitAjvTransform(child);
  }
}

// Swagger UI's own CSP includes upgrade-insecure-requests. That directive
// breaks the page when the API is opened over plain HTTP, which is the local
// default. Docs routes keep the rest of that policy.
function withoutUpgradeInsecureRequests(header: string): string {
  return header
    .split(";")
    .map((directive) => directive.trim())
    .filter(
      (directive) =>
        directive.length > 0 && directive !== "upgrade-insecure-requests",
    )
    .join("; ");
}

const swaggerPlugin: FastifyPluginAsync = async (app) => {
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "ia-booking",
        description:
          "Immigration advisor booking API. Visa A (Skilled Worker) is 30 minutes and visa B (Family / Dependent) is 60 minutes. A hold lasts 10 minutes until it is confirmed. Success responses use { success: true, data }. Errors use { success: false, error: { code, message } }.",
        version: packageVersion(),
      },
      servers: [{ url: "/" }],
      tags: [
        { name: "Health", description: "Process liveness." },
        {
          name: "Availability",
          description:
            "Bookable consultation slots derived from advisor windows.",
        },
        {
          name: "Bookings",
          description: "Hold a slot, confirm it, or list bookings.",
        },
      ],
    },
    transform: ({ schema, url }) => {
      const copy: FastifySchema = structuredClone(schema);
      omitAjvTransform(copy);
      return { schema: copy, url };
    },
  });

  await app.register(swaggerUi, {
    routePrefix: docsRoutePrefix,
    staticCSP: true,
    transformStaticCSP: withoutUpgradeInsecureRequests,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
};

export const apiDocs = fp(swaggerPlugin, {
  name: "api-docs",
});
