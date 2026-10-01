import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  AuthResponseSchema,
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  VerifyEmailRequestSchema,
  HealthResponseSchema,
  LoginRequestSchema,
  RegisterRequestSchema,
} from './index.js';

const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
};

describe('RegisterRequestSchema', () => {
  it('normalizes the email to lower case', () => {
    const parsed = RegisterRequestSchema.parse({
      email: 'Cat@Example.COM',
      password: 'longenough',
    });
    expect(parsed.email).toBe('cat@example.com');
  });

  it('rejects a bad email, a short password and an empty name', () => {
    expect(RegisterRequestSchema.safeParse({ email: 'nope', password: 'longenough' }).success).toBe(
      false,
    );
    expect(
      RegisterRequestSchema.safeParse({ email: 'a@example.com', password: 'short' }).success,
    ).toBe(false);
    expect(
      RegisterRequestSchema.safeParse({
        email: 'a@example.com',
        password: 'longenough',
        displayName: '  ',
      }).success,
    ).toBe(false);
  });

  it('caps the password length', () => {
    const password = 'x'.repeat(129);
    expect(RegisterRequestSchema.safeParse({ email: 'a@example.com', password }).success).toBe(
      false,
    );
  });
});

describe('LoginRequestSchema', () => {
  it('does not enforce the password policy', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('requires a password', () => {
    expect(LoginRequestSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(
      false,
    );
  });
});

describe('AuthResponseSchema', () => {
  it('accepts a valid response', () => {
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 900, user: USER }).success,
    ).toBe(true);
  });

  it('rejects a non-positive lifetime and a bad user id', () => {
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 0, user: USER }).success,
    ).toBe(false);
    expect(
      AuthResponseSchema.safeParse({ accessToken: 't', expiresIn: 900, user: { ...USER, id: '1' } })
        .success,
    ).toBe(false);
  });
});

describe('password reset schemas', () => {
  it('normalizes the email of a reset request', () => {
    expect(ForgotPasswordRequestSchema.parse({ email: 'Cat@Example.com' }).email).toBe(
      'cat@example.com',
    );
  });

  it('applies the password rules to the new password', () => {
    expect(ResetPasswordRequestSchema.safeParse({ token: 't', password: 'short' }).success).toBe(
      false,
    );
    expect(
      ResetPasswordRequestSchema.safeParse({ token: 't', password: 'long-enough' }).success,
    ).toBe(true);
    expect(
      ResetPasswordRequestSchema.safeParse({ token: '', password: 'long-enough' }).success,
    ).toBe(false);
  });

  it('needs a token to verify an email', () => {
    expect(VerifyEmailRequestSchema.safeParse({ token: 'abc' }).success).toBe(true);
    expect(VerifyEmailRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('ApiErrorSchema', () => {
  it('requires a code and a message', () => {
    expect(
      ApiErrorSchema.safeParse({ code: 'auth.invalid', message: 'Не получилось войти' }).success,
    ).toBe(true);
    expect(ApiErrorSchema.safeParse({ code: 'auth.invalid' }).success).toBe(false);
  });
});

describe('HealthResponseSchema', () => {
  it('accepts only ok', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
    expect(HealthResponseSchema.safeParse({ status: 'down' }).success).toBe(false);
  });
});
