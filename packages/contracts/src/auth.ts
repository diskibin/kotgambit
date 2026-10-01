import { z } from 'zod';

/**
 * Clients that cannot use the httpOnly refresh cookie (the mobile app) send this header
 * and get the refresh token in the response body instead.
 */
export const CLIENT_HEADER = 'x-kotgambit-client';
export const MOBILE_CLIENT = 'mobile';

const MIN_PASSWORD_LENGTH = 8;
// argon2 hashes any length, the cap only protects the server from huge request bodies
const MAX_PASSWORD_LENGTH = 128;
const MAX_DISPLAY_NAME_LENGTH = 40;

const EmailSchema = z
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
const PasswordSchema = z.string().min(MIN_PASSWORD_LENGTH).max(MAX_PASSWORD_LENGTH);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().trim().min(1).max(MAX_DISPLAY_NAME_LENGTH).optional(),
});
export type RegisterRequest = z.input<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  // No length rules here: a wrong password must not reveal the password policy
  password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
});
export type LoginRequest = z.input<typeof LoginRequestSchema>;

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  emailVerified: z.boolean(),
});
export type User = z.infer<typeof UserSchema>;

/**
 * On web the refresh token travels in an httpOnly cookie. Clients that cannot use cookies
 * (the mobile app, which keeps it in the Keychain/Keystore) get it in `refreshToken` instead.
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  /** Lifetime of the access token in seconds. */
  expiresIn: z.number().int().positive(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/** Cookie clients send an empty body. */
export const RefreshRequestSchema = z.object({ refreshToken: z.string().min(1).optional() });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });
export type ForgotPasswordRequest = z.input<typeof ForgotPasswordRequestSchema>;

/** `token` comes from the link in the email. */
export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  password: PasswordSchema,
});
export type ResetPasswordRequest = z.input<typeof ResetPasswordRequestSchema>;

export const VerifyEmailRequestSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailRequest = z.input<typeof VerifyEmailRequestSchema>;
