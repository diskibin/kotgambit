import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

const VALID_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    expect(loadConfig(VALID_ENV)).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      logLevel: 'info',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      corsOrigins: [],
      adminEmails: [],
      trustProxy: false,
      webUrl: 'http://localhost:5173',
      smtpUrl: undefined,
      engine: null,
      isProduction: false,
    });
  });

  it('turns the engine on when a path is given and applies its defaults', () => {
    const { engine } = loadConfig({ ...VALID_ENV, ENGINE_PATH: '/usr/local/bin/stockfish' });
    expect(engine).toMatchObject({
      path: '/usr/local/bin/stockfish',
      threads: 1,
      hashMb: 64,
      queueLimit: 20,
      timeoutMs: 5000,
      retryAfterSeconds: 3,
    });
    expect(engine?.workers).toBeGreaterThanOrEqual(1);
  });

  it('reads the engine limits from the environment', () => {
    const { engine } = loadConfig({
      ...VALID_ENV,
      ENGINE_PATH: 'stockfish',
      ENGINE_WORKERS: '3',
      ENGINE_QUEUE_LIMIT: '8',
      ENGINE_TIMEOUT_MS: '2500',
    });
    expect(engine).toMatchObject({ workers: 3, queueLimit: 8, timeoutMs: 2500 });
  });

  it('rejects a non-positive engine limit', () => {
    expect(() =>
      loadConfig({ ...VALID_ENV, ENGINE_PATH: 'stockfish', ENGINE_WORKERS: '0' }),
    ).toThrow(/ENGINE_WORKERS/);
  });

  it('reads and converts the values it is given', () => {
    const config = loadConfig({
      ...VALID_ENV,
      NODE_ENV: 'production',
      SMTP_URL: 'smtp://mail.example.com:587',
      PORT: '8080',
      CORS_ORIGINS: 'https://a.example.com, https://b.example.com,',
    });
    expect(config.port).toBe(8080);
    expect(config.isProduction).toBe(true);
    expect(config.corsOrigins).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('reads the admin emails in lower case', () => {
    const config = loadConfig({
      ...VALID_ENV,
      ADMIN_EMAILS: ' Owner@Example.com, ,second@example.com',
    });
    expect(config.adminEmails).toEqual(['owner@example.com', 'second@example.com']);
  });

  it('fails when a required variable is missing', () => {
    expect(() => loadConfig({ JWT_ACCESS_SECRET: VALID_ENV.JWT_ACCESS_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short JWT secret without echoing it', () => {
    const secret = 'too-short-secret';
    try {
      loadConfig({ ...VALID_ENV, JWT_ACCESS_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toMatch(/JWT_ACCESS_SECRET/);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('requires a mail server in production', () => {
    expect(() => loadConfig({ ...VALID_ENV, NODE_ENV: 'production' })).toThrow(/SMTP_URL/);
  });

  it('strips a trailing slash from the web address', () => {
    expect(loadConfig({ ...VALID_ENV, WEB_URL: 'https://kotgambit.example.com/' }).webUrl).toBe(
      'https://kotgambit.example.com',
    );
  });

  it('knows the public address of the API for the redirects of the providers', () => {
    expect(loadConfig(VALID_ENV).apiUrl).toBe('http://localhost:3000');
    expect(loadConfig({ ...VALID_ENV, PORT: '4000' }).apiUrl).toBe('http://localhost:4000');
    expect(loadConfig({ ...VALID_ENV, API_URL: 'https://api.kotgambit.example/' }).apiUrl).toBe(
      'https://api.kotgambit.example',
    );
  });

  it('turns a provider on only when all of its keys are set', () => {
    expect(loadConfig(VALID_ENV).oauth).toEqual({});
    expect(
      loadConfig({ ...VALID_ENV, GOOGLE_CLIENT_ID: 'id', YANDEX_CLIENT_SECRET: 'secret' }).oauth,
    ).toEqual({});
    expect(
      loadConfig({
        ...VALID_ENV,
        GOOGLE_CLIENT_ID: 'g',
        GOOGLE_CLIENT_SECRET: 'gs',
        YANDEX_CLIENT_ID: 'y',
        YANDEX_CLIENT_SECRET: 'ys',
        VK_CLIENT_ID: 'v',
      }).oauth,
    ).toEqual({
      google: { clientId: 'g', clientSecret: 'gs' },
      yandex: { clientId: 'y', clientSecret: 'ys' },
      vk: { clientId: 'v' },
    });
  });

  it('passes the service key of VK ID on when it is set', () => {
    expect(
      loadConfig({ ...VALID_ENV, VK_CLIENT_ID: 'v', VK_SERVICE_TOKEN: 'svc' }).oauth.vk,
    ).toEqual({ clientId: 'v', serviceToken: 'svc' });
  });

  describe('the receipt of a payment', () => {
    const SHOP = {
      ...VALID_ENV,
      YOOKASSA_SHOP_ID: 'shop',
      YOOKASSA_SECRET_KEY: 'key',
      BILLING_PRICE_MONTH_RUB: '299',
      BILLING_PRICE_YEAR_RUB: '1990',
    };

    it('is off by default', () => {
      expect(loadConfig(SHOP).billing?.receipt).toBeNull();
    });

    it('is on with the VAT code "no VAT" when asked for', () => {
      expect(loadConfig({ ...SHOP, BILLING_RECEIPT: 'true' }).billing?.receipt).toEqual({
        vatCode: 1,
        taxSystemCode: null,
      });
    });

    it('takes the VAT code and the tax system that were set', () => {
      expect(
        loadConfig({
          ...SHOP,
          BILLING_RECEIPT: 'true',
          BILLING_VAT_CODE: '2',
          BILLING_TAX_SYSTEM_CODE: '3',
        }).billing?.receipt,
      ).toEqual({ vatCode: 2, taxSystemCode: 3 });
    });

    it('refuses a code that does not exist', () => {
      expect(() => loadConfig({ ...SHOP, BILLING_VAT_CODE: '9' })).toThrow(/BILLING_VAT_CODE/);
    });
  });

  it('requires REDIS_URL', () => {
    const rest = Object.fromEntries(
      Object.entries(VALID_ENV).filter(([key]) => key !== 'REDIS_URL'),
    );
    expect(() => loadConfig(rest)).toThrow(/REDIS_URL/);
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ ...VALID_ENV, PORT: '99999' })).toThrow(/PORT/);
  });
});
