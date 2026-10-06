import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
      HttpResponse.json({ dailyGoalMinutes: 10, displayName: null, reminders: false }),
    ),
    http.patch(`${API_URL}/users/me/settings`, async ({ request }) => {
      const body = (await request.json()) as { dailyGoalMinutes: number };
      patches.push(body);
      return HttpResponse.json({
        dailyGoalMinutes: body.dailyGoalMinutes,
        displayName: null,
        reminders: false,
      });
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

  it('offers four sets of pieces, the pieces of the cat is the one chosen', async () => {
    renderApp('/settings');
    const group = await screen.findByRole('radiogroup', { name: 'Набор фигур' });
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Гамбит', 'Классика', 'Тёплые', 'Линии']);
    expect(within(group).getByRole('radio', { name: 'Гамбит' })).toBeChecked();
  });

  it('chooses a set of pieces and keeps the board theme as it was', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByRole('radio', { name: 'Дерево' }));
    await user.click(await screen.findByRole('radio', { name: 'Тёплые' }));

    const pieces = screen.getByRole('radiogroup', { name: 'Набор фигур' });
    expect(within(pieces).getByRole('radio', { name: 'Тёплые' })).toBeChecked();
    expect(within(pieces).getByRole('radio', { name: 'Гамбит' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Дерево' })).toBeChecked();
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

describe('the goal of the day', () => {
  it('says what the minutes are made of', async () => {
    renderApp('/settings');
    expect(
      await screen.findByText(
        'В цель идёт время, которое ты проводишь в главах, задачах и партиях с ботами.',
      ),
    ).toBeInTheDocument();
  });
});

describe('the reminders and the data', () => {
  it('cannot switch the reminders on before the email is confirmed', async () => {
    renderApp('/settings');
    expect(await screen.findByText(/Сначала подтверди почту/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Напоминания/ })).toBeDisabled();
  });

  it('switches the reminders on and off for a learner with a confirmed email', async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    // The server remembers what was set, and the page asks it again after a change
    let stored = false;
    const verified = { ...USER, emailVerified: true };
    server.use(
      // A request without the token gets a 401 first, which is what makes the page restore the session
      http.get(`${API_URL}/users/me`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer token-1'
          ? HttpResponse.json(verified)
          : new HttpResponse(null, { status: 401 }),
      ),
      http.get(`${API_URL}/users/me/settings`, () =>
        HttpResponse.json({ dailyGoalMinutes: 10, displayName: null, reminders: stored }),
      ),
      http.patch(`${API_URL}/users/me/settings`, async ({ request }) => {
        const body = (await request.json()) as { reminders: boolean };
        sent.push(body);
        stored = body.reminders;
        return HttpResponse.json({ dailyGoalMinutes: 10, displayName: null, reminders: stored });
      }),
    );
    renderApp('/settings');
    const reminders = await screen.findByRole('switch', { name: /Напоминания/ });
    await waitFor(() => expect(reminders).toBeEnabled());
    expect(reminders).not.toBeChecked();
    await user.click(reminders);
    await waitFor(() => expect(reminders).toBeChecked());
    await user.click(reminders);
    await waitFor(() => expect(reminders).not.toBeChecked());
    expect(sent).toEqual([{ reminders: true }, { reminders: false }]);
  });

  it('downloads all the data of the learner as a file', async () => {
    const user = userEvent.setup();
    let saved: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      saved = blob as Blob;
      return 'blob:export';
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });
    server.use(
      http.get(`${API_URL}/users/me/export`, () =>
        HttpResponse.json({
          exportedAt: '2026-10-06T10:00:00.000Z',
          account: { id: USER.id, email: USER.email },
          lessons: [],
        }),
      ),
    );
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Скачать мои данные' }));
    await waitFor(() => expect(names).toHaveLength(1));
    expect(names[0]).toMatch(/^kotgambit-\d{4}-\d{2}-\d{2}\.json$/);
    const text = await (saved as unknown as Blob).text();
    expect(JSON.parse(text)).toMatchObject({ account: { email: USER.email }, lessons: [] });
    vi.restoreAllMocks();
  });

  it('says so when the data could not be collected', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${API_URL}/users/me/export`, () => new HttpResponse(null, { status: 500 })),
    );
    renderApp('/settings');
    await user.click(await screen.findByRole('button', { name: 'Скачать мои данные' }));
    expect(await screen.findByText(/Не получилось собрать данные/)).toBeInTheDocument();
  });
});
