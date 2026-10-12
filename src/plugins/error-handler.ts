import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";

function clientErrorMessage(error: FastifyError, nodeEnv: string): string {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500 && nodeEnv === "production") {
    return "Internal Server Error";
  }

  return error.message;
}

async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    }

    return reply.status(statusCode).send({
      statusCode,
      error: error.name,
      message: clientErrorMessage(error, app.config.NODE_ENV),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      statusCode: 404,
      error: "Not Found",
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
}

export const errorHandler = fp(errorHandlerPlugin, {
  name: "error-handler",
});
