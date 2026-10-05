import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { homeHandlers } from '../../test/handlers';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const apiError = (code: string, message: string) => ({ code, message });

let signedIn = false;

beforeEach(() => {
  signedIn = false;
  server.use(
    // Nobody is signed in until a test says so: the session restore fails quietly
    http.get(`${API_URL}/users/me`, () =>
      signedIn ? HttpResponse.json(USER) : new HttpResponse(null, { status: 401 }),
    ),
    http.post(`${API_URL}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    // No provider has keys unless a test says so
    http.get(`${API_URL}/auth/oauth/providers`, () => HttpResponse.json({ providers: [] })),
    ...homeHandlers(),
  );
});
afterEach(() => server.resetHandlers());

const email = () => screen.getByLabelText('Email');
const password = () => screen.getByLabelText('Пароль');
const submit = (name: string) => screen.getByRole('button', { name });
// The big cat that reacts to the form, not the small one in the logo
const catMood = () =>
  document.querySelector('svg[data-mood][width="112"]')?.getAttribute('data-mood');

async function fill(user: ReturnType<typeof userEvent.setup>, mail: string, pass: string) {
  await user.type(email(), mail);
  await user.type(password(), pass);
}

describe('login', () => {
  it('opens on the login tab with a waving cat and no social buttons', async () => {
    renderApp('/login');
    expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Регистрация', selected: false })).toBeInTheDocument();
    expect(catMood()).toBe('wave');
    expect(submit('Войти')).toBeInTheDocument();
  });

  it('explains a missing @ and does not send anything', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await fill(user, 'dima.mail.ru', 'gambit2026');
    await user.click(submit('Войти'));

    expect(await screen.findByText('Кажется, в адресе не хватает «@».')).toBeInTheDocument();
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(catMood()).toBe('thinking');
  });

  it('signs in and leaves the login page', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/login`, () => {
        signedIn = true;
        return HttpResponse.json(AUTH);
      }),
    );
    const { store } = renderApp('/login');
    await fill(user, 'cat@example.com', 'gambit2026');
    await user.click(submit('Войти'));

    expect(await screen.findByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
    expect(store.getState().auth.status).toBe('authenticated');
  });

  it('sends the address exactly as typed and trims nothing from the password', async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(AUTH);
      }),
    );
    renderApp('/login');
    await fill(user, 'Cat@Example.com', ' pass ');
    await user.click(submit('Войти'));
    await waitFor(() => expect(body).toEqual({ email: 'Cat@Example.com', password: ' pass ' }));
  });

  it('shows a calm banner and an oops cat when the password is wrong', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(apiError('auth.invalid_credentials', 'Не получилось войти.'), {
          status: 401,
        }),
      ),
    );
    renderApp('/login');
    await fill(user, 'cat@example.com', 'wrong-password');
    await user.click(submit('Войти'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Пароль не подошёл. Проверь раскладку и Caps Lock или восстанови пароль.',
    );
    expect(password()).toHaveAttribute('aria-invalid', 'true');
    expect(catMood()).toBe('oops');
  });

  it('shows the server message when sign-in is throttled', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json(
          apiError(
            'http.too_many_requests',
            'Слишком много попыток. Подожди немного и попробуй снова.',
          ),
          { status: 429 },
        ),
      ),
    );
    renderApp('/login');
    await fill(user, 'cat@example.com', 'whatever');
    await user.click(submit('Войти'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Слишком много попыток');
  });

  it('shows the busy state while waiting', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/login`, async () => {
        await delay(200);
        signedIn = true;
        return HttpResponse.json(AUTH);
      }),
    );
    renderApp('/login');
    await fill(user, 'cat@example.com', 'gambit2026');
    await user.click(submit('Войти'));

    const busy = await screen.findByRole('button', { name: 'Входим…' });
    expect(busy).toBeDisabled();
    expect(email()).toBeDisabled();
    expect(catMood()).toBe('thinking');
    await screen.findByRole('heading', { name: 'Мои курсы' });
  });

  it('reveals the password on request', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    expect(password()).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(password()).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
    expect(password()).toHaveAttribute('type', 'password');
  });

  it('sends a signed-in visitor away from the login page', async () => {
    signedIn = true;
    server.use(
      http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
      http.get(`${API_URL}/users/me`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer token-1'
          ? HttpResponse.json(USER)
          : new HttpResponse(null, { status: 401 }),
      ),
    );
    renderApp('/login');
    expect(await screen.findByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
  });
});

describe('registration', () => {
  it('asks for at least 8 characters before sending', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    await fill(user, 'cat@example.com', 'short');
    await user.click(submit('Создать аккаунт'));
    expect(await screen.findByText('Минимум 8 символов.')).toBeInTheDocument();
    expect(password()).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates the account and signs in', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/register`, () => {
        signedIn = true;
        return HttpResponse.json(AUTH, { status: 201 });
      }),
    );
    renderApp('/register');
    expect(screen.getByText('Минимум 8 символов')).toBeInTheDocument();
    await fill(user, 'cat@example.com', 'gambit2026');
    await user.click(submit('Создать аккаунт'));
    expect(await screen.findByRole('heading', { name: 'Мои курсы' })).toBeInTheDocument();
  });

  it('offers to sign in when the email is taken and keeps the address', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/auth/register`, () =>
        HttpResponse.json(apiError('auth.email_taken', 'Эта почта уже зарегистрирована.'), {
          status: 409,
        }),
      ),
    );
    renderApp('/register');
    await fill(user, 'cat@example.com', 'gambit2026');
    await user.click(submit('Создать аккаунт'));

    expect(await screen.findByText(/Пользователь с таким email уже есть\./)).toBeInTheDocument();
    expect(catMood()).toBe('hint');

    await user.click(screen.getByRole('link', { name: 'Войти с этим email' }));
    expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeInTheDocument();
    expect(email()).toHaveValue('cat@example.com');
  });

  it('switches between the tabs and keeps the typed address', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(email(), 'cat@example.com');
    await user.click(screen.getByRole('tab', { name: 'Регистрация' }));
    expect(
      await screen.findByRole('tab', { name: 'Регистрация', selected: true }),
    ).toBeInTheDocument();
    expect(email()).toHaveValue('cat@example.com');
    expect(submit('Создать аккаунт')).toBeInTheDocument();
  });
});

describe('sign-in with a provider', () => {
  const providers = (...ids: string[]) =>
    server.use(
      http.get(`${API_URL}/auth/oauth/providers`, () => HttpResponse.json({ providers: ids })),
    );

  it('shows a button for every provider the server has keys for, in the order of the design', async () => {
    providers('yandex', 'vk', 'google');
    renderApp('/login');

    const yandex = await screen.findByRole('link', { name: 'Войти через Яндекс' });
    expect(yandex).toHaveAttribute('href', `${API_URL}/auth/oauth/yandex/start?client=web`);
    expect(screen.getByRole('link', { name: 'Войти через VK' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Войти через Google' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /^Войти через/ }).map((link) => link.textContent),
    ).toEqual(['Яндекс', 'VK', 'Google']);
  });

  it('shows only the providers that are on', async () => {
    providers('google');
    renderApp('/register');
    expect(await screen.findByRole('link', { name: 'Войти через Google' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Войти через Яндекс' })).not.toBeInTheDocument();
  });

  it('shows no buttons and no divider when no provider is on', async () => {
    renderApp('/login');
    await screen.findByRole('tab', { name: 'Вход', selected: true });
    expect(screen.queryByText('или')).not.toBeInTheDocument();
  });

  it.each([
    ['cancelled', 'Вход отменён. Можно попробовать ещё раз или войти по почте.'],
    ['failed', 'Не получилось войти через этот сервис. Попробуй ещё раз или войди по почте.'],
    ['expired', 'Вход занял слишком много времени. Попробуй ещё раз.'],
  ])('says calmly why it did not work out: %s', async (reason, message) => {
    renderApp(`/login?oauth_error=${reason}`);
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('asks for the account of the learner when the email is taken, and links after the sign-in', async () => {
    const user = userEvent.setup();
    let linked: unknown;
    server.use(
      http.post(`${API_URL}/auth/login`, () => {
        signedIn = true;
        return HttpResponse.json(AUTH);
      }),
      http.post(`${API_URL}/auth/oauth/link`, async ({ request }) => {
        linked = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/login?link=ticket-1&provider=yandex');

    expect(
      await screen.findByText(
        'Эта почта уже есть в Коте Гамбите. Войди в свой аккаунт, и мы привяжем Яндекс.',
      ),
    ).toBeInTheDocument();
    await fill(user, 'cat@example.com', 'gambit2026');
    await user.click(submit('Войти'));

    await waitFor(() => expect(linked).toEqual({ ticket: 'ticket-1' }));
  });
});
