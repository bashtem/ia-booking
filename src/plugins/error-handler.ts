import type { FastifyError, FastifyPluginAsync } from "fastify";

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    }

    const message =
      statusCode >= 500 && app.config.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message;

    return reply.status(statusCode).send({
      statusCode,
      error: error.name,
      message,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
};
