import {
  OAUTH_PROVIDERS,
  type OAuthClient,
  type OAuthError,
  type OAuthProviderId,
} from '@kotgambit/contracts';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../common/app-error.js';
import { CONFIG, type AppConfig } from '../../config/config.module.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { AuthService, type Session } from '../auth.service.js';
import {
  OAUTH_ADAPTERS,
  type OAuthAdapters,
  type OAuthProfile,
  type OAuthProviderAdapter,
} from './oauth-provider.js';

const UNIQUE_VIOLATION = 'P2002';
const MAX_DISPLAY_NAME_LENGTH = 40;
// The learner has to get through the login page of the provider in this time
const STATE_TTL_SECONDS = 10 * 60;
// The deep link hands the code to the app at once, so it lives only as long as that takes
const CODE_TTL_SECONDS = 60;
const TICKET_TTL_SECONDS = 10 * 60;
// A learner who taps "link" is sent to the browser at once
const INTENT_TTL_SECONDS = 5 * 60;
const RANDOM_BYTES = 32;

interface PendingSignIn {
  provider: OAuthProviderId;
  client: OAuthClient;
  codeVerifier: string;
  /** Hash of the value in the cookie of the browser that started the sign-in. */
  browser: string;
  /** Set when a signed-in learner ties the provider to their account instead of signing in. */
  linkUserId?: string;
}

interface PendingLink {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string;
}

/** `linking` tells where the learner goes back to: the profile after tying an account, the sign-in screen otherwise. */
export type SignInOutcome =
  | { client: OAuthClient; linking: false; kind: 'signed-in'; userId: string }
  | { client: OAuthClient; linking: false; kind: 'link'; ticket: string }
  | { client: OAuthClient; linking: true; kind: 'linked' }
  | { client: OAuthClient; linking: boolean; kind: 'error'; error: OAuthError };

const token = () => randomBytes(RANDOM_BYTES).toString('base64url');
const sha256 = (value: string) => createHash('sha256').update(value).digest();

/**
 * Sign-in with Google, Yandex and VK ID: the server sends the browser to the provider, takes the code
 * back and turns it into a profile. Secrets of the providers never leave the server (PLAN.md 6.7).
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly auth: AuthService,
    @Inject(OAUTH_ADAPTERS) private readonly adapters: OAuthAdapters,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** The providers the server has keys for, in the order of the buttons. */
  providers(): OAuthProviderId[] {
    return OAUTH_PROVIDERS.filter((id) => this.adapters.has(id));
  }

  /** The address the browser opens to tie one more provider to the account of a signed-in learner. */
  async startLinking(
    userId: string,
    provider: OAuthProviderId,
    client: OAuthClient,
  ): Promise<string> {
    this.adapter(provider);
    const intent = token();
    await this.redis.client.set(
      this.intentKey(intent),
      JSON.stringify({ userId }),
      'EX',
      INTENT_TTL_SECONDS,
    );
    return `${this.config.apiUrl}/auth/oauth/${provider}/start?${new URLSearchParams({ client, intent })}`;
  }

  /** Returns the page of the provider and the value for the cookie that ties the sign-in to this browser. */
  async begin(
    provider: OAuthProviderId,
    client: OAuthClient,
    intent?: string,
  ): Promise<{ url: string; browser: string }> {
    const adapter = this.adapter(provider);
    let linkUserId: string | undefined;
    if (intent) {
      const raw = await this.redis.client.getdel(this.intentKey(intent));
      if (!raw) throw new AppError('auth.link_expired', HttpStatus.BAD_REQUEST);
      linkUserId = (JSON.parse(raw) as { userId: string }).userId;
    }
    const state = token();
    const codeVerifier = token();
    const browser = token();
    const pending: PendingSignIn = {
      provider,
      client,
      codeVerifier,
      browser: sha256(browser).toString('hex'),
      ...(linkUserId ? { linkUserId } : {}),
    };
    await this.redis.client.set(
      this.stateKey(state),
      JSON.stringify(pending),
      'EX',
      STATE_TTL_SECONDS,
    );
    const url = adapter.buildAuthUrl({
      state,
      codeChallenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      redirectUri: this.redirectUri(provider),
    });
    return { url, browser };
  }

  /** Finishes what the provider's redirect started. It never throws, the learner is sent back with a reason. */
  async finish(
    provider: OAuthProviderId,
    query: Record<string, string>,
    browser: string | undefined,
  ): Promise<SignInOutcome> {
    const pending = await this.takeState(query['state']);
    // Without a valid state it is unknown who started this, the web app is the safe place to answer
    if (!pending || pending.provider !== provider || !this.sameBrowser(pending, browser)) {
      return {
        client: pending?.client ?? 'web',
        linking: pending?.linkUserId !== undefined,
        kind: 'error',
        error: 'expired',
      };
    }
    const { client } = pending;
    const linking = pending.linkUserId !== undefined;
    const code = query['code'];
    if (query['error'] || !code) {
      return {
        client,
        linking,
        kind: 'error',
        error: query['error'] === 'access_denied' ? 'cancelled' : 'failed',
      };
    }

    let profile: OAuthProfile;
    try {
      const adapter = this.adapter(provider);
      const accessToken = await adapter.exchangeCode({
        code,
        codeVerifier: pending.codeVerifier,
        redirectUri: this.redirectUri(provider),
        state: query['state'] ?? '',
        query,
      });
      profile = await adapter.fetchProfile(accessToken);
    } catch (error) {
      // The message of a provider error never carries the code or a token, only what failed
      this.logger.warn(
        `Sign-in with ${provider} failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return { client, linking, kind: 'error', error: 'failed' };
    }
    if (pending.linkUserId) {
      return { client, ...(await this.attach(pending.linkUserId, provider, profile)) };
    }
    return { client, linking: false, ...(await this.resolve(provider, profile)) };
  }

  /** The app swaps the one-time code of the deep link for a session. */
  async exchange(code: string): Promise<Session> {
    const raw = await this.redis.client.getdel(this.codeKey(code));
    if (!raw) throw new AppError('oauth.code_invalid', HttpStatus.UNAUTHORIZED);
    return this.auth.signInUser((JSON.parse(raw) as { userId: string }).userId);
  }

  async issueCode(userId: string): Promise<string> {
    const code = token();
    await this.redis.client.set(
      this.codeKey(code),
      JSON.stringify({ userId }),
      'EX',
      CODE_TTL_SECONDS,
    );
    return code;
  }

  /** Ties the provider account to the account the learner has just signed in to. */
  async link(userId: string, ticket: string): Promise<void> {
    const raw = await this.redis.client.getdel(this.ticketKey(ticket));
    const pending = raw ? (JSON.parse(raw) as PendingLink) : null;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    // The ticket was made for the account with this email, another account cannot take it
    if (!pending || user?.email !== pending.email) {
      throw new AppError('auth.link_expired', HttpStatus.BAD_REQUEST);
    }
    try {
      await this.prisma.identity.create({
        data: {
          userId,
          provider: pending.provider,
          providerUserId: pending.providerUserId,
          email: pending.email,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError('oauth.identity_taken', HttpStatus.CONFLICT);
      throw error;
    }
  }

  /** The learner is signed in already, so what the provider says about the email does not matter here. */
  private async attach(
    userId: string,
    provider: OAuthProviderId,
    profile: OAuthProfile,
  ): Promise<
    { linking: true; kind: 'linked' } | { linking: true; kind: 'error'; error: OAuthError }
  > {
    const key = { provider_providerUserId: { provider, providerUserId: profile.providerUserId } };
    const owner = await this.prisma.identity.findUnique({ where: key, select: { userId: true } });
    if (owner) {
      return owner.userId === userId
        ? { linking: true, kind: 'linked' }
        : { linking: true, kind: 'error', error: 'taken' };
    }
    try {
      await this.prisma.identity.create({
        data: { userId, provider, providerUserId: profile.providerUserId, email: profile.email },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return { linking: true, kind: 'error', error: 'taken' };
    }
    return { linking: true, kind: 'linked' };
  }

  private async resolve(
    provider: OAuthProviderId,
    profile: OAuthProfile,
  ): Promise<
    | { kind: 'signed-in'; userId: string }
    | { kind: 'link'; ticket: string }
    | { kind: 'error'; error: OAuthError }
  > {
    const key = { provider_providerUserId: { provider, providerUserId: profile.providerUserId } };
    const known = await this.prisma.identity.findUnique({ where: key, select: { userId: true } });
    if (known) return { kind: 'signed-in', userId: known.userId };

    // An address the provider does not vouch for must not open or join an account: anybody can type one
    if (!profile.email || !profile.emailVerified) return { kind: 'error', error: 'no_email' };

    const sameEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
      select: { id: true },
    });
    if (sameEmail) {
      // Not merged silently: the learner proves the account is theirs by signing in to it first
      const ticket = token();
      const pending: PendingLink = {
        provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
      };
      await this.redis.client.set(
        this.ticketKey(ticket),
        JSON.stringify(pending),
        'EX',
        TICKET_TTL_SECONDS,
      );
      return { kind: 'link', ticket };
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: profile.email,
          displayName: profile.displayName?.slice(0, MAX_DISPLAY_NAME_LENGTH) ?? null,
          emailVerifiedAt: new Date(),
          identities: {
            create: { provider, providerUserId: profile.providerUserId, email: profile.email },
          },
        },
      });
      return { kind: 'signed-in', userId: user.id };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Two sign-ins of the same person raced, the other one has made the account
      const winner = await this.prisma.identity.findUnique({
        where: key,
        select: { userId: true },
      });
      if (winner) return { kind: 'signed-in', userId: winner.userId };
      return { kind: 'error', error: 'failed' };
    }
  }

  private adapter(provider: OAuthProviderId): OAuthProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new AppError('oauth.unavailable', HttpStatus.NOT_FOUND);
    return adapter;
  }

  /** A state can be used once, so a replayed redirect finds nothing. */
  private async takeState(state: string | undefined): Promise<PendingSignIn | null> {
    if (!state) return null;
    const raw = await this.redis.client.getdel(this.stateKey(state));
    return raw ? (JSON.parse(raw) as PendingSignIn) : null;
  }

  /** The state travels through the browser, so it alone proves nothing: the cookie must match it. */
  private sameBrowser(pending: PendingSignIn, browser: string | undefined): boolean {
    if (!browser) return false;
    const expected = Buffer.from(pending.browser, 'hex');
    const actual = sha256(browser);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private redirectUri(provider: OAuthProviderId): string {
    return `${this.config.apiUrl}/auth/oauth/${provider}/callback`;
  }

  private intentKey = (intent: string) => `oauth:intent:${intent}`;
  private stateKey = (state: string) => `oauth:state:${state}`;
  private codeKey = (code: string) => `oauth:code:${code}`;
  private ticketKey = (ticket: string) => `oauth:link:${ticket}`;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION;
}
