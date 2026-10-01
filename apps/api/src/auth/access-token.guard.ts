import { HttpStatus, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppError } from '../common/app-error.js';
import { TokenService } from './token.service.js';

export type AuthenticatedRequest = FastifyRequest & { userId: string };

const BEARER_PREFIX = 'Bearer ';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;
    const userId = header?.startsWith(BEARER_PREFIX)
      ? await this.tokens.verifyAccessToken(header.slice(BEARER_PREFIX.length))
      : null;
    if (!userId) throw new AppError('auth.unauthorized', HttpStatus.UNAUTHORIZED);
    (request as AuthenticatedRequest).userId = userId;
    return true;
  }
}
