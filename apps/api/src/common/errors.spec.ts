import { ApiErrorSchema, RegisterRequestSchema } from '@kotgambit/contracts';
import { Body, Controller, Get, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import { setupApp } from '../app.setup.js';
import { loadConfig } from '../config/config.js';
import { AppError } from './app-error.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

@Controller('test-errors')
class ThrowingController {
  @Get('boom')
  boom(): never {
    throw new Error('database password is hunter2');
  }

  @Get('app-error')
  appError(): never {
    throw new AppError('auth.invalid_credentials', HttpStatus.UNAUTHORIZED);
  }

  @Post('register')
  @UsePipes(new ZodValidationPipe(RegisterRequestSchema))
  register(@Body() body: unknown): unknown {
    return body;
  }
}

describe('error handling', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThrowingController],
    }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await setupApp(app, loadConfig(process.env));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  it('hides the cause of an unexpected failure', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-errors/boom' });
    expect(res.statusCode).toBe(500);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.code).toBe('server.internal');
    expect(res.body).not.toContain('hunter2');
  });

  it('maps an AppError to its code, status and message', async () => {
    const res = await app.inject({ method: 'GET', url: '/test-errors/app-error' });
    expect(res.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(res.json())).toMatchObject({
      code: 'auth.invalid_credentials',
      message: 'Не получилось войти. Проверь почту и пароль.',
    });
  });

  it('answers 404 in the common format', async () => {
    const res = await app.inject({ method: 'GET', url: '/no-such-route' });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).code).toBe('http.not_found');
  });

  it('rejects an invalid body with the paths but without the values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-errors/register',
      payload: { email: 'not-an-email', password: 'short' },
    });
    expect(res.statusCode).toBe(400);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.code).toBe('validation.failed');
    expect(body.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
    );
    expect(res.body).not.toContain('not-an-email');
    expect(res.body).not.toContain('short');
  });

  it('accepts a valid body and normalizes it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/test-errors/register',
      payload: { email: 'Cat@Example.com', password: 'longenough' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: 'cat@example.com' });
  });

  it('sets security headers', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
