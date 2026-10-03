import { screen, waitFor } from '@testing-library/react';
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

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let patches: unknown[];
let deleted: number;

beforeEach(() => {
  patches = [];
  deleted = 0;
  window.localStorage.clear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.post(`${API_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/users/me/settings`, () =>
      HttpResponse.json({ dailyGoalMinutes: 10, displayName: null }),
    ),
    http.patch(`${API_URL}/users/me/settings`, async ({ request }) => {
      const body = (await request.json()) as { dailyGoalMinutes: number };
      patches.push(body);
      return HttpResponse.json({ dailyGoalMinutes: body.dailyGoalMinutes, displayName: null });
    }),
    http.get(`${API_URL}/progress/summary`, () =>
      HttpResponse.json({ streakDays: 3, todaySeconds: 360, goalSeconds: 600, xpTotal: 100 }),
    ),
    http.get(`${API_URL}/billing/subscription`, () => HttpResponse.json(FREE)),
    http.delete(`${API_URL}/users/me`, () => {
      deleted += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
afterEach(() => server.resetHandlers());

describe('the settings', () => {
  it('shows the account of the learner and the plan', async () => {
    renderApp('/settings');
    expect(await screen.findByText('cat@example.com')).toBeInTheDocument();
    expect(await screen.findByText('Бесплатный план')).toBeInTheDocument();
  });

  it('chooses the board theme and the coordinates', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Дерево' }));
    expect(screen.getByRole('radio', { name: 'Дерево' })).toBeChecked();
    const coordinates = screen.getByRole('switch', { name: /Координаты на доске/ });
    expect(coordinates).toBeChecked();
    await user.click(coordinates);
    expect(coordinates).not.toBeChecked();
  });

  it('sends the goal of the day to the server', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('tab', { name: '15 мин.' }));
    await waitFor(() => expect(patches).toEqual([{ dailyGoalMinutes: 15 }]));
  });

  it('deletes the account only after the learner types the word', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Удалить аккаунт' }));
    const confirm = screen.getByRole('button', { name: 'Удалить навсегда' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText(/напиши «удалить»/), 'удалить');
    await user.click(confirm);
    await waitFor(() => expect(deleted).toBe(1));
  });
});
