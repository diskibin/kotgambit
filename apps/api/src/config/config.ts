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
  /** How often the server looks for subscriptions to renew, 0 turns the check off. */
  BILLING_RENEWAL_CHECK_MINUTES: z.coerce
    .number()
    .int()
    .min(0)
    .default(DEFAULT_RENEWAL_CHECK_MINUTES),
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
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: string;
  databaseUrl: string;
  redisUrl: string;
  webUrl: string;
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
          }
        : null,
    trustProxy: values.TRUST_PROXY,
    jwtAccessSecret: values.JWT_ACCESS_SECRET,
    accessTokenTtlSeconds: values.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlDays: values.REFRESH_TOKEN_TTL_DAYS,
    corsOrigins: values.CORS_ORIGINS,
    isProduction: values.NODE_ENV === 'production',
  };
}
