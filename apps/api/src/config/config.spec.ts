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
