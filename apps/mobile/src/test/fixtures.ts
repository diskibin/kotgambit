import { empty, json } from './mockApi';

export const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
  accessory: 'none',
};

export const AUTH = {
  accessToken: 'token-1',
  refreshToken: 'refresh-1',
  expiresIn: 900,
  user: USER,
};

export const PROGRESS = { streakDays: 0, todaySeconds: 0, goalSeconds: 600, xpTotal: 0 };

export const LESSONS = [
  {
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
  },
  {
    id: 'basics-rook',
    track: 'basics',
    order: 2,
    piece: 'r',
    title: 'Как ходит ладья',
    summary: 'Ладья ездит по прямой.',
    minutes: 5,
    stepCount: 5,
    status: 'locked',
    stars: 0,
  },
];

const KNIGHT = '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1';

export const LESSON = {
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
    {
      type: 'demo',
      title: 'Смотри',
      body: 'Конь прыгает.',
      fen: KNIGHT,
      orientation: 'w',
      moves: ['g1f3'],
    },
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

/** A signed-in learner: the session comes back from the stored refresh token. */
export const SIGNED_IN = {
  'GET /users/me': (request: Request) =>
    request.headers.get('Authorization') === 'Bearer token-1' ? json(USER) : empty(401),
  'POST /auth/refresh': () => json(AUTH),
};

/** What the home screen asks for. */
export const DAILY = {
  puzzleId: 'p-1',
  fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
  lastMove: 'g7g6',
  solver: 'w',
  title: 'Мат в 1 ход',
  solved: false,
  streak: 0,
  bestStreak: 0,
};

export const HOME = {
  'GET /lessons': () => json({ lessons: LESSONS }),
  'GET /progress/summary': () => json(PROGRESS),
  'GET /puzzles/daily': () => json(DAILY),
};
