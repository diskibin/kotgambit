import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  window.localStorage.clear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
    http.get(`${API_URL}/billing/plans`, () =>
      HttpResponse.json({
        available: true,
        autoRenew: true,
        plans: [
          { key: 'month', priceRub: 299 },
          { key: 'year', priceRub: 2490 },
        ],
      }),
    ),
  );
});
afterEach(() => server.resetHandlers());

describe('the landing page', () => {
  it('says what the product is and leads to the first lesson', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Учись шахматам с.котом Гамбитом/ }),
    ).toBeInTheDocument();
    const start = screen.getAllByRole('link', { name: 'Начать бесплатно' });
    expect(start.length).toBeGreaterThan(0);
    for (const link of start) expect(link).toHaveAttribute('href', '/onboarding');
    expect(screen.getByRole('link', { name: 'У меня уже есть аккаунт' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('does not make a point of the age of the learner', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1, name: /Учись шахматам с.котом Гамбитом/ });
    expect(screen.getByText('Бесплатно · на русском')).toBeInTheDocument();
    expect(screen.queryByText(/с 10 лет/)).not.toBeInTheDocument();
    expect(screen.queryByText(/С какого возраста/)).not.toBeInTheDocument();
    expect(screen.queryByText(/от 10 лет/)).not.toBeInTheDocument();
  });

  it('shows the prices that the server has', async () => {
    renderApp('/');
    expect(await screen.findByText('299 ₽ в месяц')).toBeInTheDocument();
    expect(screen.getByText('или 2490 ₽ в год')).toBeInTheDocument();
  });

  it('opens one answer of the questions at a time', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const first = await screen.findByRole('button', { name: 'Это правда бесплатно?' });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    const second = screen.getByRole('button', { name: 'Нужно уметь играть в шахматы?' });
    await user.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the cookie notice away once it was answered', async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp('/');
    const notice = await screen.findByRole('region', { name: 'Cookie' });
    await user.click(within(notice).getByRole('button', { name: 'Хорошо' }));
    expect(screen.queryByRole('region', { name: 'Cookie' })).not.toBeInTheDocument();
    unmount();
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('region', { name: 'Cookie' })).not.toBeInTheDocument();
  });

  it('is replaced by the chapters for a signed-in learner', async () => {
    server.use(
      http.post(`${API_URL}/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'token-1', expiresIn: 900, user: USER }),
      ),
      http.get(`${API_URL}/users/me`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer token-1'
          ? HttpResponse.json(USER)
          : new HttpResponse(null, { status: 401 }),
      ),
      http.get(`${API_URL}/*`, () => new HttpResponse(null, { status: 500 })),
    );
    renderApp('/');
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 1, name: /Учись шахматам/ }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe('an address the site does not have', () => {
  it('says so and offers the way home', async () => {
    renderApp('/no-such-page');
    expect(
      await screen.findByRole('heading', { name: 'Гамбит потерял эту страницу' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/');
  });
});
