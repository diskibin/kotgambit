import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

type UrlHandler = (event: { url: string }) => void;

const PROFILE = {
  displayName: 'Дмитрий',
  memberSince: '2026-09-02',
  level: { level: 4, xpInLevel: 240, xpForNext: 400 },
  xpTotal: 1240,
  streak: { current: 3, best: 9 },
  puzzles: { rating: 1040, solved: 58 },
  games: { played: 12, wins: 7, draws: 1, losses: 4 },
  week: [{ day: '2026-10-03', done: true, today: true }],
  month: [{ day: '2026-10-03', done: true, today: true }],
  ratingHistory: [],
  achievements: [{ key: 'first-lesson', current: 1, target: 1, unlocked: true }],
  themes: [],
  cards: { due: 0, total: 0 },
  wardrobe: { selected: 'none', items: [{ key: 'none', unlocked: true }] },
};

let emit: UrlHandler;
let tied: string[];

const accounts = (providers: string[]) => ({
  ...SIGNED_IN,
  ...HOME,
  'GET /profile': () => json(PROFILE),
  'GET /auth/oauth/providers': () => json({ providers }),
  'GET /auth/identities': () =>
    json({
      identities: tied.map((provider) => ({ provider, email: null })),
      hasPassword: true,
    }),
});

beforeEach(async () => {
  tied = [];
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
  jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
  jest.spyOn(Linking, 'addEventListener').mockImplementation((_type, handler) => {
    emit = handler as UrlHandler;
    return { remove: jest.fn() };
  });
});

afterEach(() => jest.restoreAllMocks());

async function openProfile(providers = ['yandex', 'vk', 'google']) {
  mockApi(accounts(providers));
  render(<App store={makeStore()} />);
  fireEvent.press(await screen.findByRole('tab', { name: 'Профиль' }));
  await screen.findByRole('header', { name: 'Профиль' });
}

describe('the accounts for sign-in', () => {
  it('shows which services are tied, as the design draws them', async () => {
    tied = ['yandex'];
    await openProfile();
    expect(await screen.findByText('Аккаунты для входа')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Яндекс, привязан' })).toBeEnabled();
    expect(screen.getByText('Яндекс ✓')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Привязать VK' })).toBeEnabled();
    expect(screen.getByText('VK · привязать')).toBeOnTheScreen();
    expect(screen.getByText('Google · привязать')).toBeOnTheScreen();
  });

  it('is not shown when no service is on and none is tied', async () => {
    await openProfile([]);
    await screen.findByText('Дмитрий');
    expect(screen.queryByText('Аккаунты для входа')).not.toBeOnTheScreen();
  });

  it('opens the system browser on the page the server gave', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let sent: unknown;
    mockApi({
      ...accounts(['vk']),
      'POST /auth/oauth/vk/link-start': async (request) => {
        sent = await request.json();
        return json({ url: 'http://10.0.2.2:3000/auth/oauth/vk/start?client=mobile&intent=x' });
      },
    });
    render(<App store={makeStore()} />);
    fireEvent.press(await screen.findByRole('tab', { name: 'Профиль' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Привязать VK' }));

    await waitFor(() =>
      expect(open).toHaveBeenCalledWith(
        'http://10.0.2.2:3000/auth/oauth/vk/start?client=mobile&intent=x',
      ),
    );
    expect(sent).toEqual({ client: 'mobile' });
  });

  it('says it is tied when the browser brings the app back, and shows the new state', async () => {
    await openProfile(['yandex']);
    expect(await screen.findByText('Яндекс · привязать')).toBeOnTheScreen();

    tied = ['yandex'];
    act(() => emit({ url: 'kotgambit://auth/callback?linked=yandex' }));

    expect(
      await screen.findByText('Яндекс привязан. Теперь можно входить и так.'),
    ).toBeOnTheScreen();
    expect(await screen.findByText('Яндекс ✓')).toBeOnTheScreen();
  });

  it('says calmly why the account was not tied', async () => {
    await openProfile(['yandex']);
    await screen.findByText('Яндекс · привязать');
    act(() => emit({ url: 'kotgambit://auth/callback?error=taken' }));
    expect(
      await screen.findByText('Этот аккаунт уже привязан к другому профилю.'),
    ).toBeOnTheScreen();
  });
  describe('unlinking', () => {
    const tiedYandex = async (
      over: Record<string, (request: Request) => Response | Promise<Response>> = {},
    ) => {
      tied = ['yandex', 'google'];
      mockApi({ ...accounts(['yandex', 'vk', 'google']), ...over });
      render(<App store={makeStore()} />);
      fireEvent.press(await screen.findByRole('tab', { name: 'Профиль' }));
      fireEvent.press(await screen.findByRole('button', { name: 'Яндекс, привязан' }));
    };

    it('asks first, in a sheet, and says what stays', async () => {
      await tiedYandex();
      expect(await screen.findByText('Отвязать Яндекс?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          'Входить через Яндекс больше не получится. Аккаунт и прогресс останутся с тобой.',
        ),
      ).toBeOnTheScreen();
    });

    it('unlinks the service and shows it free again', async () => {
      let removed = false;
      await tiedYandex({
        'DELETE /auth/identities/yandex': () => {
          removed = true;
          tied = ['google'];
          return empty(204);
        },
      });
      fireEvent.press(await screen.findByRole('button', { name: 'Отвязать' }));

      expect(await screen.findByText('Яндекс отвязан.')).toBeOnTheScreen();
      expect(await screen.findByText('Яндекс · привязать')).toBeOnTheScreen();
      expect(removed).toBe(true);
      expect(screen.queryByText('Отвязать Яндекс?')).not.toBeOnTheScreen();
    });

    it('keeps the service when the learner changes their mind', async () => {
      const del = jest.fn(() => empty(204));
      await tiedYandex({ 'DELETE /auth/identities/yandex': del });
      fireEvent.press(await screen.findByRole('button', { name: 'Оставить' }));
      await waitFor(() => expect(screen.queryByText('Отвязать Яндекс?')).not.toBeOnTheScreen());
      expect(screen.getByText('Яндекс ✓')).toBeOnTheScreen();
      expect(del).not.toHaveBeenCalled();
    });

    it('says why the last way in cannot be removed', async () => {
      await tiedYandex({
        'DELETE /auth/identities/yandex': () =>
          json({ code: 'oauth.last_method', message: 'Это твой единственный способ входа.' }, 409),
      });
      fireEvent.press(await screen.findByRole('button', { name: 'Отвязать' }));
      expect(await screen.findByText('Это твой единственный способ входа.')).toBeOnTheScreen();
      expect(screen.getByText('Яндекс ✓')).toBeOnTheScreen();
    });
  });
});
