import { configureStore } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBaseQuery,
  endpoints,
  REDUCER_PATH,
  TAG_TYPES,
  type SessionAdapter,
} from './index.js';

const BASE_URL = 'http://api.test';
const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
  accessory: 'none',
};
const AUTH = { accessToken: 'fresh-token', expiresIn: 900, user: USER };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function setup(overrides: Partial<SessionAdapter> = {}, headers?: Record<string, string>) {
  let accessToken: string | null = 'stale-token';
  const session: SessionAdapter = {
    getAccessToken: () => accessToken,
    setAccessToken: vi.fn((token: string) => {
      accessToken = token;
    }),
    onSessionExpired: vi.fn(),
    ...overrides,
  };
  const api = createApi({
    reducerPath: REDUCER_PATH,
    baseQuery: createBaseQuery({ baseUrl: BASE_URL, session, ...(headers ? { headers } : {}) }),
    tagTypes: TAG_TYPES,
    endpoints,
  });
  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
  return { api, store, session };
}

describe('shared endpoints', () => {
  it('fetches and validates the health response', async () => {
    server.use(http.get(`${BASE_URL}/health`, () => HttpResponse.json({ status: 'ok' })));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.health.initiate());
    expect(result.data).toEqual({ status: 'ok' });
  });

  it('turns a response that breaks the contract into an error', async () => {
    server.use(http.get(`${BASE_URL}/health`, () => HttpResponse.json({ status: 'down' })));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.health.initiate());
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('sends the access token', async () => {
    let header: string | null = null;
    server.use(
      http.get(`${BASE_URL}/users/me`, ({ request }) => {
        header = request.headers.get('Authorization');
        return HttpResponse.json(USER);
      }),
    );
    const { api, store } = setup();
    await store.dispatch(api.endpoints.me.initiate());
    expect(header).toBe('Bearer stale-token');
  });

  it('posts credentials on login', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(AUTH);
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.login.initiate({ email: 'cat@example.com', password: 'secret' }),
    );
    expect(body).toEqual({ email: 'cat@example.com', password: 'secret' });
    expect(result).toMatchObject({ data: { accessToken: 'fresh-token' } });
  });
});

describe('account endpoints', () => {
  it('posts the address to the forgot-password route', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/auth/password/forgot`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.forgotPassword.initiate({ email: 'cat@example.com' }),
    );
    expect(body).toEqual({ email: 'cat@example.com' });
    expect(result).not.toHaveProperty('error');
  });

  it('posts the token and the new password to reset', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/auth/password/reset`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { api, store } = setup();
    await store.dispatch(
      api.endpoints.resetPassword.initiate({ token: 't', password: 'new-password-1' }),
    );
    expect(body).toEqual({ token: 't', password: 'new-password-1' });
  });

  it('reports an expired link as an error with the status', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/email/verify`, () =>
        HttpResponse.json(
          { code: 'auth.link_expired', message: 'Ссылка устарела.' },
          { status: 400 },
        ),
      ),
    );
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.verifyEmail.initiate({ token: 'old' }));
    expect(result).toMatchObject({ error: { status: 400 } });
  });
});

describe('lesson endpoints', () => {
  const SUMMARY = {
    id: 'basics-board',
    track: 'basics',
    order: 1,
    piece: 'k',
    title: 'Доска и фигуры',
    summary: 'Знакомимся с доской.',
    minutes: 5,
    stepCount: 5,
    status: 'available',
    stars: 0,
  };

  it('loads the catalog', async () => {
    server.use(http.get(`${BASE_URL}/lessons`, () => HttpResponse.json({ lessons: [SUMMARY] })));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.lessons.initiate());
    expect(result.data?.lessons[0]?.title).toBe('Доска и фигуры');
  });

  it('turns a catalog that breaks the contract into an error', async () => {
    server.use(
      http.get(`${BASE_URL}/lessons`, () =>
        HttpResponse.json({ lessons: [{ ...SUMMARY, status: 'weird' }] }),
      ),
    );
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.lessons.initiate());
    expect(result.error).toBeDefined();
  });

  it('reports the finished lesson and refreshes the catalog and the progress', async () => {
    let body: unknown;
    let catalogCalls = 0;
    server.use(
      http.get(`${BASE_URL}/lessons`, () => {
        catalogCalls += 1;
        return HttpResponse.json({ lessons: [SUMMARY] });
      }),
      http.post(`${BASE_URL}/lessons/basics-board/complete`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          xp: 20,
          accuracy: 1,
          stars: 3,
          firstTime: true,
          goalReachedNow: false,
          nextLessonId: 'basics-rook',
          progress: { streakDays: 0, todaySeconds: 60, goalSeconds: 600, xpTotal: 20 },
        });
      }),
    );
    const { api, store } = setup();
    await store.dispatch(api.endpoints.lessons.initiate());
    await store.dispatch(
      api.endpoints.completeLesson.initiate({
        id: 'basics-board',
        attempts: [1, 1, 1],
        seconds: 60,
        localDate: '2026-10-01',
      }),
    );
    expect(body).toEqual({ attempts: [1, 1, 1], seconds: 60, localDate: '2026-10-01' });
    await vi.waitFor(() => expect(catalogCalls).toBe(2));
  });
});

describe('client options', () => {
  it('sends the extra headers with every request', async () => {
    let client: string | null = null;
    server.use(
      http.get(`${BASE_URL}/health`, ({ request }) => {
        client = request.headers.get('x-kotgambit-client');
        return HttpResponse.json({ status: 'ok' });
      }),
    );
    const { api, store } = setup({}, { 'x-kotgambit-client': 'mobile' });
    await store.dispatch(api.endpoints.health.initiate());
    expect(client).toBe('mobile');
  });

  it('sends the refresh token in the body on logout when given one', async () => {
    let body: unknown = 'unset';
    server.use(
      http.post(`${BASE_URL}/auth/logout`, async ({ request }) => {
        body = request.headers.get('content-type') ? await request.json() : null;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { api, store } = setup();
    await store.dispatch(api.endpoints.logout.initiate({ refreshToken: 'stored-refresh' }));
    expect(body).toEqual({ refreshToken: 'stored-refresh' });
  });
});

describe('token refresh', () => {
  let refreshCalls: number;
  beforeEach(() => {
    refreshCalls = 0;
  });

  function meHandler() {
    return http.get(`${BASE_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer fresh-token'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    );
  }

  function refreshHandler(status = 200) {
    return http.post(`${BASE_URL}/auth/refresh`, async () => {
      refreshCalls += 1;
      // The delay lets parallel requests pile up behind the first refresh
      await new Promise((resolve) => setTimeout(resolve, 20));
      return status === 200 ? HttpResponse.json(AUTH) : new HttpResponse(null, { status });
    });
  }

  it('refreshes on 401 and repeats the request with the new token', async () => {
    server.use(meHandler(), refreshHandler());
    const { api, store, session } = setup();
    const result = await store.dispatch(api.endpoints.me.initiate());
    expect(result.data).toEqual(USER);
    expect(session.setAccessToken).toHaveBeenCalledWith('fresh-token');
    expect(refreshCalls).toBe(1);
  });

  it('refreshes once for parallel requests', async () => {
    server.use(meHandler(), refreshHandler());
    const { api, store } = setup();
    const results = await Promise.all([
      store.dispatch(api.endpoints.me.initiate(undefined, { forceRefetch: true })),
      store.dispatch(
        api.endpoints.me.initiate(undefined, { forceRefetch: true, subscribe: false }),
      ),
    ]);
    expect(results.every((r) => r.data !== undefined)).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  it('ends the session when the refresh fails', async () => {
    server.use(meHandler(), refreshHandler(401));
    const { api, store, session } = setup();
    const result = await store.dispatch(api.endpoints.me.initiate());
    expect(result.error).toMatchObject({ status: 401 });
    expect(session.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the credentials are wrong', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () => new HttpResponse(null, { status: 401 })),
      refreshHandler(),
    );
    const { api, store, session } = setup();
    const result = await store.dispatch(
      api.endpoints.login.initiate({ email: 'cat@example.com', password: 'wrong' }),
    );
    expect(result.error).toMatchObject({ status: 401 });
    expect(refreshCalls).toBe(0);
    expect(session.onSessionExpired).not.toHaveBeenCalled();
  });

  it('sends the stored refresh token in the body and keeps the rotated one', async () => {
    let body: unknown;
    server.use(
      meHandler(),
      http.post(`${BASE_URL}/auth/refresh`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...AUTH, refreshToken: 'rotated-refresh' });
      }),
    );
    const setRefreshToken = vi.fn();
    const { api, store } = setup({ getRefreshToken: () => 'stored-refresh', setRefreshToken });
    await store.dispatch(api.endpoints.me.initiate());
    expect(body).toEqual({ refreshToken: 'stored-refresh' });
    expect(setRefreshToken).toHaveBeenCalledWith('rotated-refresh');
  });
});

describe('puzzle endpoints', () => {
  const PUZZLE = {
    attemptId: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
    puzzleId: '005Bm',
    fen: '4rk2/p1q5/1p3Q1b/8/1p5N/2P1p3/P3P3/2K5 b - - 0 43',
    lastMove: 'c7f7',
    solver: 'w',
    rating: 1434,
    themes: [],
  };
  const SUMMARY = {
    status: 'solved',
    rated: true,
    ratingBefore: 1000,
    ratingAfter: 1016,
    themes: [],
    streak: 1,
  };
  const STATS = { rating: 1016, solved: 1, failed: 0, streak: 1, bestStreak: 1 };

  it('starts a puzzle by mode and theme', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/puzzles/next`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(PUZZLE);
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.nextPuzzle.initiate({ mode: 'theme', theme: 'mateIn2' }),
    );
    expect(body).toEqual({ mode: 'theme', theme: 'mateIn2' });
    expect(result).toMatchObject({ data: { puzzleId: '005Bm', solver: 'w' } });
  });

  it('turns an answer that does not fit the contract into an error', async () => {
    server.use(http.post(`${BASE_URL}/puzzles/next`, () => HttpResponse.json({ fen: 'x' })));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.nextPuzzle.initiate({}));
    expect(result).toHaveProperty('error');
  });

  it('sends a move to the attempt and reads the three kinds of answer', async () => {
    const answers = [
      { result: 'illegal' },
      { result: 'wrong', mistakes: 1, summary: null },
      { result: 'correct', reply: 'f8g8', solved: false, summary: null },
    ];
    const urls: string[] = [];
    server.use(
      http.post(`${BASE_URL}/puzzles/attempts/:id/move`, ({ request }) => {
        urls.push(new URL(request.url).pathname);
        return HttpResponse.json(answers[urls.length - 1]);
      }),
    );
    const { api, store } = setup();
    const results = [];
    for (const move of ['a1a8', 'a2a3', 'h4g6']) {
      results.push(
        await store.dispatch(
          api.endpoints.puzzleMove.initiate({ attemptId: PUZZLE.attemptId, move }),
        ),
      );
    }
    expect(urls[0]).toBe(`/puzzles/attempts/${PUZZLE.attemptId}/move`);
    expect(results.map((r) => ('data' in r ? r.data?.result : null))).toEqual([
      'illegal',
      'wrong',
      'correct',
    ]);
  });

  it('refreshes the stats only when a move settled the rating', async () => {
    let statsCalls = 0;
    server.use(
      http.get(`${BASE_URL}/puzzles/stats`, () => {
        statsCalls += 1;
        return HttpResponse.json(STATS);
      }),
      http.post(`${BASE_URL}/puzzles/attempts/:id/move`, async ({ request }) => {
        const { move } = (await request.json()) as { move: string };
        return HttpResponse.json(
          move === 'f6h8'
            ? { result: 'correct', reply: null, solved: true, summary: SUMMARY }
            : { result: 'correct', reply: 'f8g8', solved: false, summary: null },
        );
      }),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.puzzleStats.initiate());
    await subscription;
    expect(statsCalls).toBe(1);

    await store.dispatch(
      api.endpoints.puzzleMove.initiate({ attemptId: PUZZLE.attemptId, move: 'h4g6' }),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(statsCalls).toBe(1);

    await store.dispatch(
      api.endpoints.puzzleMove.initiate({ attemptId: PUZZLE.attemptId, move: 'f6h8' }),
    );
    await vi.waitFor(() => expect(statsCalls).toBe(2));
    subscription.unsubscribe();
  });

  it('asks for a hint and for the solution', async () => {
    server.use(
      http.post(`${BASE_URL}/puzzles/attempts/:id/hint`, () =>
        HttpResponse.json({ level: 1, square: 'h4' }),
      ),
      http.post(`${BASE_URL}/puzzles/attempts/:id/give-up`, () =>
        HttpResponse.json({ solution: ['h4g6', 'f8g8', 'f6h8'], summary: null }),
      ),
    );
    const { api, store } = setup();
    expect(await store.dispatch(api.endpoints.puzzleHint.initiate(PUZZLE.attemptId))).toMatchObject(
      {
        data: { level: 1, square: 'h4' },
      },
    );
    expect(
      await store.dispatch(api.endpoints.puzzleGiveUp.initiate(PUZZLE.attemptId)),
    ).toMatchObject({ data: { solution: ['h4g6', 'f8g8', 'f6h8'] } });
  });

  it('loads the stats, the themes and the puzzle of the day for the learner calendar day', async () => {
    let dailyUrl = '';
    server.use(
      http.get(`${BASE_URL}/puzzles/stats`, () => HttpResponse.json(STATS)),
      http.get(`${BASE_URL}/puzzles/themes`, () =>
        HttpResponse.json({ themes: [{ key: 'fork', title: 'Вилка', count: 40, solved: 8 }] }),
      ),
      http.get(`${BASE_URL}/puzzles/daily`, ({ request }) => {
        dailyUrl = request.url;
        return HttpResponse.json({
          puzzleId: '005Bm',
          fen: PUZZLE.fen,
          lastMove: 'c7f7',
          solver: 'w',
          title: 'Мат в 2 хода',
          solved: false,
        });
      }),
    );
    const { api, store } = setup();
    expect((await store.dispatch(api.endpoints.puzzleStats.initiate())).data).toEqual(STATS);
    expect(
      (await store.dispatch(api.endpoints.puzzleThemes.initiate())).data?.themes[0],
    ).toMatchObject({
      key: 'fork',
      solved: 8,
    });
    const daily = await store.dispatch(api.endpoints.dailyPuzzle.initiate('2026-10-02'));
    expect(dailyUrl).toContain('localDate=2026-10-02');
    expect(daily.data?.title).toBe('Мат в 2 хода');
  });
});

describe('game endpoints', () => {
  const GAME = {
    id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
    botId: 'alisa',
    userColor: 'w',
    learning: true,
    status: 'active',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    moves: [],
    inCheck: false,
    hintsLeft: 3,
    result: null,
  };
  const FINISHED = {
    ...GAME,
    status: 'finished',
    result: { outcome: 'win', reason: 'checkmate', xp: 30 },
  };

  it('starts a game with the chosen bot and color', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/games`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(GAME, { status: 201 });
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.createGame.initiate({ botId: 'alisa', color: 'random' }),
    );
    expect(body).toEqual({ botId: 'alisa', color: 'random' });
    expect(result).toMatchObject({ data: { id: GAME.id, turn: 'w' } });
  });

  it('refuses an answer that does not fit the contract', async () => {
    server.use(http.post(`${BASE_URL}/games`, () => HttpResponse.json({ id: 'x' })));
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.createGame.initiate({ botId: 'alisa', color: 'w' }),
    );
    expect(result.error).toBeDefined();
  });

  it('reads the open game again once a game is over', async () => {
    let activeCalls = 0;
    server.use(
      http.get(`${BASE_URL}/games/active`, () => {
        activeCalls += 1;
        return HttpResponse.json({ game: activeCalls === 1 ? GAME : null });
      }),
      http.post(`${BASE_URL}/games/:id/moves`, () =>
        HttpResponse.json({ result: 'ok', game: FINISHED, botMove: null }),
      ),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.activeGame.initiate());
    await subscription;
    await store.dispatch(api.endpoints.gameMove.initiate({ gameId: GAME.id, move: 'd8h4' }));
    await vi.waitFor(() => expect(activeCalls).toBe(2));
    subscription.unsubscribe();
  });

  it('keeps the open game as it is after a move that did not end it', async () => {
    let activeCalls = 0;
    server.use(
      http.get(`${BASE_URL}/games/active`, () => {
        activeCalls += 1;
        return HttpResponse.json({ game: GAME });
      }),
      http.post(`${BASE_URL}/games/:id/moves`, () =>
        HttpResponse.json({ result: 'ok', game: GAME, botMove: { uci: 'e7e5', san: 'e5' } }),
      ),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.activeGame.initiate());
    await subscription;
    await store.dispatch(api.endpoints.gameMove.initiate({ gameId: GAME.id, move: 'e2e4' }));
    expect(activeCalls).toBe(1);
    subscription.unsubscribe();
  });

  it('asks for the bot move, a hint, an undo and a resignation on their own routes', async () => {
    const urls: string[] = [];
    const answer =
      (body: Record<string, unknown>) =>
      ({ request }: { request: Request }) => {
        urls.push(new URL(request.url).pathname);
        return HttpResponse.json(body);
      };
    const resigned = { ...FINISHED, result: { outcome: 'loss', reason: 'resignation', xp: 10 } };
    server.use(
      http.post(
        `${BASE_URL}/games/:id/bot-move`,
        answer({ result: 'ok', game: GAME, botMove: null }),
      ),
      http.post(`${BASE_URL}/games/:id/hint`, answer({ move: 'e2e4', hintsLeft: 2 })),
      http.post(`${BASE_URL}/games/:id/undo`, answer(GAME)),
      http.post(`${BASE_URL}/games/:id/resign`, answer(resigned)),
    );
    const { api, store } = setup();
    await store.dispatch(api.endpoints.gameBotMove.initiate(GAME.id));
    await store.dispatch(api.endpoints.gameHint.initiate(GAME.id));
    await store.dispatch(api.endpoints.gameUndo.initiate(GAME.id));
    await store.dispatch(api.endpoints.gameResign.initiate(GAME.id));
    expect(urls).toEqual(
      ['bot-move', 'hint', 'undo', 'resign'].map((end) => `/games/${GAME.id}/${end}`),
    );
  });

  it('reads one game by its id', async () => {
    server.use(http.get(`${BASE_URL}/games/${GAME.id}`, () => HttpResponse.json(GAME)));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.game.initiate(GAME.id));
    expect(result.data).toMatchObject({ id: GAME.id, botId: 'alisa' });
  });

  it('lists the bots', async () => {
    const fox = {
      id: 'alisa',
      kind: 'fox',
      name: 'Лиса Алиса',
      instrumental: 'Лисой Алисой',
      gender: 'f',
      level: 3,
      character: 'Хитрая, любит ловушки.',
      summary: 'Хитрая, любит ловушки',
      greeting: 'Сыграем?',
    };
    server.use(http.get(`${BASE_URL}/bots`, () => HttpResponse.json({ bots: [fox] })));
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.bots.initiate());
    expect(result.data?.bots[0]?.name).toBe('Лиса Алиса');
  });
});

describe('analysis and review endpoints', () => {
  const GAME_ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';
  const REVIEW = {
    accuracy: { player: 64, bot: 91 },
    counts: { best: 3, good: 2, inaccuracy: 0, mistake: 0, blunder: 2 },
    chances: [50, 55],
    qualities: ['best'],
    keyMoments: [],
    mistakes: [],
  };
  const ANALYSIS = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: 'w',
    score: { kind: 'cp', value: 25 },
    leader: 'equal',
    headline: 'Примерно равно',
    detail: 'Материал равный.',
    outlook: { white: 40, draw: 30, black: 30 },
    best: { uci: 'e2e4', san: 'e4', explanation: 'Лучший ход по оценке движка.' },
    lines: [{ score: { kind: 'cp', value: 25 }, uci: ['e2e4'], san: ['e4'] }],
    depth: 14,
  };

  it('sends the position as it is and validates the answer', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/analysis/position`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ANALYSIS);
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.analyzePosition.initiate('4k3/8/8/8/8/8/8/4K3 w'),
    );
    expect(body).toEqual({ fen: '4k3/8/8/8/8/8/8/4K3 w' });
    expect(result).toMatchObject({ data: { headline: 'Примерно равно' } });
  });

  it('hands over the reason a position was refused', async () => {
    server.use(
      http.post(`${BASE_URL}/analysis/position`, () =>
        HttpResponse.json(
          {
            code: 'analysis.invalid_position',
            message: 'У чёрных нет короля.',
            details: { problem: 'no-king', color: 'b' },
          },
          { status: 422 },
        ),
      ),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.analyzePosition.initiate('8/8/8/8/8/8/8/4K3 w'),
    );
    expect(result.error).toMatchObject({
      status: 422,
      data: { code: 'analysis.invalid_position', details: { problem: 'no-king' } },
    });
  });

  it('starts a review and reads its progress and result', async () => {
    let status = 'running';
    server.use(
      http.post(`${BASE_URL}/games/${GAME_ID}/review`, () =>
        HttpResponse.json({ status: 'pending', done: 0, total: 5, review: null, full: true }),
      ),
      http.get(`${BASE_URL}/games/${GAME_ID}/review`, () =>
        HttpResponse.json(
          status === 'done'
            ? { status, done: 5, total: 5, review: REVIEW, full: true }
            : { status, done: 2, total: 5, review: null, full: true },
        ),
      ),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.review.initiate(GAME_ID));
    expect(await subscription).toMatchObject({ data: { status: 'running', done: 2 } });

    status = 'done';
    await store.dispatch(api.endpoints.startReview.initiate(GAME_ID));
    // Starting invalidates the review, which is read again
    await vi.waitFor(() => {
      expect(api.endpoints.review.select(GAME_ID)(store.getState()).data).toMatchObject({
        status: 'done',
        review: { accuracy: { player: 64 } },
      });
    });
    subscription.unsubscribe();
  });
});

describe('profile and card endpoints', () => {
  const SUMMARY = { due: 2, total: 2 };

  it('reads the profile for the learner’s day', async () => {
    let query = '';
    server.use(
      http.get(`${BASE_URL}/profile`, ({ request }) => {
        query = new URL(request.url).search;
        return HttpResponse.json({
          displayName: null,
          memberSince: '2026-09-01',
          level: { level: 4, xpInLevel: 240, xpForNext: 400 },
          xpTotal: 840,
          streak: { current: 3, best: 9 },
          puzzles: { rating: 1040, solved: 58 },
          games: { played: 12, wins: 7, draws: 1, losses: 4 },
          week: [{ day: '2026-10-03', done: true, today: true }],
          month: [{ day: '2026-10-03', done: true, today: true }],
          ratingHistory: [],
          achievements: [{ key: 'streak-3', current: 3, target: 3, unlocked: true }],
          themes: [{ key: 'pin', title: 'Связка', accuracy: 31, attempts: 8 }],
          cards: SUMMARY,
          wardrobe: {
            selected: 'none',
            items: [
              { key: 'none', unlocked: true },
              { key: 'scarf', unlocked: true },
              { key: 'glasses', unlocked: false },
              { key: 'crown', unlocked: false },
              { key: 'hat', unlocked: false },
              { key: 'medal', unlocked: false },
            ],
          },
        });
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(api.endpoints.profile.initiate('2026-10-03'));
    expect(query).toBe('?localDate=2026-10-03');
    expect(result.data?.level).toEqual({ level: 4, xpInLevel: 240, xpForNext: 400 });
  });

  it('takes a card, answers it and reads the summary again afterwards', async () => {
    let summaryReads = 0;
    server.use(
      http.get(`${BASE_URL}/cards/summary`, () => {
        summaryReads += 1;
        return HttpResponse.json(SUMMARY);
      }),
      http.post(`${BASE_URL}/cards/next`, () =>
        HttpResponse.json({
          card: {
            id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            solver: 'w',
            playedSan: 'f3',
            moveNumber: 1,
          },
          summary: SUMMARY,
        }),
      ),
      http.post(`${BASE_URL}/cards/:id/answer`, async ({ request }) => {
        const { move } = (await request.json()) as { move: string };
        return HttpResponse.json(
          move === 'e2e4'
            ? {
                result: 'correct',
                best: { uci: 'e2e4', san: 'e4' },
                nextInDays: 1,
                summary: { due: 1, total: 2 },
              }
            : { result: 'illegal' },
        );
      }),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.cardSummary.initiate());
    await subscription;
    const next = await store.dispatch(api.endpoints.nextCard.initiate());
    const cardId = next.data?.card?.id ?? '';

    // A refused move changes nothing, so the summary is not read again
    await store.dispatch(api.endpoints.answerCard.initiate({ cardId, move: 'e2e5' }));
    expect(summaryReads).toBe(1);

    await store.dispatch(api.endpoints.answerCard.initiate({ cardId, move: 'e2e4' }));
    await vi.waitFor(() => expect(summaryReads).toBe(2));
    subscription.unsubscribe();
  });

  it('makes cards from the mistakes of a game', async () => {
    server.use(
      http.post(`${BASE_URL}/games/:id/review/cards`, () =>
        HttpResponse.json({ created: 2, summary: SUMMARY }),
      ),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.makeCards.initiate('3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11'),
    );
    expect(result.data).toEqual({ created: 2, summary: SUMMARY });
  });
});

describe('billing endpoints', () => {
  const VIEW = {
    premium: true,
    status: 'active',
    plan: 'year',
    currentPeriodEnd: '2027-10-03T12:00:00.000Z',
    autoRenew: true,
    cardLast4: '4477',
  };

  it('starts a payment with the plan, the client and the consent, and gets the page to pay on', async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE_URL}/billing/checkout`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          paymentId: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
          confirmationUrl: 'https://yoomoney.ru/pay/abc',
          returnUrl: 'https://kotgambit.example/billing/return?paymentId=x&client=mobile',
        });
      }),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.checkout.initiate({ plan: 'year', client: 'mobile', autoRenew: true }),
    );
    expect(body).toEqual({ plan: 'year', client: 'mobile', autoRenew: true });
    expect(result.data?.confirmationUrl).toBe('https://yoomoney.ru/pay/abc');
  });

  it('reads the status of a payment, which the server alone decides', async () => {
    server.use(
      http.get(`${BASE_URL}/billing/payments/:id`, () =>
        HttpResponse.json({
          paymentId: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
          status: 'succeeded',
          subscription: VIEW,
        }),
      ),
    );
    const { api, store } = setup();
    const result = await store.dispatch(
      api.endpoints.payment.initiate('3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11'),
    );
    expect(result.data).toMatchObject({ status: 'succeeded', subscription: { premium: true } });
  });

  it('reads the subscription again after a cancellation', async () => {
    let reads = 0;
    server.use(
      http.get(`${BASE_URL}/billing/subscription`, () => {
        reads += 1;
        return HttpResponse.json(VIEW);
      }),
      http.post(`${BASE_URL}/billing/cancel`, () =>
        HttpResponse.json({ ...VIEW, status: 'canceled', autoRenew: false }),
      ),
    );
    const { api, store } = setup();
    const subscription = store.dispatch(api.endpoints.subscription.initiate());
    await subscription;
    await store.dispatch(api.endpoints.cancelSubscription.initiate());
    await vi.waitFor(() => expect(reads).toBe(2));
    subscription.unsubscribe();
  });

  it('reads the plans and the limits of the day', async () => {
    server.use(
      http.get(`${BASE_URL}/billing/plans`, () =>
        HttpResponse.json({
          available: true,
          plans: [
            { key: 'year', priceRub: 1990 },
            { key: 'month', priceRub: 299 },
          ],
        }),
      ),
      http.get(`${BASE_URL}/entitlements`, () =>
        HttpResponse.json({
          premium: false,
          puzzles: { limit: 10, left: 4 },
          analysis: { limit: 3, left: 1 },
          fullReview: false,
          cards: false,
        }),
      ),
    );
    const { api, store } = setup();
    expect((await store.dispatch(api.endpoints.plans.initiate())).data?.plans).toHaveLength(2);
    expect((await store.dispatch(api.endpoints.entitlements.initiate())).data?.puzzles.left).toBe(
      4,
    );
  });
});
