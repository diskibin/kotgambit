import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const GAME_ID = '5a1c2d3e-8a56-4b52-9d6a-0c1c6e1f7a22';

const bot = (
  id: string,
  kind: string,
  name: string,
  instrumental: string,
  gender: string,
  level: number,
  character: string,
) => ({
  id,
  kind,
  name,
  instrumental,
  gender,
  level,
  character,
  summary: character,
  greeting: 'Сыграем?',
});
const BOTS = {
  bots: [
    bot('misha', 'mouse', 'Мышонок Миша', 'Мышонком Мишей', 'm', 1, 'Только учится.'),
    bot('alisa', 'fox', 'Лиса Алиса', 'Лисой Алисой', 'f', 3, 'Хитрая, любит ловушки.'),
    bot('mikhail', 'bear', 'Медведь Михаил', 'Медведем Михаилом', 'm', 6, 'Самый сильный.'),
  ],
};

const game = (overrides: Record<string, unknown> = {}) => ({
  id: GAME_ID,
  botId: 'alisa',
  userColor: 'w',
  learning: true,
  status: 'active',
  fen: START,
  turn: 'w',
  moves: [],
  inCheck: false,
  hintsLeft: 3,
  result: null,
  ...overrides,
});
const AFTER_ANSWER = game({
  fen: AFTER_E4_E5,
  moves: [
    { uci: 'e2e4', san: 'e4' },
    { uci: 'e7e5', san: 'e5' },
  ],
});
const WON = game({
  status: 'finished',
  moves: [{ uci: 'e2e4', san: 'e4' }],
  result: { outcome: 'win', reason: 'checkmate', xp: 30 },
});
const RESIGNED = game({
  status: 'finished',
  result: { outcome: 'loss', reason: 'resignation', xp: 10 },
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let created: unknown[];
let sentMoves: string[];
let moveAnswer: () => Record<string, unknown>;
let botMoveStatuses: number[];

beforeEach(() => {
  created = [];
  sentMoves = [];
  botMoveStatuses = [];
  moveAnswer = () => ({ result: 'ok', game: AFTER_ANSWER, botMove: { uci: 'e7e5', san: 'e5' } });
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/bots`, () => HttpResponse.json(BOTS)),
    http.get(`${API_URL}/games/active`, () => HttpResponse.json({ game: null })),
    http.get(`${API_URL}/games/${GAME_ID}`, () => HttpResponse.json(game())),
    http.post(`${API_URL}/games`, async ({ request }) => {
      created.push(await request.json());
      return HttpResponse.json(game(), { status: 201 });
    }),
    http.post(`${API_URL}/games/:id/moves`, async ({ request }) => {
      sentMoves.push(((await request.json()) as { move: string }).move);
      return HttpResponse.json(moveAnswer());
    }),
    http.post(`${API_URL}/games/:id/bot-move`, () => {
      const status = botMoveStatuses.shift() ?? 200;
      if (status === 503) {
        return HttpResponse.json(
          { code: 'server.unavailable', message: 'Сервер сейчас занят.' },
          { status, headers: { 'Retry-After': '3' } },
        );
      }
      return HttpResponse.json({
        result: 'ok',
        game: AFTER_ANSWER,
        botMove: { uci: 'e7e5', san: 'e5' },
      });
    }),
    http.post(`${API_URL}/games/:id/hint`, () => HttpResponse.json({ move: 'e2e4', hintsLeft: 2 })),
    http.post(`${API_URL}/games/:id/resign`, () => HttpResponse.json(RESIGNED)),
  );
});
afterEach(() => server.resetHandlers());

const square = (name: string) => screen.findByRole('button', { name: new RegExp(` ${name}(,|$)`) });

/** The learner plays e4: the pawn on e2 first, then the empty square e4. */
async function pawnToE4(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await square('e2'));
  await user.click(await screen.findByRole('button', { name: 'Пустая клетка e4, возможный ход' }));
}

async function openGame() {
  renderApp(`/play/${GAME_ID}`);
  await screen.findByRole('heading', { name: 'Партия с Лисой Алисой', level: 1 });
}

describe('choosing the opponent', () => {
  it('offers the bots with the fox chosen at the start', async () => {
    renderApp('/play');
    const group = await screen.findByRole('radiogroup', { name: 'Соперник' });
    const options = within(group).getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: /Лиса Алиса/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Белые' })).toBeChecked();
    expect(screen.getByRole('switch', { name: /Режим обучения/ })).toBeChecked();
  });

  it('starts a game with the chosen bot, color and mode', async () => {
    const user = userEvent.setup();
    renderApp('/play');
    await user.click(await screen.findByRole('radio', { name: /Медведь Михаил/ }));
    await user.click(screen.getByRole('radio', { name: 'Чёрные' }));
    await user.click(screen.getByRole('switch', { name: /Режим обучения/ }));
    await user.click(screen.getByRole('button', { name: 'Играть' }));
    await screen.findByRole('heading', { name: 'Партия с Лисой Алисой', level: 1 });
    expect(created).toEqual([{ botId: 'mikhail', color: 'b', learning: false }]);
  });

  it('offers to go back to a game that is not finished', async () => {
    server.use(http.get(`${API_URL}/games/active`, () => HttpResponse.json({ game: game() })));
    const user = userEvent.setup();
    renderApp('/play');
    expect(await screen.findByText('Партия с Лисой Алисой')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));
    await screen.findByRole('heading', { name: 'Партия с Лисой Алисой', level: 1 });
  });

  it('shows what the server said when a game cannot start', async () => {
    server.use(
      http.post(`${API_URL}/games`, () =>
        HttpResponse.json(
          { code: 'game.too_many_active', message: 'У тебя уже есть несколько партий.' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp('/play');
    await user.click(await screen.findByRole('button', { name: 'Играть' }));
    expect(await screen.findByText('У тебя уже есть несколько партий.')).toBeInTheDocument();
  });

  it('sends a visitor who is not signed in to the sign-in screen', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
    );
    renderApp('/play');
    expect(await screen.findByRole('tab', { name: 'Вход' })).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('shows the opponent and the learner', async () => {
    await openGame();
    expect(screen.getByText('Уровень 3 · чёрные')).toBeInTheDocument();
    expect(screen.getByText('Ты · Белые')).toBeInTheDocument();
    expect(screen.getByText('Режим обучения')).toBeInTheDocument();
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument();
  });

  it('sends the move and shows the answer of the bot in the list', async () => {
    const user = userEvent.setup();
    await openGame();
    await pawnToE4(user);
    const list = await screen.findByRole('region', { name: 'Ходы' });
    await waitFor(() => expect(within(list).getByText('e5')).toBeInTheDocument());
    expect(within(list).getByText('e4')).toBeInTheDocument();
    expect(sentMoves).toEqual(['e2e4']);
  });

  it('goes back to the position when the server refuses the move', async () => {
    moveAnswer = () => ({ result: 'illegal' });
    const user = userEvent.setup();
    await openGame();
    await pawnToE4(user);
    await waitFor(() => expect(sentMoves).toEqual(['e2e4']));
    // The pawn is on e2 again and can be picked up once more
    expect(await square('e2')).toBeEnabled();
    expect(screen.getByText('Ходов пока нет')).toBeInTheDocument();
  });

  it('shows a hint as a move in the cat’s card', async () => {
    const user = userEvent.setup();
    await openGame();
    await user.click(screen.getByRole('button', { name: 'Подсказка' }));
    expect(await screen.findByText(/Ход: e4\./)).toBeInTheDocument();
  });

  it('has no hints and no undo in a game without the learning mode', async () => {
    server.use(
      http.get(`${API_URL}/games/${GAME_ID}`, () =>
        HttpResponse.json(game({ learning: false, hintsLeft: 0 })),
      ),
    );
    await openGame();
    expect(screen.queryByRole('button', { name: 'Подсказка' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сдаться' })).toBeInTheDocument();
  });
});

describe('a busy engine', () => {
  const afterMoveWithoutAnswer = () => ({
    result: 'ok',
    game: game({ fen: AFTER_E4, turn: 'b', moves: [{ uci: 'e2e4', san: 'e4' }] }),
    botMove: null,
  });

  it('keeps the position, says so, and plays on once the bot answers', async () => {
    moveAnswer = afterMoveWithoutAnswer;
    botMoveStatuses = [503];
    const user = userEvent.setup();
    await openGame();
    await pawnToE4(user);

    expect(await screen.findByText('Гамбит задумался')).toBeInTheDocument();
    expect(screen.getByText(/Позиция сохранена/)).toBeInTheDocument();
    expect(screen.getByText('Нет ответа')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    // The first retry meets the busy engine again, the card stays
    expect(await screen.findByText('Гамбит задумался')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Попробовать снова' }));
    const list = await screen.findByRole('region', { name: 'Ходы' });
    await waitFor(() => expect(within(list).getByText('e5')).toBeInTheDocument());
    expect(screen.queryByText('Гамбит задумался')).not.toBeInTheDocument();
  });
});

describe('the end of a game', () => {
  it('asks before giving up, and the safe answer is the main one', async () => {
    const user = userEvent.setup();
    await openGame();
    await user.click(screen.getByRole('button', { name: 'Сдаться' }));
    const dialog = await screen.findByRole('dialog', { name: 'Сдаться?' });
    expect(within(dialog).getByText('Подтверждение')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Играть дальше' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'Играть дальше' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives up and tells the XP of a game that was lost', async () => {
    const user = userEvent.setup();
    await openGame();
    await user.click(screen.getByRole('button', { name: 'Сдаться' }));
    const dialog = await screen.findByRole('dialog', { name: 'Сдаться?' });
    await user.click(within(dialog).getByRole('button', { name: 'Сдаться' }));

    const over = await screen.findByRole('dialog', { name: 'Партия окончена' });
    expect(within(over).getByText('Поражение · сдача')).toBeInTheDocument();
    expect(within(over).getByText('+10 XP за партию')).toBeInTheDocument();
    expect(
      within(over).getByText('Ничего страшного! Разбор покажет, где можно было сыграть сильнее.'),
    ).toBeInTheDocument();
  });

  it('celebrates a win', async () => {
    moveAnswer = () => ({ result: 'ok', game: WON, botMove: null });
    const user = userEvent.setup();
    await openGame();
    await pawnToE4(user);
    const over = await screen.findByRole('dialog', { name: 'Мат! Ты победил' });
    expect(within(over).getByText('Победа · мат')).toBeInTheDocument();
    expect(within(over).getByText('+30 XP')).toBeInTheDocument();
  });

  it('names the bot that won a game lost by checkmate', async () => {
    const lost = game({
      status: 'finished',
      moves: [{ uci: 'e2e4', san: 'e4' }],
      result: { outcome: 'loss', reason: 'checkmate', xp: 10 },
    });
    moveAnswer = () => ({ result: 'ok', game: lost, botMove: null });
    const user = userEvent.setup();
    await openGame();
    await pawnToE4(user);
    const over = await screen.findByRole('dialog', { name: 'Победила Лиса Алиса' });
    expect(within(over).getByText('Поражение · мат')).toBeInTheDocument();
  });

  it('starts another game with the same bot', async () => {
    server.use(http.get(`${API_URL}/games/${GAME_ID}`, () => HttpResponse.json(RESIGNED)));
    const user = userEvent.setup();
    await openGame();
    const over = await screen.findByRole('dialog', { name: 'Партия окончена' });
    await user.click(within(over).getByRole('button', { name: 'Сыграть ещё' }));
    await waitFor(() => expect(created).toEqual([{ botId: 'alisa', color: 'w', learning: true }]));
  });
});
