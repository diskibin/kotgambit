import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { redirect } from '../../shared/redirect';
import { API_URL, renderApp, USER } from '../../test/renderApp';

vi.mock('../../shared/redirect', () => ({ redirect: vi.fn() }));

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const PAYMENT_ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';

const PLANS = {
  available: true,
  plans: [
    { key: 'year', priceRub: 1990 },
    { key: 'month', priceRub: 299 },
  ],
};
const NONE = {
  premium: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  autoRenew: false,
  cardLast4: null,
};
const ACTIVE = {
  premium: true,
  status: 'active',
  plan: 'year',
  currentPeriodEnd: '2027-10-03T12:00:00.000Z',
  autoRenew: true,
  cardLast4: '4477',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let subscription: Record<string, unknown>;
let checkoutBodies: unknown[];

beforeEach(() => {
  subscription = NONE;
  checkoutBodies = [];
  vi.mocked(redirect).mockClear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/billing/plans`, () => HttpResponse.json(PLANS)),
    http.get(`${API_URL}/billing/subscription`, () => HttpResponse.json(subscription)),
    http.post(`${API_URL}/billing/checkout`, async ({ request }) => {
      checkoutBodies.push(await request.json());
      return HttpResponse.json({
        paymentId: PAYMENT_ID,
        confirmationUrl: 'https://yoomoney.ru/pay/abc',
        returnUrl: 'http://localhost:5173/billing/return',
      });
    }),
  );
});
afterEach(() => server.resetHandlers());

describe('the offer', () => {
  it('shows the plans with the year chosen, the table and the terms', async () => {
    renderApp('/premium');
    expect(
      await screen.findByRole('heading', { name: 'Учись без ограничений' }),
    ).toBeInTheDocument();
    await screen.findByRole('radio', { name: /Год/ });
    const group = screen.getByRole('radiogroup', { name: 'Тариф' });
    expect(within(group).getByRole('radio', { name: /Год/ })).toBeChecked();
    expect(within(group).getByText('1990 ₽ в год')).toBeInTheDocument();
    expect(within(group).getByText('166 ₽ в месяц')).toBeInTheDocument();
    expect(within(group).getByText('Выгоднее')).toBeInTheDocument();
    expect(within(group).getByText('299 ₽ в месяц')).toBeInTheDocument();

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Премиум' })).toBeInTheDocument();
    expect(within(table).getByRole('rowheader', { name: 'Повтор ошибок' })).toBeInTheDocument();
    expect(within(table).getByText('10 в день')).toBeInTheDocument();
    expect(screen.getByText(/раз в год/)).toBeInTheDocument();
  });

  it('changes the terms with the plan', async () => {
    const user = userEvent.setup();
    renderApp('/premium');
    await screen.findByRole('heading', { name: 'Учись без ограничений' });
    await user.click(await screen.findByRole('radio', { name: /Месяц/ }));
    expect(screen.getByText(/раз в месяц/)).toBeInTheDocument();
  });

  it('starts a payment for the chosen plan, without renewal unless the learner agrees, and goes to the provider', async () => {
    const user = userEvent.setup();
    renderApp('/premium');
    await screen.findByRole('heading', { name: 'Учись без ограничений' });
    const renew = screen.getByRole('checkbox', { name: 'Продлевать автоматически' });
    expect(renew).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Оформить Премиум' }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://yoomoney.ru/pay/abc'));
    expect(checkoutBodies).toEqual([{ plan: 'year', client: 'web', autoRenew: false }]);

    await user.click(screen.getByRole('radio', { name: /Месяц/ }));
    await user.click(renew);
    await user.click(screen.getByRole('button', { name: 'Оформить Премиум' }));
    await waitFor(() => expect(checkoutBodies).toHaveLength(2));
    expect(checkoutBodies[1]).toEqual({ plan: 'month', client: 'web', autoRenew: true });
  });

  it('says so when the shop is not set up', async () => {
    server.use(
      http.get(`${API_URL}/billing/plans`, () =>
        HttpResponse.json({ available: false, plans: [] }),
      ),
    );
    renderApp('/premium');
    expect(
      await screen.findByText('Оплата пока недоступна. Загляни чуть позже.'),
    ).toBeInTheDocument();
  });

  it('says the subscription is over for a learner who had one', async () => {
    subscription = { ...ACTIVE, premium: false, status: 'expired' };
    renderApp('/premium');
    expect(await screen.findByText(/Подписка закончилась/)).toBeInTheDocument();
  });
});

describe('what the learner has', () => {
  it('shows the plan, the next charge and the card, with a way to cancel', async () => {
    subscription = ACTIVE;
    renderApp('/premium');
    expect(await screen.findByRole('heading', { name: 'У тебя Премиум' })).toBeInTheDocument();
    expect(screen.getByText('Премиум активен')).toBeInTheDocument();
    expect(screen.getByText('Год')).toBeInTheDocument();
    expect(screen.getByText('3 октября 2027')).toBeInTheDocument();
    expect(screen.getByText('Следующее списание')).toBeInTheDocument();
    expect(screen.getByText('Карта •• 4477')).toBeInTheDocument();
  });

  it('cancels and then shows how long the access lasts, with a way back', async () => {
    subscription = ACTIVE;
    server.use(
      http.post(`${API_URL}/billing/cancel`, () => {
        subscription = { ...ACTIVE, status: 'canceled', autoRenew: false };
        return HttpResponse.json(subscription);
      }),
      http.post(`${API_URL}/billing/resume`, () => {
        subscription = ACTIVE;
        return HttpResponse.json(ACTIVE);
      }),
    );
    const user = userEvent.setup();
    renderApp('/premium');
    await user.click(await screen.findByRole('button', { name: 'Отменить подписку' }));
    expect(await screen.findByRole('heading', { name: 'Подписка отменена' })).toBeInTheDocument();
    expect(screen.getByText(/Премиум работает до 3 октября 2027/)).toBeInTheDocument();
    expect(
      screen.getByText('Списаний больше не будет. Передумаешь — включи снова в один клик.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Возобновить подписку' }));
    expect(await screen.findByRole('heading', { name: 'У тебя Премиум' })).toBeInTheDocument();
  });

  it('tells about a card that did not pay and keeps the access', async () => {
    subscription = { ...ACTIVE, status: 'past_due' };
    renderApp('/premium');
    expect(
      await screen.findByText(
        'Не получилось списать оплату. Доступ сохранён на несколько дней, проверь карту.',
      ),
    ).toBeInTheDocument();
  });

  it('does not offer to cancel a subscription that is paid once', async () => {
    subscription = { ...ACTIVE, autoRenew: false, cardLast4: null };
    renderApp('/premium');
    await screen.findByRole('heading', { name: 'У тебя Премиум' });
    expect(screen.queryByRole('button', { name: 'Отменить подписку' })).not.toBeInTheDocument();
    expect(screen.getByText('Работает до')).toBeInTheDocument();
  });
});

describe('the page the learner comes back to', () => {
  const route = `/billing/return?paymentId=${PAYMENT_ID}`;
  const payment = (status: string) => ({
    paymentId: PAYMENT_ID,
    status,
    subscription: status === 'succeeded' ? ACTIVE : NONE,
  });

  it('says the payment is processing until the server says otherwise, and then that Premium is on', async () => {
    let status = 'pending';
    server.use(
      http.get(`${API_URL}/billing/payments/${PAYMENT_ID}`, () =>
        HttpResponse.json(payment(status)),
      ),
    );
    const user = userEvent.setup();
    renderApp(route);
    expect(
      await screen.findByRole('heading', { name: 'Платёж обрабатывается' }),
    ).toBeInTheDocument();

    status = 'succeeded';
    await user.click(screen.getByRole('button', { name: 'Обновить статус' }));
    expect(
      await screen.findByRole('heading', { name: 'Готово, у тебя Премиум!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Задачи без лимита')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К урокам' })).toBeInTheDocument();
  });

  it('says it kindly when the payment did not go through, and offers another try', async () => {
    server.use(
      http.get(`${API_URL}/billing/payments/${PAYMENT_ID}`, () =>
        HttpResponse.json(payment('canceled')),
      ),
    );
    renderApp(route);
    expect(
      await screen.findByRole('heading', { name: 'Не получилось оплатить' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Оплата не прошла')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Попробовать ещё' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вернуться к тарифам' })).toBeInTheDocument();
  });

  it('does not take the return for a payment: with the server saying pending it stays pending', async () => {
    server.use(
      http.get(`${API_URL}/billing/payments/${PAYMENT_ID}`, () =>
        HttpResponse.json(payment('pending')),
      ),
    );
    renderApp(`${route}&client=web`);
    expect(
      await screen.findByRole('heading', { name: 'Платёж обрабатывается' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Готово, у тебя Премиум!' }),
    ).not.toBeInTheDocument();
  });

  it('sends a link without a payment to the plans', async () => {
    renderApp('/billing/return');
    expect(
      await screen.findByRole('heading', { name: 'Учись без ограничений' }),
    ).toBeInTheDocument();
  });

  it('tells a learner coming from the app without a session to go back to the app', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
    );
    renderApp(`${route}&client=mobile`);
    expect(
      await screen.findByRole('heading', { name: 'Вернись в приложение' }),
    ).toBeInTheDocument();
  });
});

describe('the limits', () => {
  const limit = (code: string, message: string) =>
    HttpResponse.json({ code, message }, { status: 403 });

  it('turns a free learner away from a puzzle when the day is used up, with the way to Premium', async () => {
    server.use(
      http.post(`${API_URL}/puzzles/next`, () =>
        limit('puzzle.limit', 'На сегодня задачи закончились.'),
      ),
      http.get(`${API_URL}/puzzles/stats`, () =>
        HttpResponse.json({ rating: 1000, solved: 0, failed: 0, streak: 0, bestStreak: 0 }),
      ),
    );
    const user = userEvent.setup();
    renderApp('/puzzles/solve?mode=rating');
    expect(
      await screen.findByRole('heading', { name: 'На сегодня задачи закончились' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Завтра будут новые. С Премиумом — без ограничений.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Что даёт Премиум' }));
    expect(
      await screen.findByRole('heading', { name: 'Учись без ограничений' }),
    ).toBeInTheDocument();
  });

  it('closes the analysis when the limit is reached', async () => {
    server.use(
      http.post(`${API_URL}/analysis/position`, () =>
        limit('analysis.limit', 'Анализы на сегодня закончились.'),
      ),
    );
    const user = userEvent.setup();
    renderApp('/analysis');
    await screen.findByRole('heading', { name: 'Анализ позиции', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Анализировать' }));
    expect(
      await screen.findByRole('heading', { name: 'Анализы на сегодня закончились' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeDisabled();
  });

  it('says the repetition of mistakes is Premium’s', async () => {
    server.use(
      http.post(`${API_URL}/cards/next`, () => limit('premium.required', 'Это есть в Премиуме.')),
    );
    renderApp('/cards');
    expect(
      await screen.findByRole('heading', { name: 'Повтор ошибок — в Премиуме' }),
    ).toBeInTheDocument();
  });
});
