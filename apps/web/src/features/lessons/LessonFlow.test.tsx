import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { homeHandlers, LESSONS, PROGRESS } from '../../test/handlers';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const KNIGHT = '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1';

const LESSON = {
  ...LESSONS[0],
  steps: [
    {
      type: 'text',
      title: 'Теория',
      body: 'Конь ходит буквой Г.',
      pointsTitle: 'Запомни три вещи',
      points: ['Раз', 'Два'],
      remember: 'Две клетки в одну сторону и одна в сторону.',
    },
    { type: 'demo', title: 'Смотри', body: 'Конь прыгает.', fen: KNIGHT, moves: ['g1f3'] },
    {
      type: 'move',
      title: 'Ход конём',
      prompt: 'Сходи конём на f3.',
      fen: KNIGHT,
      orientation: 'w',
      answers: ['g1f3'],
      hints: { piece: 'Ходи конём.', idea: 'Буква Г.' },
      success: 'Вот это да! Конь смотрит на центр.',
      oops: 'Эта клетка с края, давай ещё раз.',
      successArrows: [],
    },
    {
      type: 'quiz',
      question: 'Кто ходит буквой Г?',
      options: [
        { text: 'Конь', correct: true, explanation: 'Да, конь прыгает буквой Г.' },
        { text: 'Слон', correct: false, explanation: 'Слон ходит по диагонали.' },
      ],
    },
    {
      type: 'find-squares',
      title: 'Куда пойдёт конь',
      prompt: 'Отметь клетки коня.',
      fen: KNIGHT,
      orientation: 'w',
      squares: ['e2', 'f3', 'h3'],
      success: 'Все клетки найдены.',
      oops: 'Не хватает клеток, посмотри ещё раз.',
      hint: 'Две клетки в одну сторону и одна вбок.',
    },
  ],
};

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const RESULT = {
  xp: 20,
  accuracy: 1,
  stars: 3,
  firstTime: true,
  goalReachedNow: false,
  nextLessonId: 'basics-rook',
  progress: { ...PROGRESS, streakDays: 1, todaySeconds: 120 },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let reported: unknown;

beforeEach(() => {
  reported = undefined;
  server.use(
    // The session comes back from the refresh cookie, as after a reload
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    ...homeHandlers(),
    http.get(`${API_URL}/lessons/basics-board`, () => HttpResponse.json(LESSON)),
    http.post(`${API_URL}/lessons/basics-board/complete`, async ({ request }) => {
      reported = await request.json();
      return HttpResponse.json(RESULT);
    }),
  );
});
afterEach(() => server.resetHandlers());

const click = async (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  user.click(await screen.findByRole('button', { name }));
const square = (name: string) => screen.findByRole('button', { name: new RegExp(` ${name}(,|$)`) });

async function startLesson(user: ReturnType<typeof userEvent.setup>) {
  renderApp('/learn');
  await click(user, 'Начать');
  await screen.findByRole('heading', { name: 'Теория' });
}

describe('home', () => {
  it('shows the chapters, the day bar and a greeting from the cat', async () => {
    renderApp('/learn');
    expect(
      await screen.findByRole('heading', { name: 'Доска и фигуры', level: 3 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Откроется позже')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /Цель дня: 0 из 10 минут/ })).toBeInTheDocument();
    expect(screen.getByText('серия начнётся сегодня')).toBeInTheDocument();
    expect(screen.getByText(/Начнём с первой главы/)).toBeInTheDocument();
    expect(screen.getByText('0 из 2 глав')).toBeInTheDocument();
    expect(screen.getByText('5 шагов · около 5 минут')).toBeInTheDocument();
  });

  it('sends a visitor who is not signed in to the sign-in screen', async () => {
    server.use(http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })));
    renderApp('/learn');
    expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeInTheDocument();
  });

  it('shows a finished chapter with its stars and a repeat button', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 2 },
        { ...LESSONS[1], status: 'available' },
      ]),
    );
    renderApp('/learn');
    expect(await screen.findByRole('img', { name: 'Звёзд: 2 из 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Повторить/ })).toBeInTheDocument();
    expect(screen.getByText('1 из 2 глав')).toBeInTheDocument();
  });
});

describe('lesson', () => {
  it('opens in focus mode with the caption and a progress bar', async () => {
    const user = userEvent.setup();
    await startLesson(user);
    expect(screen.getByText('Основы · глава 1 · шаг 1 из 5')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Прогресс урока' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(screen.getByText('Запомни')).toBeInTheDocument();
    expect(screen.getByText('Две клетки в одну сторону и одна в сторону.')).toBeInTheDocument();
  });

  it('says "Дальше" and not "Теперь я" when no move of the learner follows the demo', async () => {
    const steps = LESSON.steps;
    server.use(
      http.get(`${API_URL}/lessons/basics-board`, () =>
        HttpResponse.json({ ...LESSON, steps: [steps[0], steps[1], steps[0]] }),
      ),
    );
    const user = userEvent.setup();
    await startLesson(user);
    await click(user, 'Продолжить');
    await screen.findByRole('heading', { name: 'Смотри' });
    expect(screen.queryByRole('button', { name: 'Теперь я' })).not.toBeInTheDocument();
    expect(screen.getByText(/иди дальше/)).toBeInTheDocument();
    await click(user, 'Дальше');
    expect(await screen.findByRole('heading', { name: 'Теория' })).toBeInTheDocument();
  });

  it('goes through every kind of step and reports a clean run', async () => {
    const user = userEvent.setup();
    await startLesson(user);

    await click(user, 'Продолжить');
    await screen.findByRole('heading', { name: 'Смотри' });
    expect(screen.getByText('Показ хода')).toBeInTheDocument();
    await click(user, 'Теперь я');

    await screen.findByRole('heading', { name: 'Ход конём' });
    await user.click(await square('g1'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка f3, возможный ход' }),
    );
    expect(await screen.findByText('Готово? Жми «Проверить»')).toBeInTheDocument();
    await click(user, 'Проверить');
    expect(await screen.findByText('Вот это да! Конь смотрит на центр.')).toBeInTheDocument();
    await click(user, 'Дальше');

    await screen.findByRole('heading', { name: 'Кто ходит буквой Г?' });
    await user.click(screen.getByRole('radio', { name: 'Ответ A: Конь' }));
    expect(await screen.findByText('Выбран ответ A')).toBeInTheDocument();
    await click(user, 'Проверить');
    expect(await screen.findByText('Да, конь прыгает буквой Г.')).toBeInTheDocument();
    await click(user, 'Продолжить');

    await screen.findByRole('heading', { name: 'Куда пойдёт конь' });
    for (const name of ['e2', 'f3', 'h3']) await user.click(await square(name));
    await click(user, 'Проверить');
    expect(await screen.findByText('Все клетки найдены.')).toBeInTheDocument();
    await click(user, 'Дальше');

    expect(
      await screen.findByRole('heading', { name: /Урок пройден|Урок позади|Готово/ }),
    ).toBeInTheDocument();
    expect(reported).toMatchObject({
      attempts: [1, 1, 1, 1, 1],
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(screen.getByText('+20 XP')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1 день')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Дальше' })).toBeInTheDocument();
  });

  it('answers a wrong choice calmly and counts the second try', async () => {
    const user = userEvent.setup();
    await startLesson(user);
    await click(user, 'Продолжить');
    await click(user, 'Теперь я');
    await screen.findByRole('heading', { name: 'Ход конём' });
    await user.click(await square('g1'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка h3, возможный ход' }),
    );
    await click(user, 'Проверить');

    // A mistake gets a calm card and a way forward, no scolding
    expect(await screen.findByText('Эта клетка с края, давай ещё раз.')).toBeInTheDocument();
    expect(screen.queryByText(/неверно|неправильно/i)).toBeNull();
    await click(user, 'Показать ход');
    await click(user, 'Ещё раз');

    await user.click(await square('g1'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка f3, возможный ход' }),
    );
    await click(user, 'Проверить');
    await click(user, 'Дальше');

    await screen.findByRole('heading', { name: 'Кто ходит буквой Г?' });
    await user.click(screen.getByRole('radio', { name: 'Ответ B: Слон' }));
    await click(user, 'Проверить');
    expect(await screen.findByText(/Слон ходит по диагонали\./)).toBeInTheDocument();
    await click(user, 'Ещё раз');
    await user.click(screen.getByRole('radio', { name: 'Ответ A: Конь' }));
    await click(user, 'Проверить');
    await click(user, 'Продолжить');

    for (const name of ['e2', 'f3', 'h3']) await user.click(await square(name));
    await click(user, 'Проверить');
    await click(user, 'Дальше');

    await screen.findByText('+20 XP');
    expect(reported).toMatchObject({ attempts: [1, 1, 2, 2, 1] });
  });

  it('gives hints one after another', async () => {
    const user = userEvent.setup();
    await startLesson(user);
    await click(user, 'Продолжить');
    await click(user, 'Теперь я');
    await screen.findByRole('heading', { name: 'Ход конём' });

    await click(user, 'Подсказка');
    expect(await screen.findByText('Ходи конём.')).toBeInTheDocument();
    expect(screen.getByText('1 из 3')).toBeInTheDocument();
    await click(user, 'Ещё подсказка');
    expect(await screen.findByText('Буква Г.')).toBeInTheDocument();
    await click(user, 'Ещё подсказка');
    expect(screen.getByText('3 из 3')).toBeInTheDocument();
    expect(document.querySelector('[data-arrow="g1f3"]')).not.toBeNull();
  });

  it('asks before leaving and keeps the lesson when the learner stays', async () => {
    const user = userEvent.setup();
    await startLesson(user);
    await user.click(screen.getByRole('button', { name: 'Выйти из урока' }));

    const dialog = await screen.findByRole('dialog', { name: 'Выйти из урока?' });
    expect(dialog).toHaveTextContent('Прогресс этого урока не сохранится.');
    await user.click(screen.getByRole('button', { name: 'Остаться' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Теория' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Выйти из урока' }));
    await user.click(await screen.findByRole('button', { name: 'Выйти' }));
    expect(await screen.findByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
  });

  it('goes back to the previous step and has no way back from the first one', async () => {
    const user = userEvent.setup();
    await startLesson(user);
    expect(screen.queryByRole('button', { name: 'Предыдущий шаг' })).toBeNull();

    await click(user, 'Продолжить');
    expect(await screen.findByRole('heading', { name: 'Смотри' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Предыдущий шаг' }));
    expect(await screen.findByRole('heading', { name: 'Теория' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Предыдущий шаг' })).toBeNull();
  });

  it('says so when the chapter cannot be opened', async () => {
    server.use(
      http.get(`${API_URL}/lessons/basics-board`, () =>
        HttpResponse.json(
          { code: 'lesson.locked', message: 'Эта глава откроется, когда ты закончишь предыдущую.' },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp('/learn');
    await click(user, 'Начать');
    expect(
      await screen.findByText('Эта глава откроется, когда ты закончишь предыдущую.'),
    ).toBeInTheDocument();
  });

  it('keeps the finished lesson and offers to save again when saving fails', async () => {
    server.use(
      http.post(
        `${API_URL}/lessons/basics-board/complete`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    await startLesson(user);
    await click(user, 'Продолжить');
    await click(user, 'Теперь я');
    await user.click(await square('g1'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка f3, возможный ход' }),
    );
    await click(user, 'Проверить');
    await click(user, 'Дальше');
    await user.click(await screen.findByRole('radio', { name: 'Ответ A: Конь' }));
    await click(user, 'Проверить');
    await click(user, 'Продолжить');
    for (const name of ['e2', 'f3', 'h3']) await user.click(await square(name));
    await click(user, 'Проверить');
    await click(user, 'Дальше');

    expect(await screen.findByRole('alert')).toHaveTextContent('Не получилось сохранить результат');

    server.use(
      http.post(`${API_URL}/lessons/basics-board/complete`, () => HttpResponse.json(RESULT)),
    );
    await click(user, 'Ещё раз');
    await waitFor(() => expect(screen.getByText('+20 XP')).toBeInTheDocument());
  });
});

describe('completion screen', () => {
  it('has nothing to show after a reload and goes home', async () => {
    renderApp('/lesson/basics-board/done');
    expect(await screen.findByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
  });
});
