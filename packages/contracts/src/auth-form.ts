import { z } from 'zod';
import { ApiErrorSchema, type ApiError } from './errors.js';

export type EmailProblem = 'noAt' | 'invalid' | 'taken';
export type PasswordProblem = 'required' | 'tooShort' | 'wrong';

// Keep in line with the password rule of RegisterRequestSchema
const MIN_PASSWORD_LENGTH = 8;

export function checkEmail(email: string): EmailProblem | null {
  if (!email.includes('@')) return 'noAt';
  return z.email().safeParse(email).success ? null : 'invalid';
}

export function checkPassword(
  password: string,
  mode: 'login' | 'register',
): PasswordProblem | null {
  if (password.length === 0) return 'required';
  if (mode === 'register' && password.length < MIN_PASSWORD_LENGTH) return 'tooShort';
  return null;
}

/** The second field of the sign-up: what was typed again must be the same, so that a typo does not lock the learner out. */
export function checkPasswordConfirm(password: string, confirm: string): 'mismatch' | null {
  return password === confirm ? null : 'mismatch';
}

/** The API error behind a failed request, if the server sent one in the common format. */
export function apiErrorOf(error: unknown): ApiError | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null;
  const parsed = ApiErrorSchema.safeParse(error.data);
  return parsed.success ? parsed.data : null;
}
