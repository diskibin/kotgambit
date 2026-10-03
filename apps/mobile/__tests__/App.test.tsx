import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, USER, AUTH } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

const apiError = (code: string, message: string) => ({ code, message });

function renderApp() {
  render(<App store={makeStore()} />);
}

/** The first steps come first for a visitor: the way to the sign-in is on the first of them. */
async function openSignIn() {
  renderApp();
  fireEvent.press(await screen.findByRole('button', { name: 'У меня уже есть аккаунт' }));
}

/** Nobody is signed in: the session check fails quietly and the sign-in screen appears. */
const ANONYMOUS = {
  'GET /users/me': () => empty(401),
  'POST /auth/refresh': () => empty(401),
};

async function fillAndSubmit(mail: string, pass: string, button = 'Войти') {
  fireEvent.changeText(await screen.findByLabelText('Email'), mail);
  fireEvent.changeText(screen.getByLabelText('Пароль'), pass);
  fireEvent.press(screen.getByRole('button', { name: button }));
}

beforeEach(async () => {
  await Keychain.resetGenericPassword();
});

test('shows the sign-in screen with a greeting from the cat when nobody is signed in', async () => {
  mockApi(ANONYMOUS);
  await openSignIn();
  expect(await screen.findByText('С возвращением! Войди, и продолжим.')).toBeOnTheScreen();
  expect(screen.getByRole('tab', { name: 'Вход', selected: true })).toBeOnTheScreen();
});

test('explains a missing @ without calling the server', async () => {
  const fetchMock = mockApi(ANONYMOUS);
  await openSignIn();
  await fillAndSubmit('dima.mail.ru', 'gambit2026');

  expect(await screen.findByText('Кажется, в адресе не хватает «@».')).toBeOnTheScreen();
  expect(screen.getByText('Проверь адрес почты.')).toBeOnTheScreen();
  expect(fetchMock.mock.calls.some(([request]) => request.url.includes('/auth/login'))).toBe(false);
});

test('signs in, keeps the refresh token in the Keystore and opens the app', async () => {
  let marker: string | null = null;
  mockApi({
    'GET /users/me': (request) =>
      request.headers.get('Authorization') === 'Bearer token-1' ? json(USER) : empty(401),
    'POST /auth/refresh': () => empty(401),
    ...HOME,
    'POST /auth/login': (request) => {
      marker = request.headers.get('x-kotgambit-client');
      return json(AUTH);
    },
  });
  await openSignIn();
  await fillAndSubmit('cat@example.com', 'gambit2026');

  expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
  expect(marker).toBe('mobile');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('refresh-token', 'refresh-1', {
    service: 'kotgambit.refresh-token',
  });
});

test('shows a calm banner when the password is wrong', async () => {
  mockApi({
    ...ANONYMOUS,
    'POST /auth/login': () =>
      json(apiError('auth.invalid_credentials', 'Не получилось войти.'), 401),
  });
  await openSignIn();
  await fillAndSubmit('cat@example.com', 'wrong-password');

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Пароль не подошёл. Проверь раскладку и Caps Lock или восстанови пароль.',
  );
  expect(screen.getByText('Пароль что-то не подошёл.')).toBeOnTheScreen();
});

test('asks for 8 characters when registering', async () => {
  mockApi(ANONYMOUS);
  await openSignIn();
  fireEvent.press(await screen.findByRole('tab', { name: 'Регистрация' }));
  await fillAndSubmit('cat@example.com', 'short', 'Создать аккаунт');
  expect(await screen.findByText('Минимум 8 символов.')).toBeOnTheScreen();
});

test('offers to sign in when the email is taken', async () => {
  mockApi({
    ...ANONYMOUS,
    'POST /auth/register': () => json(apiError('auth.email_taken', 'Эта почта занята.'), 409),
  });
  await openSignIn();
  fireEvent.press(await screen.findByRole('tab', { name: 'Регистрация' }));
  await fillAndSubmit('cat@example.com', 'gambit2026', 'Создать аккаунт');

  expect(await screen.findByText('Кажется, мы уже знакомы!')).toBeOnTheScreen();
  fireEvent.press(screen.getByRole('link', { name: /Войти с этим email/ }));
  expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeOnTheScreen();
});

test('restores the session from the stored refresh token', async () => {
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
  let refreshBody: unknown;
  mockApi({
    'GET /users/me': (request) =>
      request.headers.get('Authorization') === 'Bearer token-1' ? json(USER) : empty(401),
    'POST /auth/refresh': async (request) => {
      refreshBody = await request.json();
      return json(AUTH);
    },
    ...HOME,
  });
  renderApp();

  expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
  expect(refreshBody).toEqual({ refreshToken: 'stored-refresh' });
});

test('signing out revokes the session and clears the Keystore', async () => {
  await Keychain.setGenericPassword('refresh-token', 'refresh-1', {
    service: 'kotgambit.refresh-token',
  });
  let logoutBody: unknown;
  mockApi({
    'GET /users/me': (request) =>
      request.headers.get('Authorization') === 'Bearer token-1' ? json(USER) : empty(401),
    'POST /auth/refresh': () => json(AUTH),
    ...HOME,
    'GET /profile': () =>
      json({
        displayName: null,
        memberSince: '2026-09-02',
        level: { level: 1, xpInLevel: 0, xpForNext: 100 },
        xpTotal: 0,
        streak: { current: 0, best: 0 },
        puzzles: { rating: 1000, solved: 0 },
        games: { played: 0, wins: 0, draws: 0, losses: 0 },
        week: [],
        achievements: [],
        themes: [],
        cards: { due: 0, total: 0 },
      }),
    'POST /auth/logout': async (request) => {
      logoutBody = await request.json();
      return empty(204);
    },
  });
  renderApp();

  // Signing out is on the profile, the path has only the chapters
  fireEvent.press(await screen.findByRole('tab', { name: 'Профиль' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Выйти' }));
  expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeOnTheScreen();
  await waitFor(() => expect(logoutBody).toEqual({ refreshToken: 'refresh-1' }));
  expect(await Keychain.getGenericPassword()).toBe(false);
});

test('sends a reset link from the recovery screen', async () => {
  let body: unknown;
  mockApi({
    ...ANONYMOUS,
    'POST /auth/password/forgot': async (request) => {
      body = await request.json();
      return empty(204);
    },
  });
  await openSignIn();
  fireEvent.press(await screen.findByRole('link', { name: 'Забыли пароль?' }));

  fireEvent.changeText(await screen.findByLabelText('Email'), 'dima@mail.ru');
  fireEvent.press(screen.getByRole('button', { name: 'Отправить ссылку' }));

  expect(await screen.findByText('Письмо отправлено')).toBeOnTheScreen();
  expect(
    screen.getByText('Проверь почту dima@mail.ru и перейди по ссылке из письма.'),
  ).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Отправить ещё раз через 0:45' })).toBeOnTheScreen();
  expect(body).toEqual({ email: 'dima@mail.ru' });

  fireEvent.press(screen.getByRole('button', { name: 'Вернуться ко входу' }));
  expect(await screen.findByRole('tab', { name: 'Вход', selected: true })).toBeOnTheScreen();
});

test('explains a missing @ on the recovery screen', async () => {
  mockApi(ANONYMOUS);
  await openSignIn();
  fireEvent.press(await screen.findByRole('link', { name: 'Забыли пароль?' }));
  fireEvent.changeText(await screen.findByLabelText('Email'), 'dima.mail.ru');
  fireEvent.press(screen.getByRole('button', { name: 'Отправить ссылку' }));
  expect(await screen.findByText('Кажется, в адресе не хватает «@».')).toBeOnTheScreen();
});
