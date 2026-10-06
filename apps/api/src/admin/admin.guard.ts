import {
  HttpStatus,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import type { AuthenticatedRequest } from '../auth/access-token.guard.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Lets in the accounts whose email is in ADMIN_EMAILS and has been confirmed. Runs after AccessTokenGuard. Everybody else gets a 404,
 * so that the page does not even show that it exists.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { userId } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerifiedAt: true },
    });
    // The email must be confirmed: anybody can sign up with any address, and without the check the owner's
    // address, taken by somebody else before the owner confirms it, would open the admin page to them
    if (!user || user.emailVerifiedAt === null || !this.config.adminEmails.includes(user.email)) {
      throw new AppError('http.not_found', HttpStatus.NOT_FOUND);
    }
    return true;
  }
}
