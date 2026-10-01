import {
  CLIENT_HEADER,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  MOBILE_CLIENT,
  RefreshRequestSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  VerifyEmailRequestSchema,
  type AuthResponse,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CONFIG, type AppConfig } from '../config/config.module.js';
import { RateLimit, RateLimitGuard } from '../rate-limit/rate-limit.guard.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AccountService } from './account.service.js';
import { AUTH_LIMITS } from './auth.limits.js';
import { CurrentUserId } from './current-user.decorator.js';
import { AuthService, type Session } from './auth.service.js';

export const REFRESH_COOKIE = 'kg_refresh';
// The browser sends the cookie to the auth routes only
const REFRESH_COOKIE_PATH = '/auth';

type Register = z.output<typeof RegisterRequestSchema>;
type Login = z.output<typeof LoginRequestSchema>;
type Refresh = z.output<typeof RefreshRequestSchema>;
type Forgot = z.output<typeof ForgotPasswordRequestSchema>;
type Reset = z.output<typeof ResetPasswordRequestSchema>;
type Verify = z.output<typeof VerifyEmailRequestSchema>;

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @RateLimit(AUTH_LIMITS.registerPerIp)
  async register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: Register,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    return this.deliver(await this.auth.register(body), request, reply);
  }

  @Post('login')
  @RateLimit(AUTH_LIMITS.loginPerIp, AUTH_LIMITS.loginPerEmail)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: Login,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    return this.deliver(await this.auth.login(body), request, reply);
  }

  @Post('refresh')
  @RateLimit(AUTH_LIMITS.refreshPerIp)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshRequestSchema.optional())) body: Refresh | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const presented = body?.refreshToken ?? request.cookies[REFRESH_COOKIE];
    return this.deliver(await this.auth.refresh(presented), request, reply);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(RefreshRequestSchema.optional())) body: Refresh | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(body?.refreshToken ?? request.cookies[REFRESH_COOKIE]);
    void reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Post('email/verify')
  @RateLimit(AUTH_LIMITS.emailLinkPerIp)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyEmailRequestSchema)) body: Verify,
  ): Promise<void> {
    await this.account.verifyEmail(body.token);
  }

  @Post('email/resend')
  @UseGuards(AccessTokenGuard)
  @RateLimit(AUTH_LIMITS.resendVerificationPerIp)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@CurrentUserId() userId: string): Promise<void> {
    await this.account.resendVerification(userId);
  }

  @Post('password/forgot')
  @RateLimit(AUTH_LIMITS.forgotPasswordPerIp, AUTH_LIMITS.forgotPasswordPerEmail)
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) body: Forgot): void {
    // Not awaited: the answer must not depend on whether the address has an account
    void this.account.requestPasswordReset(body.email);
  }

  @Post('password/reset')
  @RateLimit(AUTH_LIMITS.emailLinkPerIp)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: Reset,
  ): Promise<void> {
    await this.account.resetPassword(body.token, body.password);
  }

  /** Web gets the refresh token as an httpOnly cookie, the mobile app in the body. */
  private deliver(session: Session, request: FastifyRequest, reply: FastifyReply): AuthResponse {
    if (request.headers[CLIENT_HEADER] === MOBILE_CLIENT) {
      return { ...session.auth, refreshToken: session.refreshToken };
    }
    void reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return session.auth;
  }
}
