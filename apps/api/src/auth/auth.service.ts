import type { AuthResponse, LoginRequest, RegisterRequest } from '@kotgambit/contracts';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppError } from '../common/app-error.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountService } from './account.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
const UNIQUE_VIOLATION = 'P2002';

export interface Session {
  /** The response body, without the refresh token. */
  auth: Omit<AuthResponse, 'refreshToken'>;
  refreshToken: string;
  refreshExpiresAt: Date;
}

type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: Date | null;
};

// The contract normalizes the email on the way in, so these are the parsed values
type Registration = Omit<RegisterRequest, 'email'> & { email: string };
type Credentials = Omit<LoginRequest, 'email'> & { email: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly account: AccountService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  async register({ email, password, displayName }: Registration): Promise<Session> {
    const passwordHash = await this.passwords.hash(password);
    try {
      const user = await this.prisma.user.create({
        data: { email, displayName: displayName ?? null, credential: { create: { passwordHash } } },
      });
      // Not awaited: a mail outage must not fail the sign-up, the user can ask for the email again
      void this.account.sendVerification(user);
      return await this.startSession(user, randomUUID());
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        throw new AppError('auth.email_taken', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async login({ email, password }: Credentials): Promise<Session> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { credential: true },
    });
    const valid = await this.passwords.verify(user?.credential?.passwordHash ?? null, password);
    if (!user || !valid) throw new AppError('auth.invalid_credentials', HttpStatus.UNAUTHORIZED);
    return this.startSession(user, randomUUID());
  }

  /**
   * Swaps a refresh token for a new pair. A token can be used once: presenting an already used one
   * means it was copied, so the whole family is revoked and the real owner has to sign in again.
   */
  async refresh(presented: string | undefined): Promise<Session> {
    const expired = new AppError('auth.session_expired', HttpStatus.UNAUTHORIZED);
    if (!presented) throw expired;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(presented) },
      include: { user: true },
    });
    if (!stored) throw expired;

    // Atomic: of two concurrent uses of the same token only one gets to revoke it
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(stored.familyId);
      throw expired;
    }
    if (stored.expiresAt <= new Date()) throw expired;

    return this.startSession(stored.user, stored.familyId);
  }

  async logout(presented: string | undefined): Promise<void> {
    if (!presented) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(presented) },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  private revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async startSession(user: UserRecord, familyId: string): Promise<Session> {
    const refreshToken = this.tokens.generateOpaqueToken();
    const refreshExpiresAt = new Date(Date.now() + this.config.refreshTokenTtlDays * MS_IN_DAY);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: this.tokens.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });
    return {
      auth: {
        accessToken: await this.tokens.signAccessToken(user.id),
        expiresIn: this.config.accessTokenTtlSeconds,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerifiedAt !== null,
        },
      },
      refreshToken,
      refreshExpiresAt,
    };
  }
}
