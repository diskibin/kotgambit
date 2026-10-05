import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { AUTH, HOME } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

type UrlHandler = (event: { url: string }) => void;

let emit: UrlHandler;
let open: jest.SpyInstance;

/** Nobody is signed in until the API accepts the token of a session. */
const anonymous = (providers: string[]) => ({
  'GET /users/me': (request: Request) =>
    request.headers.get('Authorization') === 'Bearer token-1' ? json(AUTH.user) : empty(401),
  'POST /auth/refresh': () => empty(401),
  'GET /auth/oauth/providers': () => json({ providers }),
  ...HOME,
});

beforeEach(async () => {
  await Keychain.resetGenericPassword();
  open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, handler) => {
    emit = handler as UrlHandler;
    return { remove: jest.fn() };
  });
});

afterEach(() => jest.restoreAllMocks());

async function openSignIn() {
  render(<App store={makeStore()} />);
  fireEvent.press(await screen.findByRole('button', { name: 'У меня уже есть аккаунт' }));
  await screen.findByRole('tab', { name: 'Вход', selected: true });
}

describe('the buttons', () => {
  it('shows a button for every provider the server has keys for, in the order of the design', async () => {
    mockApi(anonymous(['yandex', 'vk', 'google']));
    await openSignIn();
    expect(await screen.findByRole('button', { name: 'Войти через Яндекс' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Войти через VK' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Войти через Google' })).toBeOnTheScreen();
    // The divider is only decoration, a screen reader skips it
    expect(screen.getByText('или', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('shows nothing when no provider is on', async () => {
    mockApi(anonymous([]));
    await openSignIn();
    expect(screen.queryByText('или', { includeHiddenElements: true })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Войти через/ })).not.toBeOnTheScreen();
  });

  it('opens the system browser on the page that starts the sign-in', async () => {
    mockApi(anonymous(['yandex']));
    await openSignIn();
    fireEvent.press(await screen.findByRole('button', { name: 'Войти через Яндекс' }));
    expect(open).toHaveBeenCalledWith('http://10.0.2.2:3000/auth/oauth/yandex/start?client=mobile');
  });
});

describe('the way back from the browser', () => {
  it('trades the one-time code for a session and opens the app', async () => {
    let sent: unknown;
    let finish: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (finish = resolve));
    mockApi({
      ...anonymous(['yandex']),
      'POST /auth/oauth/exchange': async (request) => {
        sent = await request.json();
        // Held, so that the screen of the return can be seen before the app opens
        await held;
        return json(AUTH);
      },
    });
    await openSignIn();
    fireEvent.press(await screen.findByRole('button', { name: 'Войти через Яндекс' }));

    act(() => emit({ url: 'kotgambit://auth/callback?code=code-1' }));

    expect(await screen.findByText('Возвращаемся в Кот Гамбит…')).toBeOnTheScreen();
    expect(
      screen.getByText('Вход через Яндекс подтверждён в браузере. Ещё секунда, и продолжим.'),
    ).toBeOnTheScreen();
    finish();
    expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
    expect(sent).toEqual({ code: 'code-1' });
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith('refresh-token', 'refresh-1', {
      service: 'kotgambit.refresh-token',
    });
  });

  it('opens the browser again from the return screen', async () => {
    mockApi({
      ...anonymous(['vk']),
      'POST /auth/oauth/exchange': () => new Promise<Response>(() => undefined),
    });
    await openSignIn();
    fireEvent.press(await screen.findByRole('button', { name: 'Войти через VK' }));
    act(() => emit({ url: 'kotgambit://auth/callback?code=code-2' }));
    await screen.findByText('Возвращаемся в Кот Гамбит…');

    open.mockClear();
    fireEvent.press(screen.getByRole('button', { name: 'Открыть браузер снова' }));
    expect(open).toHaveBeenCalledWith('http://10.0.2.2:3000/auth/oauth/vk/start?client=mobile');
  });

  it('says calmly that the code did not work and goes back to the sign-in', async () => {
    mockApi({
      ...anonymous(['yandex']),
      'POST /auth/oauth/exchange': () =>
        json({ code: 'oauth.code_invalid', message: 'Код входа устарел. Войди ещё раз.' }, 401),
    });
    await openSignIn();
    act(() => emit({ url: 'kotgambit://auth/callback?code=code-3' }));

    expect(
      await screen.findByText(
        'Не получилось войти через этот сервис. Попробуй ещё раз или войди по почте.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Вход', selected: true })).toBeOnTheScreen();
  });

  it('uses the same address only once', async () => {
    const exchange = jest.fn(() => json(AUTH));
    mockApi({ ...anonymous([]), 'POST /auth/oauth/exchange': exchange });
    await openSignIn();
    act(() => emit({ url: 'kotgambit://auth/callback?code=code-4' }));
    act(() => emit({ url: 'kotgambit://auth/callback?code=code-4' }));
    await screen.findByText('Доска и фигуры');
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('tells why the sign-in did not finish', async () => {
    mockApi(anonymous(['google']));
    await openSignIn();
    act(() => emit({ url: 'kotgambit://auth/callback?error=cancelled' }));
    expect(
      await screen.findByText('Вход отменён. Можно попробовать ещё раз или войти по почте.'),
    ).toBeOnTheScreen();
  });

  it('asks for the account of the learner when the email is taken, and links after the sign-in', async () => {
    let linked: unknown;
    mockApi({
      ...anonymous(['yandex']),
      'POST /auth/login': () => json(AUTH),
      'POST /auth/oauth/link': async (request) => {
        linked = await request.json();
        return empty(204);
      },
    });
    await openSignIn();
    act(() => emit({ url: 'kotgambit://auth/callback?link=ticket-1&provider=yandex' }));
    expect(
      await screen.findByText(
        'Эта почта уже есть в Коте Гамбите. Войди в свой аккаунт, и мы привяжем Яндекс.',
      ),
    ).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText('Email'), 'cat@example.com');
    fireEvent.changeText(screen.getByLabelText('Пароль'), 'gambit2026');
    fireEvent.press(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => expect(linked).toEqual({ ticket: 'ticket-1' }));
  });
});
