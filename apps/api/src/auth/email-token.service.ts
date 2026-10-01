import { Injectable } from '@nestjs/common';
import type { EmailTokenKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class EmailTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Creates a link token and invalidates the unused ones of the same kind, so only the latest email works. */
  async issue(userId: string, kind: EmailTokenKind, ttlMs: number): Promise<string> {
    const token = this.tokens.generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.emailToken.deleteMany({ where: { userId, kind, usedAt: null } }),
      this.prisma.emailToken.create({
        data: {
          userId,
          kind,
          tokenHash: this.tokens.hashToken(token),
          expiresAt: new Date(Date.now() + ttlMs),
        },
      }),
    ]);
    return token;
  }

  /** Spends the token and returns its owner, or null when it is unknown, expired, used or of another kind. */
  async consume(token: string, kind: EmailTokenKind): Promise<string | null> {
    const tokenHash = this.tokens.hashToken(token);
    // Atomic, so that two clicks on the same link cannot both succeed
    const claimed = await this.prisma.emailToken.updateMany({
      where: { tokenHash, kind, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;
    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash } });
    return row?.userId ?? null;
  }
}
