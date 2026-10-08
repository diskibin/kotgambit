import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { homeHandlers, LESSONS } from '../../test/handlers';
import { PROFILE } from '../../test/profile';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const OPENINGS = {
  id: 'openings-italian',
  track: 'openings',
  order: 1,
  piece: 'b',
  title: 'Итальянская партия',
  summary: 'Дебют.',
  minutes: 6,
  stepCount: 5,
  status: 'available',
  stars: 0,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  window.localStorage.clear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
  );
});
afterEach(() => server.resetHandlers());

describe('the weakest theme on the home screen', () => {
  it('offers to train the theme that goes worst, and starts it', async () => {
    const user = userEvent.setup();
    const asked: unknown[] = [];
    server.use(
      // The first handler that fits wins, so the ones of this test come before the usual ones
      http.get(`${API_URL}/profile`, () => HttpResponse.json(PROFILE)),
      http.post(`${API_URL}/puzzles/next`, async ({ request }) => {
        asked.push(await request.json());
        return HttpResponse.json(
          { code: 'puzzle.none', message: 'Подходящих задач пока нет.' },
          { status: 404 },
        );
      }),
      ...homeHandlers(),
    );
    renderApp('/learn');
    const card = (await screen.findByText('Подтяни слабую тему')).closest('section') as HTMLElement;
    expect(within(card).getByText('Связка')).toBeInTheDocument();
    expect(within(card).getByText(/Решено с первой попытки: 31%/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Тренировать' }));
    await waitFor(() => expect(asked[0]).toMatchObject({ mode: 'theme', theme: 'pin' }));
  });

  it('says nothing while there is no theme with enough tries', async () => {
    server.use(
      http.get(`${API_URL}/profile`, () => HttpResponse.json({ ...PROFILE, themes: [] })),
      ...homeHandlers(),
    );
    renderApp('/learn');
    await screen.findByText('Задача дня');
    expect(screen.queryByText('Подтяни слабую тему')).not.toBeInTheDocument();
  });

  it('is not missed when the profile cannot be read', async () => {
    server.use(...homeHandlers());
    renderApp('/learn');
    await screen.findByText('Задача дня');
    expect(screen.queryByText('Подтяни слабую тему')).not.toBeInTheDocument();
  });
});

describe('the chapters of a section', () => {
  const LOCKED_OPENINGS = { ...OPENINGS, status: 'locked' };

  it('shows whether all the chapters are shown, in the look of the switch and not only in its name', async () => {
    const user = userEvent.setup();
    server.use(...homeHandlers([...LESSONS, LOCKED_OPENINGS]));
    renderApp('/learn');
    const toggle = await screen.findByRole('button', { name: 'Все главы' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle.className).toContain('bg-surface');
    expect(toggle.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Дебюты', level: 2 })).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle.className).toContain('bg-brand');
    // A tick in the box: the state is in the shape as well as the color
    expect(toggle.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Дебюты', level: 2 })).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives the chapters of the ribbon, but the one to do now, the same height of every part', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 3 },
        { ...LESSONS[1], status: 'available' },
        {
          ...LESSONS[1],
          id: 'basics-knight',
          order: 3,
          status: 'locked',
          title: 'Очень длинное название главы про коня и его ходы',
        },
        { ...LESSONS[1], id: 'basics-bonus', order: 4, status: 'premium' },
      ]),
    );
    const { container } = renderApp('/learn');
    await screen.findByRole('heading', { name: 'Основы', level: 2 });
    const cards = [...container.querySelectorAll('article')].filter(
      (card) => !card.hasAttribute('data-current'),
    );
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      // The label row, the title of two lines and the foot do not depend on what the card says
      expect(card.querySelector('h3')?.className).toContain('h-10');
      expect(card.querySelector('h3')?.className).toContain('line-clamp-2');
      expect(card.querySelector('[class*="22px"]')).not.toBeNull();
    }
  });

  it('says "repeat" only for a chapter that was done, and "start" for one that was not', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 3 },
        { ...LESSONS[1], id: 'basics-knight', order: 2, status: 'available' },
        { ...LESSONS[1], id: 'basics-bishop', order: 3, status: 'available' },
      ]),
    );
    renderApp('/learn');
    await screen.findByRole('heading', { name: 'Основы', level: 2 }, { timeout: 5000 });
    // "Repeat" is for the chapter that was done
    const repeat = screen.getAllByRole('button', { name: /^Повторить/ });
    expect(repeat).toHaveLength(1);
    expect(repeat[0]).toHaveTextContent('Доска и фигуры');
    // The available one that is not the chapter to do now was never done: it is started, with no stars
    expect(screen.getAllByRole('button', { name: /^Начать/ })).toHaveLength(1);
    expect(screen.getAllByRole('img', { name: /Звёзд/ })).toHaveLength(1);
  });
});

describe('the home screen', () => {
  it('shows the puzzle of the day and the sections ahead', async () => {
    // The server keeps the next section closed until the Basics are done
    server.use(...homeHandlers([...LESSONS, { ...OPENINGS, status: 'locked' }]));
    renderApp('/learn');
    expect(await screen.findByText('Задача дня')).toBeInTheDocument();
    expect(screen.getByText('Мат в 1 ход')).toBeInTheDocument();
    expect(screen.getByText('Дебюты')).toBeInTheDocument();
    expect(screen.getByText('1 глава · после «Основ»')).toBeInTheDocument();
  });

  it('marks a finished section and moves on to the next one', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 3 },
        { ...LESSONS[1], status: 'completed', stars: 2 },
        OPENINGS,
      ]),
    );
    renderApp('/learn');
    // The section being learned is the one with the chapter to do now
    expect(await screen.findByRole('heading', { name: 'Дебюты', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('Раздел 2')).toBeInTheDocument();
  });

  it('does not say that an open section comes after another one', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 3 },
        { ...LESSONS[1], status: 'completed', stars: 2 },
        { ...OPENINGS, status: 'available' },
        {
          ...OPENINGS,
          id: 'tactics-1',
          track: 'tactics',
          order: 1,
          title: 'Тактика 1',
          status: 'available',
        },
      ]),
    );
    renderApp('/learn');
    await screen.findByRole('heading', { name: 'Дебюты', level: 2 });
    const other = screen.getByRole('button', { name: /Тактика/ });
    expect(within(other).getByText('1 глава')).toBeInTheDocument();
    expect(screen.queryByText(/после «/)).not.toBeInTheDocument();
  });

  it('shows the sections that are ahead in the bottom row, not the ones that are behind', async () => {
    const done = (id: string, track: string, title: string) => ({
      ...OPENINGS,
      id,
      track,
      title,
      status: 'completed',
      stars: 3,
    });
    const open = (id: string, track: string, title: string) => ({
      ...OPENINGS,
      id,
      track,
      title,
      status: 'available',
    });
    server.use(
      ...homeHandlers([
        done('b-1', 'basics', 'Основа'),
        done('p-1', 'practice', 'Практика'),
        done('o-1', 'openings', 'Дебют'),
        done('t-1', 'tactics', 'Приём'),
        open('m-1', 'middlegame', 'Миттельшпиль глава'),
        open('s-1', 'strategy', 'Стратегия глава'),
        open('x-1', 'mates', 'Мат глава'),
        open('e-1', 'endgame', 'Эндшпиль глава'),
      ]),
    );
    renderApp('/learn');
    await screen.findByRole('heading', { name: 'Миттельшпиль', level: 2 });
    expect(screen.getByText('Стратегия')).toBeInTheDocument();
    expect(screen.getByText('Типовые маты')).toBeInTheDocument();
    expect(screen.getByText('Эндшпиль')).toBeInTheDocument();
    expect(screen.queryByText('Практика')).not.toBeInTheDocument();
  });

  it('shows the section as passed when everything in it is done', async () => {
    server.use(
      ...homeHandlers([
        { ...LESSONS[0], status: 'completed', stars: 3 },
        { ...LESSONS[1], status: 'completed', stars: 2 },
      ]),
    );
    renderApp('/learn');
    expect(await screen.findByText('Раздел пройден')).toBeInTheDocument();
    expect(screen.getByText('2 из 2 глав')).toBeInTheDocument();
  });

  it('tells that the streak grew since the last visit', async () => {
    window.localStorage.setItem('kotgambit.streak-seen', '2');
    server.use(
      http.get(`${API_URL}/progress/summary`, () =>
        HttpResponse.json({ streakDays: 3, todaySeconds: 0, goalSeconds: 600, xpTotal: 0 }),
      ),
      ...homeHandlers(),
    );
    renderApp('/learn');
    expect(await screen.findByText('Серия продлена!')).toBeInTheDocument();
    expect(screen.getByText('3 дня подряд. Гамбит гордится.')).toBeInTheDocument();
  });

  it('does not tell about a streak the first time', async () => {
    server.use(
      http.get(`${API_URL}/progress/summary`, () =>
        HttpResponse.json({ streakDays: 3, todaySeconds: 0, goalSeconds: 600, xpTotal: 0 }),
      ),
      ...homeHandlers(),
    );
    renderApp('/learn');
    await screen.findByText('Задача дня');
    expect(screen.queryByText('Серия продлена!')).not.toBeInTheDocument();
  });
});
