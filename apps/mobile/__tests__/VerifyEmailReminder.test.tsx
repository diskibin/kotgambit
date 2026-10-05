import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { AUTH, HOME, USER } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

let verified: boolean;
let meCalls: number;

const routes = () => ({
  'GET /users/me': (request: Request) => {
    if (request.headers.get('Authorization') !== 'Bearer token-1') return empty(401);
    meCalls += 1;
    return json({ ...USER, emailVerified: verified });
  },
  'POST /auth/refresh': () => json(AUTH),
  ...HOME,
});

beforeEach(async () => {
  verified = false;
  meCalls = 0;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

afterEach(() => jest.restoreAllMocks());

describe('the reminder to confirm the email', () => {
  it('asks to open the link from the email, naming the address, and waits before a second email', async () => {
    mockApi(routes());
    render(<App store={makeStore()} />);

    expect(await screen.findByText('Подтверди почту')).toBeOnTheScreen();
    expect(
      screen.getByText(
        `Мы отправили письмо на ${USER.email}. Открой ссылку из него, и прогресс не потеряется, даже если сменишь устройство.`,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Отправить ещё раз через 0:45' })).toBeDisabled();
  });

  it('is not shown when the address is confirmed', async () => {
    verified = true;
    mockApi(routes());
    render(<App store={makeStore()} />);
    await screen.findByText('Доска и фигуры');
    expect(screen.queryByText('Подтверди почту')).not.toBeOnTheScreen();
  });

  it('looks again when the app comes back, and goes away once the address is confirmed', async () => {
    let change: (state: string) => void = () => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      change = handler as (state: string) => void;
      return { remove: jest.fn() };
    });
    mockApi(routes());
    render(<App store={makeStore()} />);
    await screen.findByText('Подтверди почту');
    const before = meCalls;

    // The learner opened the link in the mail app and came back
    verified = true;
    act(() => change('active'));

    await waitFor(() => expect(screen.queryByText('Подтверди почту')).not.toBeOnTheScreen());
    expect(meCalls).toBeGreaterThan(before);
  });
});
