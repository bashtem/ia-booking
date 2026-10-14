import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Liveness",
        operationId: "getHealth",
        description:
          "Returns ok when the process is up. Does not check the database.",
        response: {
          200: {
            description: "Process is up",
            type: "object",
            additionalProperties: false,
            required: ["status"],
            properties: {
              status: { type: "string", const: "ok" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" as const }),
  );
};
