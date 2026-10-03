import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const PROGRESS = { streakDays: 3, todaySeconds: 360, goalSeconds: 600, xpTotal: 100 };
const FREE = {
  premium: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  autoRenew: false,
  cardLast4: null,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

const realMatchMedia = window.matchMedia;

/** Pretends the window is `width` wide for the min-width queries of the layout. */
function setWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      matches: min ? width >= Number(min[1]) : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

let subscription: Record<string, unknown>;

beforeEach(() => {
  subscription = FREE;
  const failing = new HttpResponse(null, { status: 500 });
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/progress/summary`, () => HttpResponse.json(PROGRESS)),
    http.get(`${API_URL}/billing/subscription`, () => HttpResponse.json(subscription)),
    http.get(`${API_URL}/billing/plans`, () => HttpResponse.json({ available: false, plans: [] })),
    http.get(`${API_URL}/puzzles/daily`, () => failing.clone()),
    http.get(`${API_URL}/puzzles/stats`, () => failing.clone()),
    http.get(`${API_URL}/puzzles/themes`, () => failing.clone()),
  );
});
afterEach(() => {
  server.resetHandlers();
  window.matchMedia = realMatchMedia;
});

const LINKS = ['Путь', 'Задачи', 'Играть', 'Анализ', 'Профиль'];

describe('on a wide screen', () => {
  it('has the sidebar with the five places, the lit one marked, and the title on top', async () => {
    setWidth(1440);
    renderApp('/puzzles');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    for (const name of LINKS) expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Задачи' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Путь' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByText('Кот Гамбит')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Задачи', level: 1 })).toBeInTheDocument();
  });

  it('shows the day of the cat and the avatar that leads to the profile', async () => {
    setWidth(1440);
    renderApp('/puzzles');
    expect(
      await screen.findByRole('group', { name: /Цель дня: 6 из 10 минут/ }),
    ).toBeInTheDocument();
    const avatar = screen.getByRole('link', { name: 'Профиль cat@example.com' });
    expect(avatar).toHaveAttribute('href', '/profile');
    expect(avatar).toHaveTextContent('C');
  });

  it('offers Premium in the sidebar to a free learner', async () => {
    setWidth(1440);
    renderApp('/puzzles');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    expect(await within(nav).findByText('Учись без ограничений')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Подробнее' })).toHaveAttribute(
      'href',
      '/premium',
    );
  });

  it('keeps the card of Premium away from a subscriber', async () => {
    setWidth(1440);
    subscription = { ...FREE, premium: true, status: 'active', plan: 'year' };
    renderApp('/puzzles');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    await screen.findByRole('group', { name: /Цель дня/ });
    expect(within(nav).queryByText('Учись без ограничений')).not.toBeInTheDocument();
  });
});

describe('on a tablet', () => {
  it('has the sidebar of icons: the names are in the labels, not on the screen', async () => {
    setWidth(820);
    renderApp('/analysis');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    const link = within(nav).getByRole('link', { name: 'Анализ' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveAttribute('title', 'Анализ');
    expect(link).not.toHaveTextContent('Анализ');
    expect(within(nav).queryByText('Кот Гамбит')).not.toBeInTheDocument();
    expect(await within(nav).findByRole('link', { name: 'Премиум' })).toHaveAttribute(
      'href',
      '/premium',
    );
  });
});

describe('on a phone', () => {
  it('has the bar at the bottom with the words under the icons', async () => {
    setWidth(390);
    renderApp('/play');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    for (const name of LINKS) expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Играть' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getAllByRole('link')).toHaveLength(5);
  });

  it('has only one navigation in the page', async () => {
    setWidth(390);
    renderApp('/puzzles');
    await screen.findByRole('navigation', { name: 'Основная навигация' });
    expect(screen.getAllByRole('navigation', { name: 'Основная навигация' })).toHaveLength(1);
  });
});

describe('the Premium page', () => {
  it('lights nothing in the navigation', async () => {
    setWidth(1440);
    renderApp('/premium');
    const nav = await screen.findByRole('navigation', { name: 'Основная навигация' });
    expect(within(nav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });
});

describe('the address of the site', () => {
  it('leads a learner to the chapters', async () => {
    setWidth(1440);
    server.use(http.get(`${API_URL}/lessons`, () => HttpResponse.json({ lessons: [] })));
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Мои курсы', level: 1 })).toBeInTheDocument();
  });
});
