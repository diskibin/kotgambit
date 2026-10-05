import type { IdentitiesResponse, OAuthProviderId } from '@kotgambit/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The ways an account can be signed in to: the providers it is tied to and the password. */
@Injectable()
export class IdentitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<IdentitiesResponse> {
    const [identities, credential] = await Promise.all([
      this.prisma.identity.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { provider: true, email: true },
      }),
      this.prisma.credential.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    return { identities, hasPassword: credential !== null };
  }

  /** The last way in cannot be removed: the learner would lock themselves out. */
  async unlink(userId: string, provider: OAuthProviderId): Promise<void> {
    const { identities, hasPassword } = await this.list(userId);
    if (!identities.some((identity) => identity.provider === provider)) {
      throw new AppError('oauth.not_linked', HttpStatus.NOT_FOUND);
    }
    if (identities.length + (hasPassword ? 1 : 0) <= 1) {
      throw new AppError('oauth.last_method', HttpStatus.CONFLICT);
    }
    await this.prisma.identity.deleteMany({ where: { userId, provider } });
  }
}
