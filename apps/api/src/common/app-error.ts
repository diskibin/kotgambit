import type { HttpStatus } from '@nestjs/common';

/**
 * User-facing texts of API errors. They are short and calm, the app shows them as they are.
 * A client that needs another wording maps `code` itself.
 */
export const ERROR_MESSAGES = {
  'validation.failed': 'Проверь, пожалуйста, введённые данные.',
  'auth.invalid_credentials': 'Не получилось войти. Проверь почту и пароль.',
  'auth.email_taken': 'Эта почта уже зарегистрирована. Попробуй войти.',
  'auth.unauthorized': 'Нужно войти, чтобы продолжить.',
  'auth.session_expired': 'Сессия закончилась. Войди ещё раз.',
  'http.not_found': 'Такой страницы не нашлось.',
  'http.too_many_requests': 'Слишком много попыток. Подожди немного и попробуй снова.',
  'http.bad_request': 'Запрос не получился. Проверь данные и попробуй ещё раз.',
  'server.unavailable': 'Сервер сейчас занят. Попробуй через несколько секунд.',
  'server.internal': 'Что-то пошло не так на сервере. Попробуй ещё раз чуть позже.',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: HttpStatus,
    /** For developers only. Never put secrets or personal data here. */
    readonly details?: unknown,
  ) {
    super(code);
  }
}
