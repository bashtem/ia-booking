import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  BookingError,
  httpStatusForBookingError,
} from "../modules/bookings/booking.errors.ts";
import { fail } from "../shared/response.ts";

function clientErrorMessage(error: FastifyError, nodeEnv: string): string {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500 && nodeEnv === "production")
    return "Internal Server Error";

  return error.message;
}

function codeForStatus(statusCode: number): string {
  if (statusCode === 404) return "not_found";
  if (statusCode >= 500) return "internal_error";
  return "invalid_request";
}

async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof BookingError) {
      const statusCode = httpStatusForBookingError(error);
      request.log.info({ statusCode, code: error.code }, error.message);

      return reply.status(statusCode).send(fail(error.code, error.message));
    }

    const statusCode = error.statusCode ?? 500;
    const code = codeForStatus(statusCode);

    if (statusCode >= 500) {
      request.log.error({ err: error }, "request failed");
    } else {
      request.log.info({ statusCode, code }, error.message);
    }

    return reply
      .status(statusCode)
      .send(fail(code, clientErrorMessage(error, app.config.NODE_ENV)));
  });

  app.setNotFoundHandler((request, reply) => {
    const message = `Route ${request.method} ${request.url} not found`;
    request.log.info({ statusCode: 404, code: "not_found" }, message);

    return reply.status(404).send(fail("not_found", message));
  });
}

export const errorHandler = fp(errorHandlerPlugin, {
  name: "error-handler",
});
