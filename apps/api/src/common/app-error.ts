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
  'auth.link_expired': 'Ссылка устарела. Запроси новую — это займёт минуту.',
  'auth.session_expired': 'Сессия закончилась. Войди ещё раз.',
  'oauth.unavailable': 'Вход через этот сервис пока не настроен. Выбери другой способ.',
  'oauth.code_invalid': 'Код входа устарел. Войди ещё раз.',
  'oauth.identity_taken': 'Этот аккаунт уже привязан к другому профилю.',
  'lesson.not_found': 'Такой главы не нашлось.',
  'lesson.locked': 'Эта глава откроется, когда ты закончишь предыдущую.',
  'lesson.premium': 'Эта глава есть в Премиуме.',
  'lesson.invalid_report': 'Не получилось сохранить результат. Попробуй ещё раз.',
  'puzzle.none': 'Подходящих задач пока нет. Попробуй другую тему.',
  'puzzle.attempt_not_found': 'Эту задачу уже не найти. Возьми новую.',
  'puzzle.finished': 'С этой задачей мы закончили. Возьмём следующую?',
  'game.not_found': 'Эту партию уже не найти. Начнём новую?',
  'game.bot_unknown': 'Такого соперника нет. Выбери другого.',
  'game.too_many_active': 'У тебя уже есть несколько незаконченных партий. Доиграй одну из них.',
  'game.finished': 'Эта партия уже закончилась.',
  'game.not_your_turn': 'Сейчас ход соперника. Подожди чуть-чуть.',
  'game.learning_only': 'Это доступно только в режиме обучения.',
  'game.nothing_to_undo': 'Пока нечего отменять.',
  'game.hints_over': 'Подсказки в этой партии закончились. Ты справишься!',
  'analysis.invalid_position': 'Так на доске не бывает. Проверь расстановку.',
  'review.not_ready': 'Разбор будет готов, когда партия закончится.',
  'review.not_found': 'Разбор этой партии ещё не начинали.',
  'card.not_found': 'Эту карточку уже не найти.',
  'wardrobe.locked': 'Эту вещь Гамбит пока не может надеть. Её нужно заслужить.',
  'billing.unavailable': 'Оплата пока недоступна. Загляни чуть позже.',
  'billing.payment_not_found': 'Такого платежа не нашлось.',
  'billing.no_subscription': 'У тебя пока нет подписки.',
  'billing.cannot_resume': 'Подписку уже нельзя возобновить. Оформи её заново.',
  'puzzle.limit': 'На сегодня задачи закончились. Завтра будут новые.',
  'analysis.limit': 'Анализы на сегодня закончились. Завтра лимит обновится.',
  'premium.required': 'Это есть в Премиуме.',
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
    /** Replaces the standard text of the code when the exact case needs saying, such as which piece is wrong. */
    readonly userMessage?: string,
  ) {
    super(code);
  }
}
