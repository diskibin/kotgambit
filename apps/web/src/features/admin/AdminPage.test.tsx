import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const FREE = {
  premium: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  autoRenew: false,
  cardLast4: null,
};

const STATS = {
  days: 30,
  funnel: { visitors: 200, signedIn: 80, premiumView: 20, checkoutStart: 5, paid: 2 },
  daily: [
    { day: '2026-10-05', visitors: 6, registrations: 1, payments: 0, revenueKopecks: 0 },
    { day: '2026-10-06', visitors: 10, registrations: 3, payments: 1, revenueKopecks: 29_900 },
  ],
  users: { total: 1500, registered: 40, dau: 30, wau: 90, mau: 120 },
  premium: {
    active: 7,
    month: 5,
    year: 2,
    autoRenew: 4,
    canceledPaid: 1,
    newInPeriod: 2,
    renewalsInPeriod: 3,
    failedPayments: 1,
    revenueKopecks: 149_500,
    totalRevenueKopecks: 598_000,
  },
  usage: {
    gamesStarted: 50,
    gamesFinished: 40,
    puzzlesStarted: 300,
    puzzlesSolved: 220,
    lessonsCompleted: 60,
    reviewsDone: 12,
  },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let requested: string[];

beforeEach(() => {
  requested = [];
  window.localStorage.clear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/progress/summary`, () =>
      HttpResponse.json({ streakDays: 3, todaySeconds: 360, goalSeconds: 600, xpTotal: 100 }),
    ),
    http.get(`${API_URL}/billing/subscription`, () => HttpResponse.json(FREE)),
  );
});
afterEach(() => server.resetHandlers());

describe('the admin page', () => {
  it('shows the funnel with the share of the visitors and of the previous step', async () => {
    server.use(
      http.get(`${API_URL}/admin/stats`, ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('days') ?? '');
        return HttpResponse.json(STATS);
      }),
    );
    renderApp('/admin');
    const funnel = (await screen.findByRole('heading', { name: 'Воронка сайта' })).closest(
      'section',
    ) as HTMLElement;

    expect(within(funnel).getByRole('progressbar', { name: 'Зашли на сайт' })).toHaveAttribute(
      'aria-valuenow',
      '200',
    );
    expect(within(funnel).getByRole('progressbar', { name: 'Оплатили' })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
    // 80 of 200 visitors; 20 of the 80 who signed in, and 5 of those 20, are both a quarter
    expect(within(funnel).getByText(/^40% от зашедших/)).toBeInTheDocument();
    expect(within(funnel).getAllByText(/25% от прошлого шага/)).toHaveLength(2);
    expect(requested).toEqual(['30']);
  });

  it('shows the people, the premium and the money', async () => {
    server.use(http.get(`${API_URL}/admin/stats`, () => HttpResponse.json(STATS)));
    renderApp('/admin');

    const premium = (await screen.findByRole('heading', { name: 'Премиум и выручка' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(premium).getByText('5 / 2')).toBeInTheDocument();
    expect(within(premium).getByText(/^1\s495 ₽$/)).toBeInTheDocument();
    expect(within(premium).getByText(/^5\s980 ₽$/)).toBeInTheDocument();

    const users = screen
      .getByRole('heading', { name: 'Пользователи' })
      .closest('section') as HTMLElement;
    // The ones of today over the ones of the month
    expect(within(users).getByText('25%')).toBeInTheDocument();
  });

  it('asks for another period', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/admin/stats`, ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('days') ?? '');
        return HttpResponse.json(STATS);
      }),
    );
    renderApp('/admin');
    await screen.findByRole('heading', { name: 'Воронка сайта' });
    await user.click(screen.getByRole('tab', { name: '7 дн.' }));
    await waitFor(() => expect(requested).toContain('7'));
  });

  it('switches the chart between the visitors and the payments', async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API_URL}/admin/stats`, () => HttpResponse.json(STATS)));
    renderApp('/admin');
    expect(
      await screen.findByRole('img', { name: /Посетители: всего 16, лучший день — 06\.10 \(10\)/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Оплаты' }));
    expect(screen.getByRole('img', { name: /Оплаты: всего 1,/ })).toBeInTheDocument();
  });

  it('is a page that does not exist for an account that is not in the list', async () => {
    server.use(
      http.get(`${API_URL}/admin/stats`, () =>
        HttpResponse.json(
          { code: 'http.not_found', message: 'Такой страницы не нашлось.' },
          { status: 404 },
        ),
      ),
    );
    renderApp('/admin');
    expect(await screen.findByText('Гамбит потерял эту страницу')).toBeInTheDocument();
    expect(screen.queryByText('Воронка сайта')).not.toBeInTheDocument();
  });
});
