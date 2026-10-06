import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { API_URL, renderApp } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('the link of a reminder', () => {
  it('switches the reminders off without asking to sign in, once', async () => {
    const tokens: string[] = [];
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_URL}/reminders/unsubscribe`, async ({ request }) => {
        tokens.push(((await request.json()) as { token: string }).token);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/unsubscribe?token=abc.def');
    expect(await screen.findByText('Больше не пишем')).toBeInTheDocument();
    expect(tokens).toEqual(['abc.def']);
  });

  it('says that the link does not fit, and where to switch the reminders off instead', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_URL}/reminders/unsubscribe`, () =>
        HttpResponse.json(
          { code: 'reminders.bad_link', message: 'Эта ссылка не подходит.' },
          { status: 400 },
        ),
      ),
    );
    renderApp('/unsubscribe?token=forged');
    expect(await screen.findByText('Эта ссылка не подходит')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Открыть настройки' })).toBeInTheDocument();
  });

  it('does not call the server without a token', async () => {
    let called = false;
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${API_URL}/reminders/unsubscribe`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/unsubscribe');
    expect(await screen.findByText('Эта ссылка не подходит')).toBeInTheDocument();
    await waitFor(() => expect(called).toBe(false));
  });
});
