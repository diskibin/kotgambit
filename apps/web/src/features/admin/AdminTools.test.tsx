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
const ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';

const OVERVIEW = {
  days: 30,
  funnel: { visitors: 10, signedIn: 5, premiumView: 2, checkoutStart: 1, paid: 1 },
  daily: [{ day: '2026-10-06', visitors: 10, registrations: 1, payments: 0, revenueKopecks: 0 }],
  users: { total: 5, registered: 1, dau: 1, wau: 2, mau: 3 },
  premium: {
    active: 0,
    month: 0,
    year: 0,
    autoRenew: 0,
    canceledPaid: 0,
    newInPeriod: 0,
    renewalsInPeriod: 0,
    failedPayments: 0,
    revenueKopecks: 0,
    totalRevenueKopecks: 0,
  },
  usage: {
    gamesStarted: 0,
    gamesFinished: 0,
    puzzlesStarted: 0,
    puzzlesSolved: 0,
    lessonsCompleted: 0,
    reviewsDone: 0,
  },
};

const LEARNING = {
  days: 30,
  funnel: { registered: 20, lesson: 10, returned: 8, solvedPuzzle: 4, playedGame: 2 },
  cohorts: [
    { week: '2026-09-21', size: 10, d1: 4, d7: 2, d30: null },
    { week: '2026-09-28', size: 0, d1: 0, d7: 0, d30: null },
  ],
  lessons: [
    {
      id: 'l1',
      title: 'Как ходит пешка',
      track: 'basics',
      completed: 10,
      fromPrevious: null,
      accuracy: 85,
      attempts: 1.3,
    },
    {
      id: 'l2',
      title: 'Как ходит ладья',
      track: 'basics',
      completed: 4,
      fromPrevious: 40,
      accuracy: 70,
      attempts: 2.1,
    },
  ],
  themes: [{ theme: 'fork', attempts: 10, solved: 3 }],
};

const PAYMENTS = {
  days: 30,
  byPlan: [
    { plan: 'month', started: 4, paid: 1 },
    { plan: 'year', started: 0, paid: 0 },
  ],
  churned: 2,
  pastDue: 1,
  failures: [
    { reason: 'insufficient_funds', count: 2 },
    { reason: 'brand_new_code', count: 1 },
  ],
  recent: [
    {
      id: ID,
      createdAt: '2026-10-06T10:00:00.000Z',
      plan: 'month',
      purpose: 'initial',
      status: 'canceled',
      amountKopecks: 29_900,
      client: 'web',
      cancelReason: 'insufficient_funds',
      email: 'payer@example.com',
    },
  ],
};

const HEALTH = {
  engine: {
    workers: 3,
    busy: 1,
    queued: 2,
    completed: 500,
    rejected: 7,
    failed: 0,
    recentWaitMs: 120,
  },
  database: { ok: true, ms: 3 },
  redis: { ok: false, ms: 1 },
  process: { uptimeSeconds: 90_000, memoryMb: 210, node: 'v24.0.0' },
  games: { active: 4 },
  reviews: { pending: 1, running: 0, failedDay: 2 },
};

const account = (over: Record<string, unknown> = {}) => ({
  id: ID,
  email: 'learner@example.com',
  displayName: 'Ученик',
  emailVerified: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  lastActiveDay: '2026-10-05',
  xpTotal: 320,
  lessonsCompleted: 5,
  puzzlesSolved: 12,
  gamesPlayed: 3,
  hasPassword: true,
  providers: ['yandex'],
  subscription: null,
  payments: [],
  actions: [],
  ...over,
});

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let bodies: unknown[];
let current: ReturnType<typeof account>;

beforeEach(() => {
  bodies = [];
  current = account();
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
    http.get(`${API_URL}/admin/stats`, () => HttpResponse.json(OVERVIEW)),
    http.get(`${API_URL}/admin/learning`, () => HttpResponse.json(LEARNING)),
    http.get(`${API_URL}/admin/payments`, () => HttpResponse.json(PAYMENTS)),
    http.get(`${API_URL}/admin/health`, () => HttpResponse.json(HEALTH)),
    http.get(`${API_URL}/admin/users`, () =>
      HttpResponse.json({
        users: [
          {
            id: ID,
            email: 'learner@example.com',
            displayName: null,
            createdAt: '2026-09-01T10:00:00.000Z',
            premium: true,
          },
        ],
      }),
    ),
    http.get(`${API_URL}/admin/users/${ID}`, () => HttpResponse.json(current)),
  );
});
afterEach(() => server.resetHandlers());

async function open(section: string) {
  const user = userEvent.setup();
  renderApp('/admin');
  await screen.findByRole('heading', { name: 'Воронка сайта' });
  await user.click(screen.getByRole('tab', { name: section }));
  return user;
}

describe('learning', () => {
  it('shows the first steps, the weeks with a dash for the days that have not come, and the chapters', async () => {
    await open('Обучение');
    const funnel = (await screen.findByRole('heading', { name: 'Первые шаги новичков' })).closest(
      'section',
    ) as HTMLElement;
    expect(
      within(funnel).getByRole('progressbar', { name: 'Вернулись в другой день' }),
    ).toHaveAttribute('aria-valuenow', '8');
    expect(within(funnel).getByText(/^40% от зарегистрировавшихся/)).toBeInTheDocument();

    const cohorts = screen
      .getByRole('heading', { name: 'Возвращаемость по неделям' })
      .closest('section') as HTMLElement;
    const row = within(cohorts).getByText('21.09').closest('tr') as HTMLElement;
    // 4 of 10 after a day, 2 of 10 after a week, and the month has not come
    expect(
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['21.09', '10', '40%', '20%', '—']);

    const lessons = screen
      .getByRole('heading', { name: 'Где останавливаются на главах' })
      .closest('section') as HTMLElement;
    const rook = within(lessons).getByText('Как ходит ладья').closest('tr') as HTMLElement;
    expect(within(rook).getByText('40%')).toBeInTheDocument();
    expect(screen.getByLabelText('fork: решено 3 из 10')).toBeInTheDocument();
  });
});

describe('payments', () => {
  it('says why payments failed, in words when it knows them and in the code when it does not', async () => {
    await open('Платежи');
    const failures = (
      await screen.findByRole('heading', { name: 'Почему не прошли платежи' })
    ).closest('section') as HTMLElement;
    expect(within(failures).getByText('Не хватило денег')).toBeInTheDocument();
    expect(within(failures).getByText('brand_new_code')).toBeInTheDocument();

    const plans = screen
      .getByRole('heading', { name: 'Первые платежи по тарифам' })
      .closest('section') as HTMLElement;
    const month = within(plans).getByText('На месяц').closest('tr') as HTMLElement;
    expect(within(month).getByText('25%')).toBeInTheDocument();

    const recent = screen
      .getByRole('heading', { name: 'Последние платежи' })
      .closest('section') as HTMLElement;
    expect(within(recent).getByText('payer@example.com')).toBeInTheDocument();
    expect(within(recent).getByText(/Отменён · Не хватило денег/)).toBeInTheDocument();
  });
});

describe('the server', () => {
  it('shows the queue of the engine, a service that does not answer, and the work in the background', async () => {
    await open('Сервер');
    const engine = (await screen.findByRole('heading', { name: 'Шахматный движок' })).closest(
      'section',
    ) as HTMLElement;
    expect(within(engine).getByText('120 мс')).toBeInTheDocument();
    expect(within(engine).getByText('Отказов «занято»').nextElementSibling).toHaveTextContent('7');

    const system = screen
      .getByRole('heading', { name: 'Сервер' })
      .closest('section') as HTMLElement;
    expect(within(system).getByText('Работает, 3 мс')).toBeInTheDocument();
    expect(within(system).getByText('Не отвечает')).toBeInTheDocument();
    // 90 000 seconds is a day and an hour
    expect(within(system).getByText('1 д')).toBeInTheDocument();
  });

  it('says so when no engine is set up', async () => {
    server.use(
      http.get(`${API_URL}/admin/health`, () => HttpResponse.json({ ...HEALTH, engine: null })),
    );
    await open('Сервер');
    expect(await screen.findByText(/Движок не настроен/)).toBeInTheDocument();
  });
});

describe('the accounts', () => {
  async function openAccount() {
    const user = await open('Люди');
    await user.type(screen.getByLabelText('Почта или её часть'), 'learn');
    await user.click(screen.getByRole('button', { name: 'Найти' }));
    await user.click(await screen.findByRole('button', { name: /learner@example.com/ }));
    await screen.findByRole('heading', { name: 'learner@example.com' });
    return user;
  }

  it('finds an account and shows what it did and how it signs in', async () => {
    await openAccount();
    expect(screen.getByText(/Ученик · Почта подтверждена/)).toBeInTheDocument();
    expect(screen.getByText('320')).toBeInTheDocument();
    expect(screen.getByText(/Входит через: пароль, yandex/)).toBeInTheDocument();
    expect(screen.getByText(/Подписки не было/)).toBeInTheDocument();
  });

  it('gives Premium with a reason and shows the account after the change', async () => {
    server.use(
      http.post(`${API_URL}/admin/users/${ID}/premium`, async ({ request }) => {
        bodies.push(await request.json());
        current = account({
          subscription: {
            premium: true,
            status: 'active',
            plan: 'month',
            currentPeriodEnd: '2026-11-05T10:00:00.000Z',
            autoRenew: false,
            cardLast4: null,
          },
          actions: [
            {
              createdAt: '2026-10-06T10:00:00.000Z',
              adminEmail: 'owner@example.com',
              action: 'grant_premium',
              details: '30 дн.: Подарок',
            },
          ],
        });
        return HttpResponse.json(current);
      }),
    );
    const user = await openAccount();
    const submit = screen.getByRole('button', { name: 'Выдать' });
    // Nobody is given Premium without a reason
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText('Причина'), 'Подарок');
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(bodies).toEqual([{ days: 30, reason: 'Подарок' }]));
    expect(await screen.findByText(/активна · до 05\.11\.2026/)).toBeInTheDocument();
    expect(screen.getByText(/Выдан Премиум · 30 дн\.: Подарок/)).toBeInTheDocument();
  });

  it('asks before taking Premium away, and wants a reason', async () => {
    current = account({
      subscription: {
        premium: true,
        status: 'active',
        plan: 'year',
        currentPeriodEnd: '2027-10-05T10:00:00.000Z',
        autoRenew: true,
        cardLast4: '4477',
      },
    });
    server.use(
      http.post(`${API_URL}/admin/users/${ID}/premium/revoke`, async ({ request }) => {
        bodies.push(await request.json());
        current = account({
          subscription: {
            premium: false,
            status: 'expired',
            plan: 'year',
            currentPeriodEnd: '2026-10-06T10:00:00.000Z',
            autoRenew: false,
            cardLast4: null,
          },
        });
        return HttpResponse.json(current);
      }),
    );
    const user = await openAccount();
    expect(screen.getByText(/автопродление · карта •••• 4477/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Забрать Премиум…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Забрать Премиум?' });
    const confirm = within(dialog).getByRole('button', { name: 'Забрать' });
    expect(confirm).toBeDisabled();
    // The safe answer has the focus
    expect(within(dialog).getByRole('button', { name: 'Оставить' })).toHaveFocus();

    await user.type(within(dialog).getByLabelText('Причина'), 'Возврат');
    await user.click(confirm);
    await waitFor(() => expect(bodies).toEqual([{ reason: 'Возврат' }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/закончилась/)).toBeInTheDocument();
  });

  it('cannot take away what is not there', async () => {
    await openAccount();
    expect(screen.getByRole('button', { name: 'Забрать Премиум…' })).toBeDisabled();
  });
});
