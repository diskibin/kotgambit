import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { AppError } from '../common/app-error.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { MailService, RESET_PASSWORD_TTL_MS, VERIFY_EMAIL_TTL_MS } from '../mail/mail.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailTokenService } from './email-token.service.js';
import { PasswordService } from './password.service.js';

/** Everything that happens through a link in an email: confirming the address and choosing a new password. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly emailTokens: EmailTokenService,
    private readonly mail: MailService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** Never throws: callers send the email on the side and the user can ask for another one. */
  async sendVerification(user: { id: string; email: string }): Promise<void> {
    try {
      const token = await this.emailTokens.issue(user.id, 'verify_email', VERIFY_EMAIL_TTL_MS);
      await this.mail.sendVerification(user.email, `${this.config.webUrl}/verify?token=${token}`);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerifiedAt) return;
    await this.sendVerification(user);
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.emailTokens.consume(token, 'verify_email');
    if (!userId) throw new AppError('auth.link_expired', HttpStatus.BAD_REQUEST);
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  /**
   * Answers the same way for known and unknown addresses, so that the form cannot be used
   * to find out who has an account. The email itself is sent after the answer.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    try {
      const token = await this.emailTokens.issue(user.id, 'reset_password', RESET_PASSWORD_TTL_MS);
      await this.mail.sendPasswordReset(user.email, `${this.config.webUrl}/reset?token=${token}`);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.emailTokens.consume(token, 'reset_password');
    if (!userId) throw new AppError('auth.link_expired', HttpStatus.BAD_REQUEST);

    const passwordHash = await this.passwords.hash(password);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.credential.upsert({
        where: { userId },
        create: { userId, passwordHash },
        update: { passwordHash },
      }),
      // Following the link proves control of the mailbox
      this.prisma.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      }),
      // Whoever knew the old password, or stole a session, is signed out everywhere
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }
}
