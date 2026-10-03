import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
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
    { score: { kind: 'cp', value: -110 }, uci: ['a2a3'], san: ['a3'] },
  ],
  depth: 14,
};

let analyzed: string[];

type Routes = Parameters<typeof mockApi>[0];

function routes(over: Routes = {}): Routes {
  return {
    ...SIGNED_IN,
    ...HOME,
    'POST /analysis/position': async (request) => {
      analyzed.push(((await request.json()) as { fen: string }).fen);
      return json(ANALYSIS);
    },
    ...over,
  };
}

beforeEach(async () => {
  analyzed = [];
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

async function openEditor(over: Routes = {}) {
  mockApi(routes(over));
  render(<App store={makeStore()} />);
  await press('Анализ позиции');
  await screen.findByRole('header', { name: 'Анализ позиции' });
}

describe('the editor', () => {
  it('starts from the initial position', async () => {
    await openEditor();
    expect(screen.getByDisplayValue(START)).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Белые', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Здесь появится оценка, лучший ход и три варианта')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeOnTheScreen();
  });

  it('chooses a piece in the sheet and puts it on the board', async () => {
    await openEditor();
    await press('Очистить');
    await press('Фигуры');
    fireEvent.press(await screen.findByRole('radio', { name: 'Белый король' }));
    expect(screen.getByRole('radio', { name: 'Белый король', checked: true })).toBeOnTheScreen();
    await press('Готово');
    fireEvent.press(await screen.findByLabelText(/Пустая клетка e1/));
    expect(await screen.findByDisplayValue('8/8/8/8/8/8/8/4K3 w - - 0 1')).toBeOnTheScreen();
  });

  it('explains a position that cannot be and keeps the analysis shut', async () => {
    await openEditor();
    await press('Очистить');
    expect(await screen.findByText('Так на доске не бывает')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'У белых нет короля. Поставь белого короля, например на e1, и анализ заработает.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeDisabled();
  });

  it('loads a FEN typed into the field', async () => {
    await openEditor();
    fireEvent.changeText(screen.getByDisplayValue(START), '4k3/8/8/8/8/8/8/4K3 b - - 0 1');
    expect(await screen.findByRole('tab', { name: 'Чёрные', selected: true })).toBeOnTheScreen();
  });

  it('writes only the castling rights that the pieces allow', async () => {
    await openEditor();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Белые O-O' }));
    expect(
      await screen.findByDisplayValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w Qkq - 0 1'),
    ).toBeOnTheScreen();
    await press('Очистить');
    expect(screen.getByRole('checkbox', { name: 'Белые O-O-O' })).toBeDisabled();
  });
});

describe('the analysis', () => {
  it('shows the evaluation, the chances, the best move and the lines', async () => {
    await openEditor();
    await press('Анализировать');
    expect(await screen.findByRole('header', { name: 'Примерно равно' })).toBeOnTheScreen();
    expect(analyzed).toEqual([START]);
    expect(screen.getByText('Материал равный.')).toBeOnTheScreen();
    expect(screen.getByText('Белые 42%')).toBeOnTheScreen();
    expect(screen.getByText('★ e4')).toBeOnTheScreen();
    expect(screen.getByText('1.e4 e5')).toBeOnTheScreen();
    expect(screen.getByText('-1.1')).toBeOnTheScreen();
  });

  it('forgets the look when the position changes', async () => {
    await openEditor();
    await press('Анализировать');
    await screen.findByRole('header', { name: 'Примерно равно' });
    fireEvent.press(screen.getByRole('tab', { name: 'Чёрные' }));
    await waitFor(() =>
      expect(screen.queryByRole('header', { name: 'Примерно равно' })).not.toBeOnTheScreen(),
    );
  });

  it('says so and offers another try when the engine is busy', async () => {
    await openEditor({
      'POST /analysis/position': () =>
        json({ code: 'server.unavailable', message: 'Сервер сейчас занят.' }, 503),
    });
    await press('Анализировать');
    expect(await screen.findByText(/Гамбит задумался/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeOnTheScreen();
  });
});

describe('the review', () => {
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
  const REVIEW = {
    accuracy: { player: 64, bot: 91 },
    counts: { best: 3, good: 2, inaccuracy: 0, mistake: 0, blunder: 2 },
    chances: [50, 50, 20, 20, 0],
    qualities: ['best', 'best', 'blunder', 'best'],
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
  const BOTS = {
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
  };

  async function openReview(over: Routes = {}) {
    let reads = 0;
    mockApi(
      routes({
        'GET /bots': () => json(BOTS),
        'GET /games/active': () => json({ game: null }),
        'POST /games': () => json({ ...GAME, status: 'active', result: null }, 201),
        [`GET /games/${GAME_ID}`]: () => json(GAME),
        [`POST /games/${GAME_ID}/review`]: () =>
          json({ status: 'pending', done: 0, total: 5, review: null }),
        [`GET /games/${GAME_ID}/review`]: () => {
          reads += 1;
          return json(
            reads < 3
              ? { status: 'running', done: 2, total: 5, review: null }
              : { status: 'done', done: 5, total: 5, review: REVIEW },
          );
        },
        ...over,
      }),
    );
    render(<App store={makeStore()} />);
    await press('Играть');
    await press('Играть с Лисой Алисой');
    await screen.findByRole('header', { name: 'Лиса Алиса' });
    const review = await screen.findAllByRole('button', { name: 'Разбор партии' });
    fireEvent.press(review[0] as (typeof review)[number]);
  }

  it('shows the progress while the cat looks at the game, then the review', async () => {
    await openReview();
    expect(await screen.findByText('Гамбит разбирает партию…')).toBeOnTheScreen();
    expect(await screen.findByRole('progressbar', { name: 'Проверено 2 из 5' })).toBeOnTheScreen();

    expect(await screen.findByText('64%', {}, { timeout: 6000 })).toBeOnTheScreen();
    expect(screen.getByText('91%')).toBeOnTheScreen();
    expect(screen.getByText('Ты — Лиса Алиса')).toBeOnTheScreen();
    expect(screen.getByText('Поражение · мат на 2-м ходу')).toBeOnTheScreen();
    expect(screen.getByText('★ 3 лучших')).toBeOnTheScreen();
    expect(screen.getByText('?? 2 зевков')).toBeOnTheScreen();
    expect(screen.getByText('После g4 у соперника мат в 1 ход. Лучше было e4.')).toBeOnTheScreen();
  }, 12_000);

  it('offers another try when the review failed', async () => {
    await openReview({
      [`GET /games/${GAME_ID}/review`]: () =>
        json({ status: 'failed', done: 1, total: 5, review: null }),
    });
    expect(await screen.findByText('Разбор не получился')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeOnTheScreen();
  });
});
