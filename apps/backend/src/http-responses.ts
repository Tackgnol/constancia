import type { FastifyReply } from 'fastify';

export interface OkResponse<T> {
  status: 'ok';
  data: T;
}

export interface DeleteResponse {
  status: 'ok';
  deleted: boolean;
}

export interface ErrorResponse {
  status: 'error';
  data: {
    message: string;
  };
}

export function ok<T>(data: T): OkResponse<T> {
  return { status: 'ok', data };
}

export function deleted(wasDeleted: boolean): DeleteResponse {
  return { status: 'ok', deleted: wasDeleted };
}

export function error(message: string): ErrorResponse {
  return { status: 'error', data: { message } };
}

export function sendError(reply: FastifyReply, statusCode: number, message: string): FastifyReply {
  return reply.code(statusCode).send(error(message));
}

export function sendNotFound(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, 404, message);
}

export function isPrismaNotFoundError(errorValue: unknown): boolean {
  return isPrismaErrorCode(errorValue, 'P2025');
}

function isPrismaErrorCode(errorValue: unknown, code: string): boolean {
  if (!errorValue || typeof errorValue !== 'object' || !('code' in errorValue)) {
    return false;
  }

  return errorValue.code === code;
}
