import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, LESSON, LESSONS, PROGRESS, SIGNED_IN } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

const RESULT = {
  xp: 20,
  accuracy: 1,
  stars: 3,
  firstTime: true,
  goalReachedNow: false,
  nextLessonId: 'basics-rook',
  progress: { ...PROGRESS, streakDays: 1, todaySeconds: 120 },
};

let reported: unknown;

function routes(over: Record<string, (request: Request) => Response | Promise<Response>> = {}) {
  return {
    ...SIGNED_IN,
    ...HOME,
    'GET /lessons/basics-board': () => json(LESSON),
    'POST /lessons/basics-board/complete': async (request: Request) => {
      reported = await request.json();
      return json(RESULT);
    },
    ...over,
  };
}

beforeEach(async () => {
  reported = undefined;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));
const square = (label: string) => screen.findByLabelText(label);

async function startLesson() {
  mockApi(routes());
  render(<App store={makeStore()} />);
  await press('Начать');
  await screen.findByText('Теория');
}

async function playMove() {
  fireEvent.press(await square('Белый конь g1'));
  fireEvent.press(await square('Пустая клетка f3, возможный ход'));
  await press('Проверить');
}

describe('home', () => {
  it('shows the day bar and the chapters of the current section', async () => {
    mockApi(routes());
    render(<App store={makeStore()} />);

    expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
    expect(screen.getByText('Откроется позже')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Цель дня: 0 из 10 минут/)).toBeOnTheScreen();
    expect(screen.getByText('Раздел 1 · 0 из 2 глав')).toBeOnTheScreen();
    expect(screen.getByText('5 шагов · около 5 минут')).toBeOnTheScreen();
  });

  it('shows a finished chapter with its stars', async () => {
    mockApi(
      routes({
        'GET /lessons': () =>
          json({
            lessons: [
              { ...LESSONS[0], status: 'completed', stars: 2 },
              { ...LESSONS[1], status: 'available' },
            ],
          }),
      }),
    );
    render(<App store={makeStore()} />);
    expect(await screen.findByLabelText('Звёзд: 2 из 3')).toBeOnTheScreen();
    expect(screen.getByText('Раздел 1 · 1 из 2 глав')).toBeOnTheScreen();
  });
});

describe('lesson', () => {
  it('opens in focus mode with the caption and the progress bar', async () => {
    await startLesson();
    expect(screen.getByText('Основы · глава 1 · шаг 1 из 5')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Прогресс урока' })).toBeOnTheScreen();
    expect(screen.getByText('Две клетки в одну сторону и одна в сторону.')).toBeOnTheScreen();
  });

  it('goes through every kind of step and reports a clean run', async () => {
    await startLesson();

    await press('Продолжить');
    await screen.findByText('Смотри');
    expect(screen.getByText(/Досмотри показ/)).toBeOnTheScreen();
    await press('Теперь я');

    await screen.findByText('Ход конём');
    await playMove();
    expect(await screen.findByText('Вот это да! Конь смотрит на центр.')).toBeOnTheScreen();
    await press('Дальше');

    await screen.findByText('Кто ходит буквой Г?');
    fireEvent.press(screen.getByRole('radio', { name: 'Ответ A: Конь' }));
    expect(await screen.findByText('Выбран ответ A')).toBeOnTheScreen();
    await press('Проверить');
    expect(await screen.findByText('Да, конь прыгает буквой Г.')).toBeOnTheScreen();
    await press('Продолжить');

    await screen.findByText('Куда пойдёт конь');
    for (const name of ['e2', 'f3', 'h3']) fireEvent.press(await square(`Пустая клетка ${name}`));
    await press('Проверить');
    expect(await screen.findByText('Все клетки найдены.')).toBeOnTheScreen();
    await press('Дальше');

    expect(await screen.findByText('+20 XP')).toBeOnTheScreen();
    expect(reported).toMatchObject({
      attempts: [1, 1, 1, 1, 1],
      localDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(screen.getByText('100%')).toBeOnTheScreen();
    expect(screen.getByText('1 день')).toBeOnTheScreen();
  });

  it('answers a wrong choice calmly and counts the second try', async () => {
    await startLesson();
    await press('Продолжить');
    await press('Теперь я');
    await screen.findByText('Ход конём');
    fireEvent.press(await square('Белый конь g1'));
    fireEvent.press(await square('Пустая клетка h3, возможный ход'));
    await press('Проверить');

    // A mistake gets a calm card and a way forward, no scolding
    expect(await screen.findByText('Эта клетка с края, давай ещё раз.')).toBeOnTheScreen();
    expect(screen.queryByText(/неверно|неправильно/i)).toBeNull();
    await press('Показать ход');
    await press('Ещё раз');
    await playMove();
    await press('Дальше');

    await screen.findByText('Кто ходит буквой Г?');
    fireEvent.press(screen.getByRole('radio', { name: 'Ответ B: Слон' }));
    await press('Проверить');
    expect(await screen.findByText(/Слон ходит по диагонали\./)).toBeOnTheScreen();
    await press('Ещё раз');
    fireEvent.press(screen.getByRole('radio', { name: 'Ответ A: Конь' }));
    await press('Проверить');
    await press('Продолжить');

    for (const name of ['e2', 'f3', 'h3']) fireEvent.press(await square(`Пустая клетка ${name}`));
    await press('Проверить');
    await press('Дальше');

    await screen.findByText('+20 XP');
    expect(reported).toMatchObject({ attempts: [1, 1, 2, 2, 1] });
  });

  it('gives hints one after another', async () => {
    await startLesson();
    await press('Продолжить');
    await press('Теперь я');
    await screen.findByText('Ход конём');

    await press('Подсказка');
    expect(await screen.findByText('Ходи конём.')).toBeOnTheScreen();
    expect(screen.getByText('1 из 3')).toBeOnTheScreen();
    await press('Ещё подсказка');
    expect(await screen.findByText('Буква Г.')).toBeOnTheScreen();
    await press('Ещё подсказка');
    expect(screen.getByText('3 из 3')).toBeOnTheScreen();
  });

  it('asks before leaving and keeps the lesson when the learner stays', async () => {
    await startLesson();
    fireEvent.press(screen.getByRole('button', { name: 'Выйти из урока' }));

    expect(await screen.findByText('Прогресс этого урока не сохранится.')).toBeOnTheScreen();
    await press('Остаться');
    await waitFor(() =>
      expect(screen.queryByText('Прогресс этого урока не сохранится.')).toBeNull(),
    );
    expect(screen.getByText('Теория')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: 'Выйти из урока' }));
    await press('Выйти');
    expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
    expect(screen.getByText('Откроется позже')).toBeOnTheScreen();
  });

  it('says so when the chapter cannot be opened', async () => {
    mockApi(
      routes({
        'GET /lessons/basics-board': () =>
          json(
            {
              code: 'lesson.locked',
              message: 'Эта глава откроется, когда ты закончишь предыдущую.',
            },
            403,
          ),
      }),
    );
    render(<App store={makeStore()} />);
    await press('Начать');
    expect(
      await screen.findByText('Эта глава откроется, когда ты закончишь предыдущую.'),
    ).toBeOnTheScreen();
  });

  it('offers to save again when saving fails', async () => {
    let fail = true;
    mockApi(
      routes({
        'POST /lessons/basics-board/complete': () => (fail ? empty(500) : json(RESULT)),
      }),
    );
    render(<App store={makeStore()} />);
    await press('Начать');
    await screen.findByText('Теория');
    await press('Продолжить');
    await press('Теперь я');
    await playMove();
    await press('Дальше');
    fireEvent.press(await screen.findByRole('radio', { name: 'Ответ A: Конь' }));
    await press('Проверить');
    await press('Продолжить');
    for (const name of ['e2', 'f3', 'h3']) fireEvent.press(await square(`Пустая клетка ${name}`));
    await press('Проверить');
    await press('Дальше');

    expect(await screen.findByText(/Не получилось сохранить результат/)).toBeOnTheScreen();
    fail = false;
    await press('Ещё раз');
    expect(await screen.findByText('+20 XP')).toBeOnTheScreen();
  });
});
