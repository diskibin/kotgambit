import type { User } from '@kotgambit/contracts';
import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { CurrentUserId } from '../auth/current-user.decorator.js';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('users')
@UseGuards(AccessTokenGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUserId() userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // A valid token for a deleted account is as good as no token
    if (!user) throw new AppError('auth.unauthorized', HttpStatus.UNAUTHORIZED);
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }
}
