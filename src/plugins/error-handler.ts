import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { BookingError, httpStatusForBookingError } from "../shared/errors.ts";
import { fail } from "../shared/response.ts";

function clientErrorMessage(error: FastifyError, nodeEnv: string): string {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500 && nodeEnv === "production") {
    return "Internal Server Error";
  }

  return error.message;
}

function codeForStatus(statusCode: number): string {
  if (statusCode === 404) {
    return "not_found";
  }

  if (statusCode >= 500) {
    return "internal_error";
  }

  return "invalid_request";
}

async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof BookingError) {
      return reply
        .status(httpStatusForBookingError(error))
        .send(fail(error.code, error.message));
    }

    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    }

    return reply.status(statusCode).send(
      fail(
        codeForStatus(statusCode),
        clientErrorMessage(error, app.config.NODE_ENV),
      ),
    );
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(
      fail("not_found", `Route ${request.method} ${request.url} not found`),
    );
  });
}

export const errorHandler = fp(errorHandlerPlugin, {
  name: "error-handler",
});
