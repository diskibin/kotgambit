import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const GAME_ID = '5a1c2d3e-8a56-4b52-9d6a-0c1c6e1f7a22';

const bot = (
  id: string,
  kind: string,
  name: string,
  instrumental: string,
  gender: string,
  level: number,
  summary: string,
) => ({
  id,
  kind,
  name,
  instrumental,
  gender,
  level,
  character: summary,
  summary,
  greeting: 'Сыграем?',
});
const BOTS = {
  bots: [
    bot('misha', 'mouse', 'Мышонок Миша', 'Мышонком Мишей', 'm', 1, 'Только учится'),
    bot('alisa', 'fox', 'Лиса Алиса', 'Лисой Алисой', 'f', 3, 'Хитрая, любит ловушки'),
    bot('mikhail', 'bear', 'Медведь Михаил', 'Медведем Михаилом', 'm', 6, 'Самый сильный'),
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

let created: unknown[];
let sentMoves: string[];
let moveAnswer: () => Record<string, unknown>;
let botMoveStatuses: number[];

type Routes = Parameters<typeof mockApi>[0];

function routes(over: Routes = {}): Routes {
  return {
    ...SIGNED_IN,
    ...HOME,
    'GET /bots': () => json(BOTS),
    'GET /games/active': () => json({ game: null }),
    [`GET /games/${GAME_ID}`]: () => json(game()),
    'POST /games': async (request) => {
      created.push(await request.json());
      return json(game(), 201);
    },
    [`POST /games/${GAME_ID}/moves`]: async (request) => {
      sentMoves.push(((await request.json()) as { move: string }).move);
      return json(moveAnswer());
    },
    [`POST /games/${GAME_ID}/bot-move`]: () => {
      const status = botMoveStatuses.shift() ?? 200;
      if (status === 503) {
        return json({ code: 'server.unavailable', message: 'Сервер сейчас занят.' }, 503);
      }
      return json({ result: 'ok', game: AFTER_ANSWER, botMove: { uci: 'e7e5', san: 'e5' } });
    },
    [`POST /games/${GAME_ID}/hint`]: () => json({ move: 'e2e4', hintsLeft: 2 }),
    [`POST /games/${GAME_ID}/resign`]: () => json(RESIGNED),
    ...over,
  };
}

beforeEach(async () => {
  created = [];
  sentMoves = [];
  botMoveStatuses = [];
  moveAnswer = () => ({ result: 'ok', game: AFTER_ANSWER, botMove: { uci: 'e7e5', san: 'e5' } });
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));
const square = (label: string) => screen.findByLabelText(label);

async function openBots(over: Routes = {}) {
  mockApi(routes(over));
  render(<App store={makeStore()} />);
  await press('Играть');
  await screen.findByRole('header', { name: 'Играть' });
}

async function openGame(over: Routes = {}) {
  await openBots(over);
  fireEvent.press(await screen.findByRole('radio', { name: /Лиса Алиса/ }));
  await press('Играть с Лисой Алисой');
  await screen.findByRole('header', { name: 'Лиса Алиса' });
}

/** The learner plays e4: the pawn on e2 first, then the empty square e4. */
async function pawnToE4() {
  fireEvent.press(await square('Белая пешка e2'));
  fireEvent.press(await square('Пустая клетка e4, возможный ход'));
}

describe('choosing the opponent', () => {
  it('offers the bots with the fox chosen at the start', async () => {
    await openBots();
    const group = await screen.findByLabelText('Соперник');
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getByRole('radio', { name: /Лиса Алиса/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Белые' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Играть с Лисой Алисой' })).toBeOnTheScreen();
  });

  it('starts a game with the chosen bot and color, and the learning mode on', async () => {
    await openBots();
    fireEvent.press(await screen.findByRole('radio', { name: /Медведь Михаил/ }));
    fireEvent.press(screen.getByRole('radio', { name: 'Чёрные' }));
    await press('Играть с Медведем Михаилом');
    await screen.findByRole('header', { name: 'Лиса Алиса' });
    expect(created).toEqual([{ botId: 'mikhail', color: 'b', learning: true }]);
  });

  it('offers to go back to a game that is not finished', async () => {
    await openBots({ 'GET /games/active': () => json({ game: game() }) });
    expect(await screen.findByText('Партия с Лисой Алисой')).toBeOnTheScreen();
    await press('Продолжить');
    await screen.findByRole('header', { name: 'Лиса Алиса' });
  });

  it('shows what the server said when a game cannot start', async () => {
    await openBots({
      'POST /games': () =>
        json({ code: 'game.too_many_active', message: 'У тебя уже есть несколько партий.' }, 409),
    });
    await press('Играть с Лисой Алисой');
    expect(await screen.findByText('У тебя уже есть несколько партий.')).toBeOnTheScreen();
  });
});

describe('playing', () => {
  it('shows the opponent and the learner', async () => {
    await openGame();
    expect(screen.getByText('Уровень 3 · чёрные')).toBeOnTheScreen();
    expect(screen.getByText('Ты · Белые')).toBeOnTheScreen();
    // The status of the opponent's card and of the learner's
    expect(screen.getAllByText('Твой ход')).toHaveLength(2);
  });

  it('sends the move and shows the answer of the bot among the last moves', async () => {
    await openGame();
    await pawnToE4();
    await waitFor(() => expect(screen.getByText('e5')).toBeOnTheScreen());
    expect(screen.getByText('e4')).toBeOnTheScreen();
    expect(sentMoves).toEqual(['e2e4']);
  });

  it('goes back to the position when the server refuses the move', async () => {
    moveAnswer = () => ({ result: 'illegal' });
    await openGame();
    await pawnToE4();
    await waitFor(() => expect(sentMoves).toEqual(['e2e4']));
    expect(await square('Белая пешка e2')).toBeOnTheScreen();
  });

  it('lists all the moves in a sheet', async () => {
    await openGame();
    await pawnToE4();
    await waitFor(() => expect(screen.getByText('e5')).toBeOnTheScreen());
    await press('Все ходы');
    expect(await screen.findByRole('header', { name: 'Ходы партии' })).toBeOnTheScreen();
    expect(screen.getByLabelText('1. e4 e5')).toBeOnTheScreen();
    await press('Закрыть');
    expect(screen.queryByRole('header', { name: 'Ходы партии' })).not.toBeOnTheScreen();
  });

  it('shows a hint as a move in the cat’s card', async () => {
    await openGame();
    await press('Подсказка');
    expect(await screen.findByText(/Ход: e4\./)).toBeOnTheScreen();
  });
});

describe('a busy engine', () => {
  it('keeps the position, says so, and plays on once the bot answers', async () => {
    moveAnswer = () => ({
      result: 'ok',
      game: game({ fen: AFTER_E4, turn: 'b', moves: [{ uci: 'e2e4', san: 'e4' }] }),
      botMove: null,
    });
    botMoveStatuses = [503];
    await openGame();
    await pawnToE4();

    expect(await screen.findByText('Гамбит задумался')).toBeOnTheScreen();
    expect(screen.getByText(/Позиция сохранена/)).toBeOnTheScreen();
    expect(screen.getByText('Нет ответа')).toBeOnTheScreen();

    await press('Попробовать снова');
    expect(await screen.findByText('Гамбит задумался')).toBeOnTheScreen();
    await press('Попробовать снова');
    await waitFor(() => expect(screen.getByText('e5')).toBeOnTheScreen());
    expect(screen.queryByText('Гамбит задумался')).not.toBeOnTheScreen();
  });
});

describe('the end of a game', () => {
  it('asks before giving up, and the safe answer is the main one', async () => {
    await openGame();
    await press('Сдаться');
    expect(await screen.findByRole('header', { name: 'Сдаться?' })).toBeOnTheScreen();
    expect(screen.getByText('Подтверждение')).toBeOnTheScreen();
    await press('Играть дальше');
    expect(screen.queryByRole('header', { name: 'Сдаться?' })).not.toBeOnTheScreen();
  });

  it('gives up and tells the XP of a game that was lost', async () => {
    await openGame();
    await press('Сдаться');
    await screen.findByRole('header', { name: 'Сдаться?' });
    // The sheet has the quiet "Сдаться" button, the one under the board is behind it
    const buttons = screen.getAllByRole('button', { name: 'Сдаться' });
    fireEvent.press(buttons[buttons.length - 1] as (typeof buttons)[number]);

    expect(await screen.findByRole('header', { name: 'Партия окончена' })).toBeOnTheScreen();
    expect(screen.getByText('Поражение · сдача')).toBeOnTheScreen();
    expect(screen.getByText('+10 XP за партию')).toBeOnTheScreen();
    // Once in the card under the board and once in the sheet
    expect(
      screen.getAllByText('Ничего страшного! Разбор покажет, где можно было сыграть сильнее.'),
    ).toHaveLength(2);
  });

  it('celebrates a win', async () => {
    moveAnswer = () => ({ result: 'ok', game: WON, botMove: null });
    await openGame();
    await pawnToE4();
    expect(await screen.findByRole('header', { name: 'Мат! Ты победил' })).toBeOnTheScreen();
    expect(screen.getByText('Победа · мат')).toBeOnTheScreen();
    expect(screen.getByText('+30 XP')).toBeOnTheScreen();
  });

  it('names the bot that won a game lost by checkmate', async () => {
    moveAnswer = () => ({
      result: 'ok',
      game: game({
        status: 'finished',
        moves: [{ uci: 'e2e4', san: 'e4' }],
        result: { outcome: 'loss', reason: 'checkmate', xp: 10 },
      }),
      botMove: null,
    });
    await openGame();
    await pawnToE4();
    expect(await screen.findByRole('header', { name: 'Победила Лиса Алиса' })).toBeOnTheScreen();
    expect(screen.getByText('Поражение · мат')).toBeOnTheScreen();
  });

  it('starts another game with the same bot', async () => {
    await openGame({ [`GET /games/${GAME_ID}`]: () => json(RESIGNED) });
    const again = await screen.findAllByRole('button', { name: 'Сыграть ещё' });
    fireEvent.press(again[0] as (typeof again)[number]);
    await waitFor(() => expect(created).toHaveLength(2));
    expect(created[1]).toEqual({ botId: 'alisa', color: 'w', learning: true });
  });
});
