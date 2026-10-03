import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { API_URL, renderApp } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  window.localStorage.clear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
  );
});
afterEach(() => server.resetHandlers());

describe('the first steps', () => {
  it('goes through the four steps and keeps the answers for the sign-up', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding');
    expect(await screen.findByRole('heading', { name: 'Привет! Я Гамбит.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(screen.getByRole('radio', { name: /Знаю основы/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /Я совсем новичок/ }));
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(screen.getByRole('radio', { name: /10 минут/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /15 минут/ }));
    await user.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(screen.getByText('Цель на день: 15 минут. Уровень: новичок.')).toBeInTheDocument();
    expect(screen.getByText('Доска и фигуры')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
    await user.click(screen.getByRole('button', { name: 'Начать урок' }));

    expect(JSON.parse(window.localStorage.getItem('kotgambit.onboarding') ?? '{}')).toEqual({
      level: 'novice',
      goal: 15,
    });
    expect(await screen.findByRole('button', { name: 'Создать аккаунт' })).toBeInTheDocument();
  });

  it('goes back a step', async () => {
    const user = userEvent.setup();
    renderApp('/onboarding/2');
    await user.click(await screen.findByRole('button', { name: 'Назад' }));
    expect(await screen.findByRole('heading', { name: 'Привет! Я Гамбит.' })).toBeInTheDocument();
  });

  it('sends an unknown step to the first one', async () => {
    renderApp('/onboarding/9');
    expect(await screen.findByRole('heading', { name: 'Привет! Я Гамбит.' })).toBeInTheDocument();
  });
});
