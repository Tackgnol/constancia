import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { isHandledRequestError, serializeHandledRequestError } from '../services/request-errors.js';

const requestErrorPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (isHandledRequestError(error)) {
      reply.code(error.statusCode).send(serializeHandledRequestError(error));
      return;
    }

    request.log.error(error);
    reply.status(getErrorStatusCode(error)).send({
      status: 'error',
      data: {
        message: getErrorMessage(error),
        code: 'REQUEST_FAILED',
      },
    });
  });
};

export default fp(requestErrorPlugin, {
  name: 'request-error-plugin',
});

function getErrorStatusCode(error: unknown): number {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return 500;
  }

  const { statusCode } = error;
  return typeof statusCode === 'number' ? statusCode : 500;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Internal server error';
}
