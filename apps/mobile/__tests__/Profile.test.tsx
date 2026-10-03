import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

const CARD_ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PROFILE = {
  displayName: 'Дмитрий',
  memberSince: '2026-09-02',
  level: { level: 4, xpInLevel: 240, xpForNext: 400 },
  xpTotal: 1240,
  streak: { current: 3, best: 9 },
  puzzles: { rating: 1040, solved: 58 },
  games: { played: 12, wins: 7, draws: 1, losses: 4 },
  week: [
    { day: '2026-09-27', done: false, today: false },
    { day: '2026-09-28', done: true, today: false },
    { day: '2026-09-29', done: true, today: false },
    { day: '2026-09-30', done: true, today: false },
    { day: '2026-10-01', done: false, today: false },
    { day: '2026-10-02', done: true, today: false },
    { day: '2026-10-03', done: true, today: true },
  ],
  achievements: [
    { key: 'first-lesson', current: 1, target: 1, unlocked: true },
    { key: 'first-mate', current: 1, target: 1, unlocked: true },
    { key: 'streak-7', current: 4, target: 7, unlocked: false },
    { key: 'review-5', current: 3, target: 5, unlocked: false },
    { key: 'beat-bear', current: 0, target: 1, unlocked: false },
  ],
  themes: [
    { key: 'pin', title: 'Связка', accuracy: 31, attempts: 8 },
    { key: 'mateIn1', title: 'Мат в 1 ход', accuracy: 82, attempts: 12 },
  ],
  cards: { due: 2, total: 3 },
};

let answers: string[];
let nextCalls: number;

type Routes = Parameters<typeof mockApi>[0];

function routes(over: Routes = {}): Routes {
  return {
    ...SIGNED_IN,
    ...HOME,
    'GET /profile': () => json(PROFILE),
    'POST /cards/next': () => {
      nextCalls += 1;
      return json(
        nextCalls === 1
          ? {
              card: { id: CARD_ID, fen: START, solver: 'w', playedSan: 'f3', moveNumber: 1 },
              summary: { due: 1, total: 1 },
            }
          : { card: null, summary: { due: 0, total: 1 } },
      );
    },
    [`POST /cards/${CARD_ID}/answer`]: async (request) => {
      const { move } = (await request.json()) as { move: string };
      answers.push(move);
      return json(
        move === 'e2e4'
          ? {
              result: 'correct',
              best: { uci: 'e2e4', san: 'e4' },
              nextInDays: 3,
              summary: { due: 0, total: 1 },
            }
          : { result: 'illegal' },
      );
    },
    ...over,
  };
}

beforeEach(async () => {
  answers = [];
  nextCalls = 0;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

async function openProfile(over: Routes = {}) {
  mockApi(routes(over));
  render(<App store={makeStore()} />);
  await press('Профиль');
  await screen.findByRole('header', { name: 'Профиль' });
}

describe('the profile', () => {
  it('shows the level, the name and how long the learner has been learning', async () => {
    await openProfile();
    expect(await screen.findByText('Дмитрий')).toBeOnTheScreen();
    expect(screen.getByText(/Ур\. 4/)).toBeOnTheScreen();
    expect(screen.getByText(/Учится с сентября 2026/)).toBeOnTheScreen();
    expect(screen.getByText('До уровня 5 · 240 / 400 XP')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Опыт на уровне 4' })).toBeOnTheScreen();
  });

  it('shows the tiles and the week', async () => {
    await openProfile();
    await screen.findByText('Дмитрий');
    expect(screen.getByLabelText('Серия 3 дня')).toBeOnTheScreen();
    expect(screen.getByLabelText('Опыт 1240')).toBeOnTheScreen();
    expect(screen.getByLabelText('Задачи 58')).toBeOnTheScreen();
    expect(screen.getByLabelText('Партии 12')).toBeOnTheScreen();
    expect(screen.getByText('серия 3 · рекорд 9')).toBeOnTheScreen();
    expect(screen.getByLabelText('сб: цель выполнена, сегодня')).toBeOnTheScreen();
    expect(screen.getByLabelText('чт: без цели')).toBeOnTheScreen();
  });

  it('counts the achievements and shows how far the others are', async () => {
    await openProfile();
    await screen.findByText('Дмитрий');
    expect(screen.getByText('2 из 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Первый урок. Открыто')).toBeOnTheScreen();
    expect(screen.getByLabelText('Серия 7 дней. 4 из 7')).toBeOnTheScreen();
    expect(screen.getByText('Ещё не было')).toBeOnTheScreen();
  });

  it('names the weakest theme', async () => {
    await openProfile();
    await screen.findByText('Дмитрий');
    expect(screen.getByText('Слабее всего «Связка». Потренируйся на ней.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Связка: 31%')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Тренировать' })).toBeOnTheScreen();
  });

  it('says so when it cannot load and offers another try', async () => {
    await openProfile({ 'GET /profile': () => new Response(null, { status: 500 }) });
    expect(
      await screen.findByText('Не получилось загрузить профиль. Попробуй ещё раз.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeOnTheScreen();
  });
});

describe('the cards', () => {
  async function openCards() {
    await openProfile();
    await screen.findByText('К повторению: 2');
    await press('Повторять');
  }

  it('asks for the move and does not name it', async () => {
    await openCards();
    expect(await screen.findByRole('header', { name: 'Ход белых' })).toBeOnTheScreen();
    expect(screen.getByText('Вспомни эту позицию')).toBeOnTheScreen();
    expect(screen.getByText('В партии ты сыграл f3 на 1-м ходу.')).toBeOnTheScreen();
    expect(screen.getByText('Осталось: 1')).toBeOnTheScreen();
  });

  it('praises the right move, says when the card comes back and goes to the next one', async () => {
    await openCards();
    await screen.findByRole('header', { name: 'Ход белых' });
    fireEvent.press(await screen.findByLabelText('Белая пешка e2'));
    fireEvent.press(await screen.findByLabelText('Пустая клетка e4, возможный ход'));

    expect(await screen.findByText('Запомнил!')).toBeOnTheScreen();
    expect(screen.getByText(/Лучше было e4\./)).toBeOnTheScreen();
    expect(screen.getByText(/Вернётся через 3 дня\./)).toBeOnTheScreen();
    expect(answers).toEqual(['e2e4']);

    await press('Дальше');
    expect(await screen.findByText('Всё повторено')).toBeOnTheScreen();
  });

  it('says when there is nothing to repeat', async () => {
    await openProfile({
      'POST /cards/next': () => json({ card: null, summary: { due: 0, total: 0 } }),
    });
    await screen.findByText('К повторению: 2');
    await press('Повторять');
    await waitFor(() => expect(screen.getByText('Всё повторено')).toBeOnTheScreen());
  });
});
