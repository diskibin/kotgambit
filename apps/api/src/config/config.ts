import { availableParallelism } from 'node:os';
import { z } from 'zod';

const SECONDS_IN_MINUTE = 60;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * SECONDS_IN_MINUTE;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
// A short HMAC secret is brute-forceable, 32 characters is the floor for HS256
const MIN_JWT_SECRET_LENGTH = 32;

const DEFAULT_ENGINE_HASH_MB = 64;
const DEFAULT_ENGINE_QUEUE_LIMIT = 20;
const DEFAULT_ENGINE_TIMEOUT_MS = 5000;
const DEFAULT_ENGINE_RETRY_AFTER_SECONDS = 3;
const DEFAULT_ENGINE_CACHE_TTL_SECONDS = 24 * 60 * SECONDS_IN_MINUTE;
// One core is left for the API itself and the database, the rest goes to engines
const DEFAULT_ENGINE_WORKERS = Math.max(1, availableParallelism() - 1);

const DEFAULT_RENEWAL_CHECK_MINUTES = 60;
const DEFAULT_REMINDERS_CHECK_MINUTES = 60;
// 15:00 UTC is 18:00 in Moscow, when most people have finished their day
const DEFAULT_REMINDERS_HOUR_UTC = 15;
const LAST_HOUR = 23;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Path to the Stockfish binary. Without it the engine is off and analysis answers 503. */
  ENGINE_PATH: z.string().min(1).optional(),
  ENGINE_WORKERS: z.coerce.number().int().positive().default(DEFAULT_ENGINE_WORKERS),
  ENGINE_THREADS: z.coerce.number().int().positive().default(1),
  ENGINE_HASH_MB: z.coerce.number().int().positive().default(DEFAULT_ENGINE_HASH_MB),
  ENGINE_QUEUE_LIMIT: z.coerce.number().int().positive().default(DEFAULT_ENGINE_QUEUE_LIMIT),
  ENGINE_TIMEOUT_MS: z.coerce.number().int().positive().default(DEFAULT_ENGINE_TIMEOUT_MS),
  ENGINE_RETRY_AFTER_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ENGINE_RETRY_AFTER_SECONDS),
  ENGINE_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ENGINE_CACHE_TTL_SECONDS),
  /** Where the web app lives, the links in emails point there. */
  WEB_URL: z.url().default('http://localhost:5173'),
  /** The public address of this API. The providers send the browser back to it after the sign-in. */
  API_URL: z.url().optional(),
  /** Sign-in with a provider is on for the ones whose keys are set, see 6.7 of the plan. */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  YANDEX_CLIENT_ID: z.string().min(1).optional(),
  YANDEX_CLIENT_SECRET: z.string().min(1).optional(),
  VK_CLIENT_ID: z.string().min(1).optional(),
  /** The service key of VK ID, sent with the code when the app is registered as a confidential one. */
  VK_SERVICE_TOKEN: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).default('Кот Гамбит <noreply@localhost>'),
  /** SMTP connection string such as smtp://user:pass@host:587. Without it emails are only written to the log. */
  SMTP_URL: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
  REFRESH_TOKEN_TTL_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_REFRESH_TOKEN_TTL_DAYS),
  /** Set when a reverse proxy sits in front, so that the client address comes from X-Forwarded-For. */
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** The YooKassa shop. Billing is on only when both of these and both prices are set. */
  YOOKASSA_SHOP_ID: z.string().min(1).optional(),
  YOOKASSA_SECRET_KEY: z.string().min(1).optional(),
  /** What Premium costs, whole rubles. */
  BILLING_PRICE_MONTH_RUB: z.coerce.number().int().positive().optional(),
  BILLING_PRICE_YEAR_RUB: z.coerce.number().int().positive().optional(),
  /**
   * Send a receipt (54-FZ) with every payment. Turn it on when the shop is connected to "Чеки от ЮKassa":
   * such a shop refuses a payment without one.
   */
  BILLING_RECEIPT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** The VAT code of the receipt, 1 is "no VAT" (what a self-employed or a simplified tax payer uses). */
  BILLING_VAT_CODE: z.coerce.number().int().min(1).max(6).default(1),
  /** The tax system of the receipt (1 to 6), needed when the shop has several of them. */
  BILLING_TAX_SYSTEM_CODE: z.coerce.number().int().min(1).max(6).optional(),
  /** How often the server looks for subscriptions to renew, 0 turns the check off. */
  BILLING_RENEWAL_CHECK_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .default(DEFAULT_RENEWAL_CHECK_MINUTES),
  /** How often the server looks for learners to remind, 0 turns the reminders off. */
  REMINDERS_CHECK_MINUTES: z.coerce.number().int().min(0).default(DEFAULT_REMINDERS_CHECK_MINUTES),
  /** The hour of the day (UTC) when reminders go out. */
  REMINDERS_HOUR_UTC: z.coerce
    .number()
    .int()
    .min(0)
    .max(LAST_HOUR)
    .default(DEFAULT_REMINDERS_HOUR_UTC),
  /** Comma-separated emails of the people who may open the admin page. Empty: nobody can. */
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** Comma-separated list of origins allowed to call the API from a browser. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export interface EngineConfig {
  path: string;
  workers: number;
  /** UCI `Threads` per process. Several single-threaded workers serve many users better than one wide one. */
  threads: number;
  hashMb: number;
  queueLimit: number;
  timeoutMs: number;
  retryAfterSeconds: number;
  cacheTtlSeconds: number;
}

export interface BillingConfig {
  shopId: string;
  secretKey: string;
  /** Whole rubles per plan. */
  prices: { month: number; year: number };
  renewalCheckMinutes: number;
  /** `null` when payments go without a receipt. */
  receipt: { vatCode: number; taxSystemCode: number | null } | null;
}

export interface OAuthConfig {
  /** Google and Yandex need the secret for the code exchange. */
  google?: { clientId: string; clientSecret: string };
  yandex?: { clientId: string; clientSecret: string };
  /** VK ID works with PKCE alone, the service key is for an app registered as a confidential one. */
  vk?: { clientId: string; serviceToken?: string };
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  databaseUrl: string;
  redisUrl: string;
  webUrl: string;
  /** Without trailing slash. */
  apiUrl: string;
  /** The providers that have keys, the others answer 404. */
  oauth: OAuthConfig;
  mailFrom: string;
  smtpUrl: string | undefined;
  /** `null` when ENGINE_PATH is not set. */
  engine: EngineConfig | null;
  /** `null` when the shop or the prices are not set: Premium cannot be bought then. */
  billing: BillingConfig | null;
  trustProxy: boolean;
  jwtAccessSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  corsOrigins: string[];
  /** In lower case, like the emails of the users. */
  adminEmails: string[];
  reminders: { checkMinutes: number; hourUtc: number };
  isProduction: boolean;
}

export class ConfigError extends Error {}

/** Validates the environment once at startup, so that a missing variable stops the app right away. */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Only names and reasons: the values may be secrets and must not reach the logs
    const problems = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new ConfigError(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  const values = parsed.data;
  // A password reset that only reaches the log would leave users locked out in production
  if (values.NODE_ENV === 'production' && !values.SMTP_URL) {
    throw new ConfigError('Invalid environment configuration:\nSMTP_URL: required in production');
  }
  return {
    nodeEnv: values.NODE_ENV,
    port: values.PORT,
    logLevel: values.LOG_LEVEL,
    databaseUrl: values.DATABASE_URL,
    redisUrl: values.REDIS_URL,
    webUrl: values.WEB_URL.replace(/\/$/, ''),
    apiUrl: (values.API_URL ?? `http://localhost:${values.PORT}`).replace(/\/$/, ''),
    oauth: {
      ...(values.GOOGLE_CLIENT_ID && values.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: values.GOOGLE_CLIENT_ID,
              clientSecret: values.GOOGLE_CLIENT_SECRET,
            },
          }
        : {}),
      ...(values.YANDEX_CLIENT_ID && values.YANDEX_CLIENT_SECRET
        ? {
            yandex: {
              clientId: values.YANDEX_CLIENT_ID,
              clientSecret: values.YANDEX_CLIENT_SECRET,
            },
          }
        : {}),
      ...(values.VK_CLIENT_ID
        ? {
            vk: {
              clientId: values.VK_CLIENT_ID,
              ...(values.VK_SERVICE_TOKEN ? { serviceToken: values.VK_SERVICE_TOKEN } : {}),
            },
          }
        : {}),
    },
    mailFrom: values.MAIL_FROM,
    smtpUrl: values.SMTP_URL,
    engine: values.ENGINE_PATH
      ? {
          path: values.ENGINE_PATH,
          workers: values.ENGINE_WORKERS,
          threads: values.ENGINE_THREADS,
          hashMb: values.ENGINE_HASH_MB,
          queueLimit: values.ENGINE_QUEUE_LIMIT,
          timeoutMs: values.ENGINE_TIMEOUT_MS,
          retryAfterSeconds: values.ENGINE_RETRY_AFTER_SECONDS,
          cacheTtlSeconds: values.ENGINE_CACHE_TTL_SECONDS,
        }
      : null,
    billing:
      values.YOOKASSA_SHOP_ID &&
      values.YOOKASSA_SECRET_KEY &&
      values.BILLING_PRICE_MONTH_RUB &&
      values.BILLING_PRICE_YEAR_RUB
        ? {
            shopId: values.YOOKASSA_SHOP_ID,
            secretKey: values.YOOKASSA_SECRET_KEY,
            prices: { month: values.BILLING_PRICE_MONTH_RUB, year: values.BILLING_PRICE_YEAR_RUB },
            renewalCheckMinutes: values.BILLING_RENEWAL_CHECK_MINUTES,
            receipt: values.BILLING_RECEIPT
              ? {
                  vatCode: values.BILLING_VAT_CODE,
                  taxSystemCode: values.BILLING_TAX_SYSTEM_CODE ?? null,
                }
              : null,
          }
        : null,
    trustProxy: values.TRUST_PROXY,
    jwtAccessSecret: values.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: values.REFRESH_TOKEN_TTL_DAYS,
    corsOrigins: values.CORS_ORIGINS,
    adminEmails: values.ADMIN_EMAILS,
    reminders: { checkMinutes: values.REMINDERS_CHECK_MINUTES, hourUtc: values.REMINDERS_HOUR_UTC },
    isProduction: values.NODE_ENV === 'production',
  };
}
