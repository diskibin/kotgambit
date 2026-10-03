import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { homeHandlers, LESSONS } from '../../test/handlers';
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

describe('the home screen', () => {
  it('shows the puzzle of the day and the sections ahead', async () => {
    server.use(...homeHandlers([...LESSONS, OPENINGS]));
    renderApp('/learn');
    expect(await screen.findByText('Задача дня')).toBeInTheDocument();
    expect(screen.getByText('Мат в 1 ход')).toBeInTheDocument();
    const next = screen.getByRole('button', { name: /Дебюты/ });
    expect(within(next).getByText('1 глава · после «Основы»')).toBeInTheDocument();
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
