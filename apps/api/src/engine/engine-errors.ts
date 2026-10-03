import { HttpStatus, type Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { AppError } from '../common/app-error.js';
import { EngineBusyError } from './engine-pool.js';
import { EngineCrashedError, EngineTimeoutError } from './uci-engine.js';

/** True when the engine could not answer now but may be able to a moment later. */
export function isEngineFailure(error: unknown): boolean {
  return (
    error instanceof EngineBusyError ||
    error instanceof EngineTimeoutError ||
    error instanceof EngineCrashedError ||
    (error instanceof AppError && error.code === 'server.unavailable')
  );
}

/** Turns an engine failure into the `503` the clients know how to wait out, anything else passes through. */
export function toHttpError(error: unknown, reply: FastifyReply, logger: Logger): unknown {
  if (error instanceof EngineBusyError) {
    void reply.header('Retry-After', error.retryAfterSeconds);
    return new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
  if (error instanceof EngineTimeoutError || error instanceof EngineCrashedError) {
    // The engine restarts itself, so asking again soon is the right advice
    logger.error(error);
    return new AppError('server.unavailable', HttpStatus.SERVICE_UNAVAILABLE);
  }
  return error;
}
