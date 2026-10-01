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
      isProduction: false,
    });
  });

  it('reads and converts the values it is given', () => {
    const config = loadConfig({
      ...VALID_ENV,
      NODE_ENV: 'production',
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
