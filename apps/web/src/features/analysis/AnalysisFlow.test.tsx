import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const GAME_ID = '5a1c2d3e-8a56-4b52-9d6a-0c1c6e1f7a22';

const ANALYSIS = {
  fen: START,
  turn: 'w',
  score: { kind: 'cp', value: 30 },
  leader: 'equal',
  headline: 'Примерно равно',
  detail: 'Материал равный.',
  outlook: { white: 42, draw: 28, black: 30 },
  best: { uci: 'e2e4', san: 'e4', explanation: 'Лучший ход по оценке движка.' },
  lines: [
    { score: { kind: 'cp', value: 30 }, uci: ['e2e4', 'e7e5'], san: ['e4', 'e5'] },
    { score: { kind: 'cp', value: 25 }, uci: ['d2d4'], san: ['d4'] },
    { score: { kind: 'cp', value: -110 }, uci: ['a2a3'], san: ['a3'] },
  ],
  depth: 14,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let analyzed: string[];

beforeEach(() => {
  analyzed = [];
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.post(`${API_URL}/analysis/position`, async ({ request }) => {
      analyzed.push(((await request.json()) as { fen: string }).fen);
      return HttpResponse.json(ANALYSIS);
    }),
  );
});
afterEach(() => server.resetHandlers());

const square = (name: string) => screen.findByRole('button', { name: new RegExp(` ${name}(,|$)`) });
const fenField = () => screen.getByLabelText('FEN') as HTMLInputElement;

async function openEditor() {
  renderApp('/analysis');
  await screen.findByRole('heading', { name: 'Анализ позиции', level: 1 });
}

describe('the editor', () => {
  it('starts from the initial position with the white side to move', async () => {
    await openEditor();
    expect(fenField().value).toBe(START);
    expect(screen.getByRole('tab', { name: 'Белые', selected: true })).toBeInTheDocument();
    expect(
      screen.getByText('Здесь появится оценка, лучший ход и три варианта'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeEnabled();
  });

  it('offers the twelve pieces and the eraser as one choice', async () => {
    await openEditor();
    const palette = screen.getByRole('radiogroup', { name: 'Фигуры' });
    expect(within(palette).getAllByRole('radio')).toHaveLength(13);
    const knight = within(palette).getByRole('radio', { name: 'Белый конь' });
    await userEvent.click(knight);
    expect(knight).toBeChecked();
    await userEvent.click(within(palette).getByRole('radio', { name: 'Ластик' }));
    expect(knight).not.toBeChecked();
  });

  it('puts a piece on a square and writes it into the FEN', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    await user.click(screen.getByRole('radio', { name: 'Белый король' }));
    await user.click(await square('e1'));
    expect(fenField().value).toBe('8/8/8/8/8/8/8/4K3 w - - 0 1');
  });

  it('explains a position that cannot be and keeps the analysis shut until it is fixed', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    await user.click(screen.getByRole('radio', { name: 'Белый король' }));
    await user.click(await square('e1'));

    expect(screen.getByText('Так на доске не бывает')).toBeInTheDocument();
    expect(
      screen.getByText(
        'У чёрных нет короля. Поставь чёрного короля, например на e8, и анализ заработает.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeDisabled();
    expect(fenField()).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('radio', { name: 'Чёрный король' }));
    await user.click(await square('e8'));
    expect(screen.queryByText('Так на доске не бывает')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeEnabled();
  });

  it('loads a FEN typed into the field and changes the side to move', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.clear(fenField());
    await user.click(fenField());
    await user.paste('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
    await user.click(screen.getByRole('radio', { name: 'Белый король' }));
    expect(screen.getByRole('tab', { name: 'Чёрные', selected: true })).toBeInTheDocument();
    await user.tab();
    expect(fenField().value).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1');
  });

  it('writes the castling rights that the pieces allow, and no others', async () => {
    const user = userEvent.setup();
    await openEditor();
    const whiteShort = screen.getByRole('checkbox', { name: 'Белые O-O' });
    expect(whiteShort).toBeChecked();
    await user.click(whiteShort);
    expect(fenField().value).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Qkq - 0 1');
    await user.click(screen.getByRole('button', { name: 'Очистить' }));
    expect(screen.getByRole('checkbox', { name: 'Белые O-O-O' })).toBeDisabled();
  });
});

describe('the analysis', () => {
  it('shows the evaluation, the chances, the best move and the lines', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Анализировать' }));

    expect(await screen.findByRole('heading', { name: 'Примерно равно' })).toBeInTheDocument();
    expect(analyzed).toEqual([START]);
    expect(screen.getByText('Материал равный.')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /у белых/i })).toHaveAttribute('aria-valuenow', '53');
    expect(screen.getByText('Белые 42%')).toBeInTheDocument();
    expect(screen.getByText('Ничья 28%')).toBeInTheDocument();
    expect(screen.getByText('Чёрные 30%')).toBeInTheDocument();
    expect(screen.getByText('★ e4')).toBeInTheDocument();
    expect(screen.getByText(/Лучший ход по оценке движка/)).toBeInTheDocument();
    expect(screen.getByText('1.e4 e5')).toBeInTheDocument();
    expect(screen.getByText('-1.1')).toBeInTheDocument();
  });

  it('forgets the look when the position changes', async () => {
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Анализировать' }));
    await screen.findByRole('heading', { name: 'Примерно равно' });
    await user.click(screen.getByRole('tab', { name: 'Чёрные' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Примерно равно' })).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText('Здесь появится оценка, лучший ход и три варианта'),
    ).toBeInTheDocument();
  });

  it('says so and offers another try when the engine is busy', async () => {
    server.use(
      http.post(`${API_URL}/analysis/position`, () =>
        HttpResponse.json(
          { code: 'server.unavailable', message: 'Сервер сейчас занят.' },
          { status: 503, headers: { 'Retry-After': '3' } },
        ),
      ),
    );
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Анализировать' }));
    expect(await screen.findByText(/Гамбит задумался/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument();
  });

  it('shows the words of the server when it refuses the position', async () => {
    server.use(
      http.post(`${API_URL}/analysis/position`, () =>
        HttpResponse.json(
          { code: 'analysis.invalid_position', message: 'Короли не могут стоять рядом.' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    await openEditor();
    await user.click(screen.getByRole('button', { name: 'Анализировать' }));
    expect(await screen.findByText('Короли не могут стоять рядом.')).toBeInTheDocument();
  });

  it('sends a visitor who is not signed in to the sign-in screen', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
    );
    renderApp('/analysis');
    expect(await screen.findByRole('tab', { name: 'Вход' })).toBeInTheDocument();
  });
});

describe('the review', () => {
  const REVIEW = {
    accuracy: { player: 64, bot: 91 },
    counts: { best: 3, good: 2, inaccuracy: 0, mistake: 0, blunder: 2 },
    chances: [50, 50, 20, 20, 0],
    qualities: ['best', 'best', 'blunder', 'best'],
    mistakes: [],
    keyMoments: [
      {
        ply: 3,
        moveNumber: 2,
        color: 'w',
        kind: 'blunder',
        played: { uci: 'g2g4', san: 'g4' },
        better: { uci: 'e2e4', san: 'e4' },
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2',
        explanation: 'После g4 у соперника мат в 1 ход. Лучше было e4.',
      },
    ],
  };
  const GAME = {
    id: GAME_ID,
    botId: 'alisa',
    userColor: 'w',
    learning: true,
    status: 'finished',
    fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    turn: 'w',
    moves: [
      { uci: 'f2f3', san: 'f3' },
      { uci: 'e7e5', san: 'e5' },
      { uci: 'g2g4', san: 'g4' },
      { uci: 'd8h4', san: 'Qh4#' },
    ],
    inCheck: true,
    hintsLeft: 3,
    result: { outcome: 'loss', reason: 'checkmate', xp: 10 },
  };

  let reads: number;

  beforeEach(() => {
    reads = 0;
    server.use(
      http.get(`${API_URL}/games/${GAME_ID}`, () => HttpResponse.json(GAME)),
      http.get(`${API_URL}/bots`, () =>
        HttpResponse.json({
          bots: [
            {
              id: 'alisa',
              kind: 'fox',
              name: 'Лиса Алиса',
              instrumental: 'Лисой Алисой',
              gender: 'f',
              level: 3,
              character: 'Хитрая.',
              summary: 'Хитрая',
              greeting: 'Сыграем?',
            },
          ],
        }),
      ),
      http.post(`${API_URL}/games/${GAME_ID}/review`, () =>
        HttpResponse.json({ status: 'pending', done: 0, total: 5, review: null, full: true }),
      ),
      http.get(`${API_URL}/games/${GAME_ID}/review`, () => {
        reads += 1;
        return HttpResponse.json(
          reads < 3
            ? { status: 'running', done: 2, total: 5, review: null, full: true }
            : { status: 'done', done: 5, total: 5, review: REVIEW, full: true },
        );
      }),
    );
  });

  it('shows the progress while the cat looks at the game, then the review', async () => {
    renderApp(`/review/${GAME_ID}`);
    expect(await screen.findByText('Гамбит разбирает партию…')).toBeInTheDocument();
    expect(
      await screen.findByRole('progressbar', { name: 'Проверено 2 из 5' }),
    ).toBeInTheDocument();

    expect(await screen.findByText('64%', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Ты — Лиса Алиса')).toBeInTheDocument();
    expect(screen.getByText('Поражение · мат на 2-м ходу')).toBeInTheDocument();
    expect(screen.getByText('★ 3 лучших')).toBeInTheDocument();
    expect(screen.getByText('?? 2 зевков')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Шансы белых по ходам' })).toBeInTheDocument();
  }, 10_000);

  it('points at a key moment on the board with the move and the better one', async () => {
    const user = userEvent.setup();
    renderApp(`/review/${GAME_ID}`);
    expect(await screen.findByText('2. g4', {}, { timeout: 6000 })).toBeInTheDocument();
    expect(
      screen.getByText('После g4 у соперника мат в 1 ход. Лучше было e4.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Показать' }));
    expect(screen.getByText('Ты сыграл: g4 · Лучше: e4')).toBeInTheDocument();
    expect(screen.getByText('Ход 2 из 4')).toBeInTheDocument();
  }, 10_000);

  it('steps through the game', async () => {
    const user = userEvent.setup();
    renderApp(`/review/${GAME_ID}`);
    await screen.findByText('Ход 4 из 4', {}, { timeout: 6000 });
    await user.click(screen.getByRole('button', { name: 'Назад' }));
    expect(screen.getByText('Ход 3 из 4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'В начало' }));
    expect(screen.getByText('Ход 0 из 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'В конец' }));
    expect(screen.getByText('Ход 4 из 4')).toBeInTheDocument();
  }, 10_000);

  it('offers another try when the review failed', async () => {
    server.use(
      http.get(`${API_URL}/games/${GAME_ID}/review`, () =>
        HttpResponse.json({ status: 'failed', done: 1, total: 5, review: null, full: true }),
      ),
    );
    renderApp(`/review/${GAME_ID}`);
    expect(await screen.findByText('Разбор не получился')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument();
  });
});
