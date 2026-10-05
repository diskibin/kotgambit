import { z } from 'zod';

/** In the order the sign-in buttons are shown. */
export const OAUTH_PROVIDERS = ['yandex', 'vk', 'google'] as const;
export const OAuthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProviderId = z.infer<typeof OAuthProviderSchema>;

/** The providers the server has keys for. A button is shown only for these. */
export const OAuthProvidersResponseSchema = z.object({
  providers: z.array(OAuthProviderSchema),
});
export type OAuthProvidersResponse = z.infer<typeof OAuthProvidersResponseSchema>;

/** The client the browser sign-in is for: the web app gets cookies, the mobile app a deep link. */
export const OAUTH_CLIENTS = ['web', 'mobile'] as const;
export const OAuthClientSchema = z.enum(OAUTH_CLIENTS);
export type OAuthClient = z.infer<typeof OAuthClientSchema>;

/** Why the sign-in in the browser did not finish, it comes back as the `error` parameter of the redirect. */
export const OAUTH_ERRORS = ['cancelled', 'failed', 'no_email', 'expired', 'taken'] as const;
export const OAuthErrorSchema = z.enum(OAUTH_ERRORS);
export type OAuthError = z.infer<typeof OAuthErrorSchema>;

/** The one-time code from the deep link of the mobile app, exchanged for tokens. */
export const OAuthExchangeRequestSchema = z.object({ code: z.string().min(1).max(200) });
export type OAuthExchangeRequest = z.infer<typeof OAuthExchangeRequestSchema>;

/**
 * Sent after the learner signed in to the account that already had the email of the provider.
 * The ticket comes back in the `link` parameter of the redirect.
 */
export const OAuthLinkRequestSchema = z.object({ ticket: z.string().min(1).max(200) });
export type OAuthLinkRequest = z.infer<typeof OAuthLinkRequestSchema>;

/** The ways of signing in an account has: the providers it is tied to, and whether it has a password. */
export const IdentitiesResponseSchema = z.object({
  identities: z.array(z.object({ provider: OAuthProviderSchema, email: z.string().nullable() })),
  hasPassword: z.boolean(),
});
export type IdentitiesResponse = z.infer<typeof IdentitiesResponseSchema>;

/** A signed-in learner ties one more provider to the account, the answer is the page to open in the browser. */
export const OAuthLinkStartRequestSchema = z.object({ client: OAuthClientSchema });
export type OAuthLinkStartRequest = z.infer<typeof OAuthLinkStartRequestSchema>;
export const OAuthLinkStartResponseSchema = z.object({ url: z.url() });
export type OAuthLinkStartResponse = z.infer<typeof OAuthLinkStartResponseSchema>;

/** Where the redirect after the browser sign-in goes, the parameters differ by the outcome. */
export const OAUTH_WEB_PATH = '/login';
export const OAUTH_MOBILE_CALLBACK = 'kotgambit://auth/callback';
