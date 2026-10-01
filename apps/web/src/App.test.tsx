import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { API_URL, renderApp } from './test/renderApp';

const server = setupServer(
  http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
  http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('App', () => {
  it('renders the product title from localization', async () => {
    renderApp('/sandbox');
    expect(
      await screen.findByRole('heading', { name: 'Кот Гамбит', level: 1 }),
    ).toBeInTheDocument();
  });

  it('offers sign-in links to a visitor', async () => {
    renderApp('/sandbox');
    expect(await screen.findByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
  });
});
