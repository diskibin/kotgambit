import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeHandlers } from '../../test/handlers';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
let verified: boolean;
let resent: number;

beforeEach(() => {
  verified = false;
  resent = 0;
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json({ ...USER, emailVerified: verified })
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/entitlements`, () =>
      HttpResponse.json({
        premium: false,
        puzzles: { limit: 10, left: 10 },
        analysis: { limit: 5, left: 5 },
        fullReview: false,
        cards: false,
      }),
    ),
    http.get(`${API_URL}/auth/oauth/providers`, () => HttpResponse.json({ providers: [] })),
    ...homeHandlers(),
    http.post(`${API_URL}/auth/email/resend`, () => {
      resent += 1;
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});

const open = async () => {
  renderApp('/analysis');
  await screen.findByRole('heading', { name: 'Анализ позиции', level: 1 });
};

describe('the reminder to confirm the email', () => {
  it('asks to open the link from the email, naming the address', async () => {
    await open();
    const reminder = await screen.findByRole('region', { name: 'Подтверди почту' });
    expect(reminder).toHaveTextContent(`Мы отправили письмо на ${USER.email}`);
  });

  it('is not shown when the address is confirmed', async () => {
    verified = true;
    await open();
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Подтверди почту' })).toBeNull(),
    );
  });

  it('waits before the email can be sent again, then sends it', async () => {
    // The countdown of the button runs on timers, so they are the test's from the start
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open();
    await screen.findByRole('region', { name: 'Подтверди почту' });
    expect(screen.getByRole('button', { name: 'Отправить ещё раз через 0:45' })).toBeDisabled();

    // One second at a time: every tick of the countdown schedules the next one after it renders
    for (let second = 0; second < 46; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(await screen.findByRole('button', { name: 'Отправить письмо ещё раз' }));

    expect(
      await screen.findByText('Письмо отправлено. Если его нет пару минут, загляни в «Спам».'),
    ).toBeInTheDocument();
    expect(resent).toBe(1);
    expect(screen.getByRole('button', { name: /Отправить ещё раз через/ })).toBeDisabled();
  });

  it('goes away by itself when the learner comes back after opening the link', async () => {
    await open();
    await screen.findByRole('region', { name: 'Подтверди почту' });

    verified = true;
    window.dispatchEvent(new Event('focus'));

    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Подтверди почту' })).toBeNull(),
    );
  });
});
