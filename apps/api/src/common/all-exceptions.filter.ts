import type { ApiError } from '@kotgambit/contracts';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ERROR_MESSAGES, type ErrorCode } from './app-error.js';

interface Mapped {
  status: number;
  code: ErrorCode;
  details?: unknown;
}

const NEST_STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'http.bad_request',
  [HttpStatus.UNAUTHORIZED]: 'auth.unauthorized',
  [HttpStatus.NOT_FOUND]: 'http.not_found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'http.too_many_requests',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'server.unavailable',
};

function map(exception: unknown): Mapped {
  if (exception instanceof AppError) {
    return { status: exception.status, code: exception.code, details: exception.details };
  }
  if (exception instanceof ZodError) {
    // Paths and rules only: the rejected values may be passwords
    const details = exception.issues.map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code,
    }));
    return { status: HttpStatus.BAD_REQUEST, code: 'validation.failed', details };
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    return { status, code: NEST_STATUS_CODES[status] ?? 'server.internal' };
  }
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: 'server.internal' };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const { status, code, details } = map(exception);

    // Unexpected failures are logged with the stack, the client only sees the generic message.
    // A busy server is an expected state, a line without the stack is enough to see how often it happens.
    if (status === HttpStatus.SERVICE_UNAVAILABLE) this.logger.warn(code);
    else if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception);

    const body: ApiError = {
      code,
      message: ERROR_MESSAGES[code],
      ...(details === undefined ? {} : { details }),
    };
    void reply.status(status).send(body);
  }
}
