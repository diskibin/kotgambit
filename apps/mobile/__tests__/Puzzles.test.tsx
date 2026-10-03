import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

// The mate in two 005Bm of the Lichess database, after the opponent's first move: 1.Ng6 Kg8 2.Qh8#
const FEN = '4rk2/p4q2/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 w - - 1 44';
const PUZZLE = {
  attemptId: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
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
const SOLVED = { ...FAILED, status: 'solved', ratingAfter: 1016, streak: 1 };

let nextBodies: unknown[];
let moves: string[];
let hintsAsked: number;
let gaveUp: boolean;

type Routes = Parameters<typeof mockApi>[0];

function routes(over: Routes = {}): Routes {
  return {
    ...SIGNED_IN,
    ...HOME,
    'GET /puzzles/daily': () => json(DAILY),
    'GET /puzzles/stats': () => json(STATS),
    'GET /puzzles/themes': () => json(THEMES),
    'POST /puzzles/next': async (request) => {
      nextBodies.push(await request.json());
      return json(PUZZLE);
    },
    [`POST /puzzles/attempts/${PUZZLE.attemptId}/move`]: async (request) => {
      const { move } = (await request.json()) as { move: string };
      moves.push(move);
      if (move === 'h4g6') {
        return json({ result: 'correct', reply: 'f8g8', solved: false, summary: null });
      }
      if (move === 'f6h8') {
        return json({ result: 'correct', reply: null, solved: true, summary: SOLVED });
      }
      if (move === 'a2a3') return json({ result: 'wrong', mistakes: 1, summary: FAILED });
      return json({ result: 'illegal' });
    },
    [`POST /puzzles/attempts/${PUZZLE.attemptId}/hint`]: () => {
      hintsAsked += 1;
      if (hintsAsked === 1) return json({ level: 1, square: 'h4' });
      if (hintsAsked === 2) {
        return json({
          level: 2,
          themes: [
            { key: 'mateIn2', title: 'Мат в 2 хода' },
            { key: 'pin', title: 'Связка' },
          ],
        });
      }
      return json({ level: 3, move: 'h4g6', summary: FAILED });
    },
    [`POST /puzzles/attempts/${PUZZLE.attemptId}/give-up`]: () => {
      gaveUp = true;
      return json({ solution: ['h4g6', 'f8g8', 'f6h8'], summary: FAILED });
    },
    ...over,
  };
}

beforeEach(async () => {
  nextBodies = [];
  moves = [];
  hintsAsked = 0;
  gaveUp = false;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));
const tab = async (name: string) => fireEvent.press(await screen.findByRole('tab', { name }));
const square = (label: string) => screen.findByLabelText(label);

async function openCatalog() {
  render(<App store={makeStore()} />);
  await tab('Задачи');
  await screen.findByText('Темы');
}

async function openSolving(over: Routes = {}) {
  mockApi(routes(over));
  await openCatalog();
  await press('Решить');
  await screen.findByRole('header', { name: 'Ход белых' });
}

/** The learner moves the knight to g6: h4 first, then the empty square g6. */
async function knightToG6() {
  fireEvent.press(await square('Белый конь h4'));
  fireEvent.press(await square('Пустая клетка g6, возможный ход'));
}

describe('catalog', () => {
  it('shows the puzzle of the day, the rating and the themes with their progress', async () => {
    mockApi(routes());
    await openCatalog();
    // The title of the daily card and the theme card of the same name
    expect(await screen.findAllByText('Мат в 2 хода')).toHaveLength(2);
    expect(screen.getByText('Задача дня')).toBeOnTheScreen();
    expect(screen.getByText('Ход белых')).toBeOnTheScreen();
    expect(await screen.findByText('Рейтинг 1000')).toBeOnTheScreen();
    expect(screen.getByText('Решено 12 из 48')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: 'Решено в теме «Мат в 2 хода»' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Повтор ошибок' })).toBeOnTheScreen();
  });

  it('filters the themes by group', async () => {
    mockApi(routes());
    await openCatalog();
    await screen.findByText('Решено 12 из 48');
    fireEvent.press(screen.getByRole('tab', { name: 'Эндшпиль' }));
    expect(screen.getByText('Ладейный эндшпиль')).toBeOnTheScreen();
    expect(screen.queryByText('Вилка')).not.toBeOnTheScreen();
    fireEvent.press(screen.getByRole('tab', { name: 'Мат' }));
    expect(screen.queryByText('Ладейный эндшпиль')).not.toBeOnTheScreen();
  });

  it('says the puzzle of the day is solved once it is', async () => {
    mockApi(routes({ 'GET /puzzles/daily': () => json({ ...DAILY, solved: true }) }));
    await openCatalog();
    expect(await screen.findByText('Сегодняшняя задача решена')).toBeOnTheScreen();
  });

  it('asks for the theme the learner picked', async () => {
    mockApi(routes());
    await openCatalog();
    fireEvent.press(await screen.findByRole('button', { name: /Вилка\./ }));
    await screen.findByRole('header', { name: 'Ход белых' });
    expect(nextBodies[0]).toMatchObject({ mode: 'theme', theme: 'fork' });
  });

  it('starts the puzzle of the day for the calendar day of the learner', async () => {
    await openSolving();
    expect(nextBodies[0]).toMatchObject({
      mode: 'daily',
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('shows a banner with a retry when the catalog does not load', async () => {
    mockApi(routes({ 'GET /puzzles/themes': () => new Response(null, { status: 500 }) }));
    await openCatalog().catch(() => undefined);
    expect(
      await screen.findByText('Не получилось загрузить задачи. Попробуй ещё раз.'),
    ).toBeOnTheScreen();
  });
});

describe('solving', () => {
  it('shows who moves, the cat inviting to look for the move and the hint counter', async () => {
    await openSolving();
    expect(screen.getByText('Найди лучший ход')).toBeOnTheScreen();
    expect(await screen.findByText('Рейтинг 1000')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Подсказка' })).toBeOnTheScreen();
    expect(screen.getByText(/Подсказки 0 из 3/)).toBeOnTheScreen();
  });

  it('plays the reply of the opponent and praises the solve with the change of the rating', async () => {
    await openSolving();

    await knightToG6();
    // The opponent's king steps to g8 on the board
    expect(await screen.findByLabelText('Чёрный король g8')).toBeOnTheScreen();
    expect(moves).toEqual(['h4g6']);

    fireEvent.press(await square('Белый ферзь f6'));
    fireEvent.press(await square('Пустая клетка h8, возможный ход'));
    expect(await screen.findByText('Верно!')).toBeOnTheScreen();
    expect(screen.getByText('Рейтинг +16')).toBeOnTheScreen();
    expect(moves).toEqual(['h4g6', 'f6h8']);

    nextBodies = [];
    await press('Следующая задача');
    await waitFor(() => expect(nextBodies).toHaveLength(1));
    await screen.findByText('Найди лучший ход');
  });

  it('answers a wrong move calmly, puts the piece back and lets the learner try again', async () => {
    await openSolving();

    fireEvent.press(await square('Белая пешка a2'));
    fireEvent.press(await square('Пустая клетка a3, возможный ход'));
    expect(await screen.findByText('Не совсем')).toBeOnTheScreen();
    // The pawn is back where it was
    expect(await screen.findByLabelText('Белая пешка a2')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Белая пешка a3')).not.toBeOnTheScreen();

    await press('Ещё раз');
    expect(await screen.findByText('Найди лучший ход')).toBeOnTheScreen();
    await knightToG6();
    expect(await screen.findByLabelText('Чёрный король g8')).toBeOnTheScreen();
  });

  it('gives the three hints one after another and closes the card with "Понятно"', async () => {
    await openSolving();

    await press('Подсказка');
    expect(await screen.findByText('Подсказка 1 из 3')).toBeOnTheScreen();

    await press('Ещё подсказка');
    expect(await screen.findByText('Подсказка 2 из 3')).toBeOnTheScreen();
    expect(screen.getByText(/Мат в 2 хода, Связка\./)).toBeOnTheScreen();

    await press('Ещё подсказка');
    expect(await screen.findByText('Подсказка 3 из 3')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ещё подсказка' })).not.toBeOnTheScreen();

    await press('Понятно');
    expect(await screen.findByText('Найди лучший ход')).toBeOnTheScreen();
    expect(hintsAsked).toBe(3);
  });

  it('shows the solution after a mistake', async () => {
    await openSolving();
    fireEvent.press(await square('Белая пешка a2'));
    fireEvent.press(await square('Пустая клетка a3, возможный ход'));
    await screen.findByText('Не совсем');

    await press('Решение');
    expect(await screen.findByText('Решение')).toBeOnTheScreen();
    expect(gaveUp).toBe(true);
    expect(screen.getByRole('button', { name: 'Следующая задача' })).toBeOnTheScreen();
  });

  it('tells the learner when the move could not be checked, and puts the piece back', async () => {
    await openSolving({
      [`POST /puzzles/attempts/${PUZZLE.attemptId}/move`]: () =>
        new Response(null, { status: 500 }),
    });
    await knightToG6();
    expect(
      await screen.findByText('Не получилось проверить ход. Попробуй ещё раз.'),
    ).toBeOnTheScreen();
    expect(await screen.findByLabelText('Белый конь h4')).toBeOnTheScreen();
  });

  it('shows the theme in the header only when the learner picked it', async () => {
    mockApi(
      routes({
        'POST /puzzles/next': () =>
          json({ ...PUZZLE, themes: [{ key: 'mateIn2', title: 'Мат в 2 хода' }] }),
      }),
    );
    await openCatalog();
    fireEvent.press(await screen.findByRole('button', { name: /Мат в 2 хода\. Решено/ }));
    await screen.findByRole('header', { name: 'Ход белых' });
    expect(screen.getAllByText('Мат в 2 хода').length).toBeGreaterThan(0);
  });
});

describe('when there is nothing to solve', () => {
  const none = () =>
    json({ code: 'puzzle.none', message: 'Подходящих задач пока нет. Попробуй другую тему.' }, 404);

  it('says there are no mistakes to review, in the words of the design', async () => {
    mockApi(routes({ 'POST /puzzles/next': none }));
    await openCatalog();
    await press('Повтор ошибок');
    expect(await screen.findByText('Пока нет ошибок для повтора')).toBeOnTheScreen();
    expect(screen.getByText(/Когда ошибёшься в задаче, она появится здесь/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'К задачам' })).toBeOnTheScreen();
  });

  it('shows the message of the server when a theme has no puzzles left', async () => {
    mockApi(routes({ 'POST /puzzles/next': none }));
    await openCatalog();
    fireEvent.press(await screen.findByRole('button', { name: /Вилка\./ }));
    expect(
      await screen.findByText('Подходящих задач пока нет. Попробуй другую тему.'),
    ).toBeOnTheScreen();
  });

  it('says the server is busy and retries when asked', async () => {
    let calls = 0;
    mockApi(
      routes({
        'POST /puzzles/next': () => {
          calls += 1;
          return calls === 1
            ? json({ code: 'server.unavailable', message: 'Сервер сейчас занят.' }, 503)
            : json(PUZZLE);
        },
      }),
    );
    await openCatalog();
    await press('Решить');
    expect(await screen.findByText('Гамбит задумался')).toBeOnTheScreen();
    expect(screen.getByText('Сервер занят')).toBeOnTheScreen();
    await press('Попробовать снова');
    expect(await screen.findByRole('header', { name: 'Ход белых' })).toBeOnTheScreen();
  });
});
