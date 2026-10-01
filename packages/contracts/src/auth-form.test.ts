import { describe, expect, it } from 'vitest';
import { apiErrorOf, checkEmail, checkPassword } from './auth-form.js';

describe('checkEmail', () => {
  it('accepts a normal address', () => {
    expect(checkEmail('cat@example.com')).toBeNull();
  });

  it('points out a missing @ separately from other mistakes', () => {
    expect(checkEmail('dima.mail.ru')).toBe('noAt');
    expect(checkEmail('dima@')).toBe('invalid');
    expect(checkEmail('')).toBe('noAt');
  });
});

describe('checkPassword', () => {
  it('requires something to be typed', () => {
    expect(checkPassword('', 'login')).toBe('required');
    expect(checkPassword('', 'register')).toBe('required');
  });

  it('enforces the length only when signing up', () => {
    expect(checkPassword('short', 'login')).toBeNull();
    expect(checkPassword('short', 'register')).toBe('tooShort');
    expect(checkPassword('long-enough', 'register')).toBeNull();
  });
});

describe('apiErrorOf', () => {
  it('reads the common error format from a failed request', () => {
    const error = { status: 401, data: { code: 'auth.invalid_credentials', message: 'Не вышло' } };
    expect(apiErrorOf(error)).toEqual({ code: 'auth.invalid_credentials', message: 'Не вышло' });
  });

  it('returns null for anything else', () => {
    expect(apiErrorOf(null)).toBeNull();
    expect(apiErrorOf({ status: 'FETCH_ERROR', error: 'boom' })).toBeNull();
    expect(apiErrorOf({ status: 500, data: 'plain text' })).toBeNull();
  });
});
