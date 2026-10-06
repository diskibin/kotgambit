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

describe('the home screen', () => {
  it('shows the puzzle of the day and the sections ahead', async () => {
    server.use(...homeHandlers([...LESSONS, OPENINGS]));
    renderApp('/learn');
    expect(await screen.findByText('Задача дня')).toBeInTheDocument();
    expect(screen.getByText('Мат в 1 ход')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /Дебюты/ });
    expect(within(next).getByText('1 глава · после «Основ»')).toBeInTheDocument();
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
