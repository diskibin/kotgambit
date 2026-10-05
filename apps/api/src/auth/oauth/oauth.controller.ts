import {
  OAUTH_MOBILE_CALLBACK,
  OAUTH_WEB_PATH,
  OAuthClientSchema,
  OAuthExchangeRequestSchema,
  OAuthLinkRequestSchema,
  OAuthLinkStartRequestSchema,
  OAuthProviderSchema,
  type AuthResponse,
  type OAuthClient,
  type OAuthProviderId,
  type OAuthLinkStartResponse,
  type OAuthProvidersResponse,
} from '@kotgambit/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { AppError } from '../../common/app-error.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CONFIG, type AppConfig } from '../../config/config.module.js';
import { RateLimit, RateLimitGuard } from '../../rate-limit/rate-limit.guard.js';
import { AccessTokenGuard } from '../access-token.guard.js';
import { AuthService } from '../auth.service.js';
import { AUTH_LIMITS } from '../auth.limits.js';
import { CurrentUserId } from '../current-user.decorator.js';
import { setRefreshCookie } from '../refresh-cookie.js';
import { OAuthService, type SignInOutcome } from './oauth.service.js';

// Ties the sign-in to the browser that started it, the provider's redirect comes back to the same one
const BROWSER_COOKIE = 'kg_oauth';
const BROWSER_COOKIE_PATH = '/auth/oauth';
const BROWSER_COOKIE_SECONDS = 10 * 60;
const SIGNED_IN_PATH = '/learn';
const PROFILE_PATH = '/profile';

type Exchange = z.output<typeof OAuthExchangeRequestSchema>;
type Link = z.output<typeof OAuthLinkRequestSchema>;
type LinkStart = z.output<typeof OAuthLinkStartRequestSchema>;

function providerOf(value: string): OAuthProviderId {
  const parsed = OAuthProviderSchema.safeParse(value);
  if (!parsed.success) throw new AppError('oauth.unavailable', HttpStatus.NOT_FOUND);
  return parsed.data;
}

/** Fastify gives a string or a list, the sign-in cares for single strings only. */
function stringsOf(query: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

@Controller('auth/oauth')
@UseGuards(RateLimitGuard)
export class OAuthController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  @Get('providers')
  providers(): OAuthProvidersResponse {
    return { providers: this.oauth.providers() };
  }

  @Get(':provider/start')
  @RateLimit(AUTH_LIMITS.oauthStartPerIp)
  async start(
    @Param('provider') provider: string,
    @Query('client') clientParam: string | undefined,
    @Query('intent') intent: string | undefined,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const client = OAuthClientSchema.safeParse(clientParam);
    const { url, browser } = await this.oauth.begin(
      providerOf(provider),
      client.success ? client.data : 'web',
      intent,
    );
    void reply.setCookie(BROWSER_COOKIE, browser, {
      httpOnly: true,
      secure: this.config.isProduction,
      // The redirect of the provider is a top-level navigation, so Lax still sends the cookie with it
      sameSite: 'lax',
      path: BROWSER_COOKIE_PATH,
      maxAge: BROWSER_COOKIE_SECONDS,
    });
    void reply.redirect(url, HttpStatus.FOUND);
  }

  @Get(':provider/callback')
  @RateLimit(AUTH_LIMITS.oauthCallbackPerIp)
  async callback(
    @Param('provider') provider: string,
    @Query() query: Record<string, unknown>,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const id = providerOf(provider);
    const outcome = await this.oauth.finish(id, stringsOf(query), request.cookies[BROWSER_COOKIE]);
    void reply.clearCookie(BROWSER_COOKIE, { path: BROWSER_COOKIE_PATH });
    void reply.redirect(await this.destination(outcome, id, reply), HttpStatus.FOUND);
  }

  /** The app trades the one-time code of the deep link for tokens, they never travel in a URL. */
  @Post('exchange')
  @RateLimit(AUTH_LIMITS.oauthExchangePerIp)
  @HttpCode(HttpStatus.OK)
  async exchange(
    @Body(new ZodValidationPipe(OAuthExchangeRequestSchema)) body: Exchange,
  ): Promise<AuthResponse> {
    const session = await this.oauth.exchange(body.code);
    return { ...session.auth, refreshToken: session.refreshToken };
  }

  /** A signed-in learner ties one more provider to the account: the browser cannot send the token, so it gets an intent. */
  @Post(':provider/link-start')
  @UseGuards(AccessTokenGuard)
  @RateLimit(AUTH_LIMITS.oauthLinkPerUser)
  @HttpCode(HttpStatus.OK)
  async linkStart(
    @CurrentUserId() userId: string,
    @Param('provider') provider: string,
    @Body(new ZodValidationPipe(OAuthLinkStartRequestSchema)) body: LinkStart,
  ): Promise<OAuthLinkStartResponse> {
    return { url: await this.oauth.startLinking(userId, providerOf(provider), body.client) };
  }

  @Post('link')
  @UseGuards(AccessTokenGuard)
  @RateLimit(AUTH_LIMITS.oauthExchangePerIp)
  @HttpCode(HttpStatus.NO_CONTENT)
  async link(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(OAuthLinkRequestSchema)) body: Link,
  ): Promise<void> {
    await this.oauth.link(userId, body.ticket);
  }

  private async destination(
    outcome: SignInOutcome,
    provider: OAuthProviderId,
    reply: FastifyReply,
  ): Promise<string> {
    const params = new URLSearchParams();
    if (outcome.kind === 'error') params.set(this.errorParam(outcome.client), outcome.error);
    if (outcome.kind === 'linked') params.set('linked', provider);
    if (outcome.kind === 'link') {
      params.set('link', outcome.ticket);
      params.set('provider', provider);
    }
    if (outcome.kind === 'signed-in') {
      if (outcome.client === 'mobile') {
        params.set('code', await this.oauth.issueCode(outcome.userId));
      } else {
        setRefreshCookie(
          reply,
          await this.auth.signInUser(outcome.userId),
          this.config.isProduction,
        );
        return `${this.config.webUrl}${SIGNED_IN_PATH}`;
      }
    }
    // Tying an account ends in the profile, where it was started, the other outcomes on the login page
    const webPath = outcome.linking ? PROFILE_PATH : OAUTH_WEB_PATH;
    const base =
      outcome.client === 'mobile' ? OAUTH_MOBILE_CALLBACK : `${this.config.webUrl}${webPath}`;
    return `${base}?${params.toString()}`;
  }

  private errorParam(client: OAuthClient): string {
    return client === 'mobile' ? 'error' : 'oauth_error';
  }
}
