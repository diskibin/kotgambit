import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, renderApp } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

const noContent = () => new HttpResponse(null, { status: 204 });
const expired = () =>
  HttpResponse.json({ code: 'auth.link_expired', message: 'Ссылка устарела.' }, { status: 400 });

beforeEach(() => {
  server.use(
    http.get(`${API_URL}/users/me`, () => new HttpResponse(null, { status: 401 })),
    http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});

// The big cat that reacts to the screen, not the small one in the logo
const catMood = () =>
  document.querySelector('svg[data-mood][width="150"]')?.getAttribute('data-mood');

describe('asking for a reset link', () => {
  it('opens from the "Forgot password?" link on the sign-in screen', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(await screen.findByRole('link', { name: 'Забыли пароль?' }));
    expect(await screen.findByRole('heading', { name: 'Забыли пароль?' })).toBeInTheDocument();
    expect(catMood()).toBe('thinking');
  });

  it('explains a missing @ and sends nothing', async () => {
    const user = userEvent.setup();
    renderApp('/reset');
    await user.type(await screen.findByLabelText('Email'), 'dima.mail.ru');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
    expect(await screen.findByText('Кажется, в адресе не хватает «@».')).toBeInTheDocument();
  });

  it('sends the link and confirms with a happy cat', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/password/forgot`, async ({ request }) => {
        body = await request.json();
        return noContent();
      }),
    );
    renderApp('/reset');
    await user.type(await screen.findByLabelText('Email'), 'dima@mail.ru');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    expect(await screen.findByRole('heading', { name: 'Письмо отправлено' })).toBeInTheDocument();
    expect(
      screen.getByText('Проверь почту dima@mail.ru и перейди по ссылке из письма.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Если письма нет пару минут, загляни в папку «Спам».'),
    ).toBeInTheDocument();
    expect(body).toEqual({ email: 'dima@mail.ru' });
    expect(catMood()).toBe('happy');
  });

  it('lets the user ask again only after the pause', async () => {
    server.use(http.post(`${API_URL}/auth/password/forgot`, noContent));
    // Time still moves on its own so that MSW and user-event keep working, the pause is skipped by hand
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/reset');
    await user.type(await screen.findByLabelText('Email'), 'dima@mail.ru');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));

    const wait = await screen.findByRole('button', { name: /Отправить ещё раз через/ });
    expect(wait).toBeDisabled();

    // One act per second: each tick re-renders and only then schedules the next one
    for (let second = 0; second < 46; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    expect(screen.getByRole('button', { name: 'Отправить ещё раз' })).toBeEnabled();
  });

  it('shows the server message when the requests are throttled', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/password/forgot`, () =>
        HttpResponse.json(
          {
            code: 'http.too_many_requests',
            message: 'Слишком много попыток. Подожди немного и попробуй снова.',
          },
          { status: 429 },
        ),
      ),
    );
    renderApp('/reset');
    await user.type(await screen.findByLabelText('Email'), 'dima@mail.ru');
    await user.click(screen.getByRole('button', { name: 'Отправить ссылку' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много попыток');
  });
});

describe('choosing a new password', () => {
  const password = () => screen.getByLabelText('Новый пароль');
  const repeat = () => screen.getByLabelText('Повтори пароль');

  it('shows how strong the password is while typing', async () => {
    const user = userEvent.setup();
    renderApp('/reset?token=abc');
    await screen.findByRole('heading', { name: 'Придумай новый пароль' });
    await user.type(password(), 'Gambit2026!x');
    expect(screen.getByText('Хороший пароль: 12 символов, есть цифры')).toBeInTheDocument();
    expect(catMood()).toBe('idle');
  });

  it('asks for the same password twice', async () => {
    const user = userEvent.setup();
    renderApp('/reset?token=abc');
    await screen.findByRole('heading', { name: 'Придумай новый пароль' });
    await user.type(password(), 'gambit2026');
    await user.type(repeat(), 'gambit2027');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
    expect(await screen.findByText('Пароли не совпадают.')).toBeInTheDocument();
  });

  it('asks for at least 8 characters', async () => {
    const user = userEvent.setup();
    renderApp('/reset?token=abc');
    await screen.findByRole('heading', { name: 'Придумай новый пароль' });
    await user.type(password(), 'short');
    await user.type(repeat(), 'short');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
    expect(await screen.findByText('Минимум 8 символов.')).toBeInTheDocument();
  });

  it('saves the password and offers to sign in', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/password/reset`, async ({ request }) => {
        body = await request.json();
        return noContent();
      }),
    );
    renderApp('/reset?token=abc');
    await screen.findByRole('heading', { name: 'Придумай новый пароль' });
    await user.type(password(), 'gambit2026');
    await user.type(repeat(), 'gambit2026');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(await screen.findByRole('heading', { name: 'Пароль обновлён' })).toBeInTheDocument();
    expect(body).toEqual({ token: 'abc', password: 'gambit2026' });
    expect(catMood()).toBe('cheer');

    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeInTheDocument();
  });

  it('explains an expired link and offers a new one', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API_URL}/auth/password/reset`, expired));
    renderApp('/reset?token=old');
    await screen.findByRole('heading', { name: 'Придумай новый пароль' });
    await user.type(password(), 'gambit2026');
    await user.type(repeat(), 'gambit2026');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));

    expect(await screen.findByRole('heading', { name: 'Ссылка устарела' })).toBeInTheDocument();
    expect(screen.getByText('Ссылка больше не работает')).toBeInTheDocument();
    expect(catMood()).toBe('oops');

    await user.click(screen.getByRole('button', { name: 'Отправить новую ссылку' }));
    expect(await screen.findByRole('heading', { name: 'Забыли пароль?' })).toBeInTheDocument();
  });
});

describe('confirming the email', () => {
  it('confirms the address from the link', async () => {
    let calls = 0;
    server.use(
      http.post(`${API_URL}/auth/email/verify`, () => {
        calls += 1;
        return noContent();
      }),
    );
    renderApp('/verify?token=abc');
    expect(await screen.findByRole('heading', { name: 'Email подтверждён!' })).toBeInTheDocument();
    expect(screen.getByText('Подтверждено')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'К урокам' })).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('says so when the link no longer works', async () => {
    server.use(http.post(`${API_URL}/auth/email/verify`, expired));
    renderApp('/verify?token=old');
    expect(await screen.findByRole('heading', { name: 'Ссылка устарела' })).toBeInTheDocument();
  });

  it('treats a link without a token as an expired one', async () => {
    renderApp('/verify');
    expect(await screen.findByRole('heading', { name: 'Ссылка устарела' })).toBeInTheDocument();
  });
});

describe('wrong password banner', () => {
  it('points to the recovery page', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          { code: 'auth.invalid_credentials', message: 'Не вышло.' },
          { status: 401 },
        ),
      ),
    );
    renderApp('/login');
    await user.type(await screen.findByLabelText('Email'), 'dima@mail.ru');
    await user.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    const link = await screen.findByRole('link', { name: 'восстанови пароль' });
    expect(link).toHaveAttribute('href', '/reset');
  });
});
