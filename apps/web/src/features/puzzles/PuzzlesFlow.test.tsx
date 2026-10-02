import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

// The mate in two 005Bm of the Lichess database, after the opponent's first move: 1.Ng6 Kg8 2.Qh8#
const FEN = '4rk2/p4q2/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 w - - 1 44';
const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const ATTEMPT = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';

const PUZZLE = {
  attemptId: ATTEMPT,
  puzzleId: '005Bm',
  fen: FEN,
  lastMove: 'c7f7',
  solver: 'w',
  rating: 1434,
  themes: [],
};
const STATS = { rating: 1000, solved: 5, failed: 2, streak: 0, bestStreak: 4 };
const DAILY = {
  puzzleId: '005Bm',
  fen: FEN,
  lastMove: 'c7f7',
  solver: 'w',
  title: 'Мат в 2 хода',
  solved: false,
};
const THEMES = {
  themes: [
    { key: 'fork', title: 'Вилка', count: 40, solved: 8 },
    { key: 'mateIn2', title: 'Мат в 2 хода', count: 48, solved: 12 },
    { key: 'rookEndgame', title: 'Ладейный эндшпиль', count: 30, solved: 3 },
  ],
};
const FAILED = {
  status: 'failed',
  rated: true,
  ratingBefore: 1000,
  ratingAfter: 984,
  themes: [],
  streak: 0,
};
const SOLVED = {
  status: 'solved',
  rated: true,
  ratingBefore: 1000,
  ratingAfter: 1016,
  themes: [],
  streak: 1,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let nextBodies: unknown[];
let moves: string[];
let hintsAsked: number;
let gaveUp: boolean;

beforeEach(() => {
  nextBodies = [];
  moves = [];
  hintsAsked = 0;
  gaveUp = false;
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/puzzles/daily`, () => HttpResponse.json(DAILY)),
    http.get(`${API_URL}/puzzles/stats`, () => HttpResponse.json(STATS)),
    http.get(`${API_URL}/puzzles/themes`, () => HttpResponse.json(THEMES)),
    http.post(`${API_URL}/puzzles/next`, async ({ request }) => {
      nextBodies.push(await request.json());
      return HttpResponse.json(PUZZLE);
    }),
    http.post(`${API_URL}/puzzles/attempts/:id/move`, async ({ request }) => {
      const { move } = (await request.json()) as { move: string };
      moves.push(move);
      if (move === 'h4g6') {
        return HttpResponse.json({
          result: 'correct',
          reply: 'f8g8',
          solved: false,
          summary: null,
        });
      }
      if (move === 'f6h8') {
        return HttpResponse.json({ result: 'correct', reply: null, solved: true, summary: SOLVED });
      }
      if (move === 'a2a3') {
        return HttpResponse.json({ result: 'wrong', mistakes: 1, summary: FAILED });
      }
      return HttpResponse.json({ result: 'illegal' });
    }),
    http.post(`${API_URL}/puzzles/attempts/:id/hint`, () => {
      hintsAsked += 1;
      if (hintsAsked === 1) return HttpResponse.json({ level: 1, square: 'h4' });
      if (hintsAsked === 2) {
        return HttpResponse.json({
          level: 2,
          themes: [
            { key: 'mateIn2', title: 'Мат в 2 хода' },
            { key: 'pin', title: 'Связка' },
          ],
        });
      }
      return HttpResponse.json({ level: 3, move: 'h4g6', summary: FAILED });
    }),
    http.post(`${API_URL}/puzzles/attempts/:id/give-up`, () => {
      gaveUp = true;
      return HttpResponse.json({ solution: ['h4g6', 'f8g8', 'f6h8'], summary: FAILED });
    }),
  );
});
afterEach(() => server.resetHandlers());

const click = async (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) =>
  user.click(await screen.findByRole('button', { name }));
const square = (name: string) => screen.findByRole('button', { name: new RegExp(` ${name}(,|$)`) });

/** The learner moves the knight to g6: h4 first, then the empty square g6. */
async function knightToG6(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await square('h4'));
  await user.click(await screen.findByRole('button', { name: 'Пустая клетка g6, возможный ход' }));
}

async function startSolving(
  user: ReturnType<typeof userEvent.setup>,
  route = '/puzzles/solve?mode=daily',
) {
  renderApp(route);
  await screen.findByRole('heading', { name: 'Ход белых', level: 1 });
  expect(user).toBeDefined();
}

describe('catalog', () => {
  it('shows the puzzle of the day, the rating and the themes with their progress', async () => {
    renderApp('/puzzles');
    expect(
      await screen.findByRole('heading', { name: 'Мат в 2 хода', level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Задача дня')).toBeInTheDocument();
    expect(screen.getByText('Ход белых')).toBeInTheDocument();
    expect(await screen.findByText('1000')).toBeInTheDocument();
    expect(screen.getByText('Решено: 5')).toBeInTheDocument();
    expect(screen.getByText('Лучшая серия: 4')).toBeInTheDocument();
    expect(screen.getByText('Решено 12 из 48')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Решено в теме «Мат в 2 хода»' }),
    ).toHaveAttribute('aria-valuenow', '12');
    expect(screen.getByRole('button', { name: /Повтор ошибок/ })).toBeInTheDocument();
  });

  it('filters the themes by group', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles');
    await screen.findByText('Решено 12 из 48');
    await user.click(screen.getByRole('tab', { name: 'Эндшпиль' }));
    expect(screen.getByText('Ладейный эндшпиль')).toBeInTheDocument();
    expect(screen.queryByText('Вилка')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Мат' }));
    expect(screen.getAllByText('Мат в 2 хода').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ладейный эндшпиль')).not.toBeInTheDocument();
  });

  it('says the puzzle of the day is solved once it is', async () => {
    server.use(
      http.get(`${API_URL}/puzzles/daily`, () => HttpResponse.json({ ...DAILY, solved: true })),
    );
    renderApp('/puzzles');
    expect(await screen.findByText('Сегодняшняя задача решена')).toBeInTheDocument();
  });

  it('asks for the theme the learner picked', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles');
    await user.click(await screen.findByRole('button', { name: /Вилка/ }));
    await screen.findByRole('heading', { name: 'Ход белых', level: 1 });
    expect(nextBodies[0]).toMatchObject({ mode: 'theme', theme: 'fork' });
  });

  it('starts the puzzle of the day and the review of mistakes from their cards', async () => {
    const user = userEvent.setup();
    renderApp('/puzzles');
    await click(user, 'Решить');
    await screen.findByRole('heading', { name: 'Ход белых', level: 1 });
    expect(nextBodies[0]).toMatchObject({
      mode: 'daily',
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('sends a visitor who is not signed in to the sign-in screen', async () => {
    server.use(http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })));
    renderApp('/puzzles');
    expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeInTheDocument();
  });

  it('shows a banner with a retry when the catalog does not load', async () => {
    server.use(
      http.get(`${API_URL}/puzzles/themes`, () => new HttpResponse(null, { status: 500 })),
    );
    renderApp('/puzzles');
    expect(
      await screen.findByText('Не получилось загрузить задачи. Попробуй ещё раз.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('solving', () => {
  it('shows the position to solve, who moves and the cat inviting to look for the move', async () => {
    const user = userEvent.setup();
    await startSolving(user);
    expect(screen.getByText('Найди лучший ход')).toBeInTheDocument();
    expect(await screen.findByText('Рейтинг 1000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Подсказка' })).toBeInTheDocument();
    expect(screen.getByText('Подсказки 0 из 3')).toBeInTheDocument();
  });

  it('plays the reply of the opponent and praises the solve with the change of the rating', async () => {
    const user = userEvent.setup();
    await startSolving(user);

    await knightToG6(user);
    // The opponent's king steps to g8 on the board
    expect(await screen.findByRole('button', { name: 'Чёрный король g8' })).toBeInTheDocument();
    expect(moves).toEqual(['h4g6']);

    await user.click(await square('f6'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка h8, возможный ход' }),
    );
    expect(await screen.findByRole('heading', { name: 'Верно!' })).toBeInTheDocument();
    expect(screen.getByText('Рейтинг +16')).toBeInTheDocument();
    expect(moves).toEqual(['h4g6', 'f6h8']);

    nextBodies = [];
    await click(user, 'Следующая задача');
    await waitFor(() => expect(nextBodies).toHaveLength(1));
    await screen.findByRole('heading', { name: 'Найди лучший ход' });
  });

  it('answers a wrong move calmly, puts the piece back and lets the learner try again', async () => {
    const user = userEvent.setup();
    await startSolving(user);

    await user.click(await square('a2'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка a3, возможный ход' }),
    );
    expect(await screen.findByRole('heading', { name: 'Не совсем' })).toBeInTheDocument();
    // The pawn is back where it was
    expect(await screen.findByRole('button', { name: 'Белая пешка a2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Белая пешка a3' })).not.toBeInTheDocument();

    await click(user, 'Ещё раз');
    expect(await screen.findByRole('heading', { name: 'Найди лучший ход' })).toBeInTheDocument();
    // The mistake is behind, the learner can still solve it
    await knightToG6(user);
    expect(await screen.findByRole('button', { name: 'Чёрный король g8' })).toBeInTheDocument();
  });

  it('gives the three hints one after another and closes the card with "Понятно"', async () => {
    const user = userEvent.setup();
    await startSolving(user);

    await click(user, 'Подсказка');
    expect(await screen.findByRole('heading', { name: 'Подсказка 1 из 3' })).toBeInTheDocument();
    expect(screen.getByText('Подсказки 1 из 3')).toBeInTheDocument();

    await click(user, 'Ещё подсказка');
    expect(await screen.findByRole('heading', { name: 'Подсказка 2 из 3' })).toBeInTheDocument();
    expect(screen.getByText(/Мат в 2 хода, Связка\./)).toBeInTheDocument();

    await click(user, 'Ещё подсказка');
    expect(await screen.findByRole('heading', { name: 'Подсказка 3 из 3' })).toBeInTheDocument();
    // The last hint has no "more"
    expect(screen.queryByRole('button', { name: 'Ещё подсказка' })).not.toBeInTheDocument();

    await click(user, 'Понятно');
    expect(await screen.findByRole('heading', { name: 'Найди лучший ход' })).toBeInTheDocument();
    expect(hintsAsked).toBe(3);
  });

  it('shows the solution after a mistake', async () => {
    const user = userEvent.setup();
    await startSolving(user);
    await user.click(await square('a2'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка a3, возможный ход' }),
    );
    await screen.findByRole('heading', { name: 'Не совсем' });

    await click(user, 'Показать решение');
    expect(await screen.findByRole('heading', { name: 'Решение' })).toBeInTheDocument();
    expect(gaveUp).toBe(true);
    expect(screen.getByRole('button', { name: 'Следующая задача' })).toBeInTheDocument();
  });

  it('shows the theme in the header only when the learner picked it', async () => {
    server.use(
      http.post(`${API_URL}/puzzles/next`, () =>
        HttpResponse.json({ ...PUZZLE, themes: [{ key: 'mateIn2', title: 'Мат в 2 хода' }] }),
      ),
    );
    const user = userEvent.setup();
    await startSolving(user, '/puzzles/solve?mode=theme&theme=mateIn2');
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Мат в 2 хода')).toBeInTheDocument();
  });

  it('tells the learner when the move could not be checked, and puts the piece back', async () => {
    server.use(
      http.post(
        `${API_URL}/puzzles/attempts/:id/move`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    await startSolving(user);
    await knightToG6(user);
    expect(
      await screen.findByText('Не получилось проверить ход. Попробуй ещё раз.'),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Белый конь h4' })).toBeInTheDocument();
  });
});

describe('when there is nothing to solve', () => {
  it('says there are no mistakes to review, in the words of the design', async () => {
    server.use(
      http.post(`${API_URL}/puzzles/next`, () =>
        HttpResponse.json(
          { code: 'puzzle.none', message: 'Подходящих задач пока нет. Попробуй другую тему.' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/puzzles/solve?mode=review');
    expect(
      await screen.findByRole('heading', { name: 'Пока нет ошибок для повтора' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Когда ошибёшься в задаче, она появится здесь/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К задачам' })).toBeInTheDocument();
  });

  it('shows the message of the server when a theme has no puzzles left', async () => {
    server.use(
      http.post(`${API_URL}/puzzles/next`, () =>
        HttpResponse.json(
          { code: 'puzzle.none', message: 'Подходящих задач пока нет. Попробуй другую тему.' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/puzzles/solve?mode=theme&theme=fork');
    expect(
      await screen.findByRole('heading', {
        name: 'Подходящих задач пока нет. Попробуй другую тему.',
      }),
    ).toBeInTheDocument();
  });

  it('says the server is busy and retries when asked', async () => {
    let calls = 0;
    server.use(
      http.post(`${API_URL}/puzzles/next`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { code: 'server.unavailable', message: 'Сервер сейчас занят.' },
              { status: 503 },
            )
          : HttpResponse.json(PUZZLE);
      }),
    );
    const user = userEvent.setup();
    renderApp('/puzzles/solve?mode=rating');
    expect(await screen.findByRole('heading', { name: 'Гамбит задумался' })).toBeInTheDocument();
    expect(screen.getByText('Сервер занят')).toBeInTheDocument();
    await click(user, 'Попробовать снова');
    expect(await screen.findByRole('heading', { name: 'Ход белых', level: 1 })).toBeInTheDocument();
  });
});
