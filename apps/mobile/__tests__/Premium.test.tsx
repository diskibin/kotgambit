import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

const PAYMENT_ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';
const RETURN_URL = `https://kotgambit.example/billing/return?paymentId=${PAYMENT_ID}&client=mobile`;

const PLANS = {
  available: true,
  plans: [
    { key: 'year', priceRub: 1990 },
    { key: 'month', priceRub: 299 },
  ],
};
const NONE = {
  premium: false,
  status: 'none',
  plan: null,
  currentPeriodEnd: null,
  autoRenew: false,
  cardLast4: null,
};
const ACTIVE = {
  premium: true,
  status: 'active',
  plan: 'year',
  currentPeriodEnd: '2027-10-03T12:00:00.000Z',
  autoRenew: true,
  cardLast4: '4477',
};

let subscription: Record<string, unknown>;
let checkoutBodies: unknown[];
let confirmationUrl: string;
let paymentStatus: string;

type Routes = Parameters<typeof mockApi>[0];

function routes(over: Routes = {}): Routes {
  return {
    ...SIGNED_IN,
    ...HOME,
    // The way to Premium is on the profile
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
        wardrobe: { selected: 'none', items: [{ key: 'none', unlocked: true }] },
      }),
    'GET /billing/plans': () => json(PLANS),
    'GET /billing/subscription': () => json(subscription),
    'POST /billing/checkout': async (request) => {
      checkoutBodies.push(await request.json());
      return json({ paymentId: PAYMENT_ID, confirmationUrl, returnUrl: RETURN_URL });
    },
    [`GET /billing/payments/${PAYMENT_ID}`]: () =>
      json({
        paymentId: PAYMENT_ID,
        status: paymentStatus,
        subscription: paymentStatus === 'succeeded' ? ACTIVE : NONE,
      }),
    ...over,
  };
}

beforeEach(async () => {
  subscription = NONE;
  checkoutBodies = [];
  confirmationUrl = 'https://yoomoney.ru/api-pages/v2/payment-confirm/epl?orderId=1';
  paymentStatus = 'pending';
  (globalThis as { __webview?: unknown }).__webview = undefined;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

afterEach(() => jest.restoreAllMocks());

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));
const tab = async (name: string) => fireEvent.press(await screen.findByRole('tab', { name }));

/** The props the last WebView was given, which is how a test plays the part of the page. */
const webview = () =>
  (globalThis as { __webview?: Record<string, (...args: unknown[]) => unknown> })
    .__webview as Record<string, (...args: unknown[]) => unknown> & {
    source: { uri: string };
    originWhitelist: string[];
  };

async function openPremium(over: Routes = {}) {
  mockApi(routes(over));
  render(<App store={makeStore()} />);
  await tab('Профиль');
  await press('Премиум');
  await screen.findByRole('header', { name: 'Премиум' });
}

async function openCheckout(over: Routes = {}) {
  await openPremium(over);
  await screen.findByRole('radio', { name: /Год/ });
  await press('Оформить Премиум');
  await screen.findByTestId('webview');
}

describe('the offer', () => {
  it('shows the plans with the year first, the terms and what Premium opens', async () => {
    await openPremium();
    expect(await screen.findByRole('header', { name: 'Учись без ограничений' })).toBeOnTheScreen();
    expect(await screen.findByRole('radio', { name: /Год\. 1990 ₽ в год/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Месяц\. 299 ₽ в месяц/ })).toBeOnTheScreen();
    expect(screen.getByText('166 ₽ в месяц')).toBeOnTheScreen();
    expect(screen.getByText(/раз в год/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/Повтор ошибок: Бесплатно —, Премиум ✓/)).toBeOnTheScreen();
  });

  it('starts a payment for the plan and the consent the learner chose', async () => {
    await openPremium();
    fireEvent.press(await screen.findByRole('radio', { name: /Месяц/ }));
    expect(screen.getByRole('checkbox', { name: 'Продлевать автоматически' })).not.toBeChecked();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Продлевать автоматически' }));
    await press('Оформить Премиум');
    await screen.findByTestId('webview');
    expect(checkoutBodies).toEqual([{ plan: 'month', client: 'mobile', autoRenew: true }]);
  });

  it('says so when the shop is not set up', async () => {
    await openPremium({ 'GET /billing/plans': () => json({ available: false, plans: [] }) });
    expect(
      await screen.findByText('Оплата пока недоступна. Загляни чуть позже.'),
    ).toBeOnTheScreen();
  });
});

describe('the payment page', () => {
  it('opens the page of the provider over https only, with nothing from the disk and no injected scripts', async () => {
    await openCheckout();
    const props = webview();
    expect(props.source.uri).toBe(confirmationUrl);
    expect(props.originWhitelist).toEqual(['https://*']);
    expect(props).toMatchObject({
      allowFileAccess: false,
      allowUniversalAccessFromFileURLs: false,
      allowFileAccessFromFileURLs: false,
      mixedContentMode: 'never',
      setSupportMultipleWindows: false,
    });
    expect(props.injectedJavaScript).toBeUndefined();
    expect(screen.getByText('🔒 yoomoney.ru')).toBeOnTheScreen();
  });

  it('never loads a page that is not the provider’s, whatever the server said', async () => {
    confirmationUrl = 'https://evil.example/pay';
    await openPremium();
    await screen.findByRole('radio', { name: /Год/ });
    await press('Оформить Премиум');
    expect(await screen.findByText('Страница не загрузилась')).toBeOnTheScreen();
    expect(screen.queryByTestId('webview')).not.toBeOnTheScreen();
  });

  it('keeps pages of banks in the page and refuses what is not https', async () => {
    await openCheckout();
    expect(webview().onShouldStartLoadWithRequest({ url: 'https://acs.bank.example/3ds' })).toBe(
      true,
    );
    expect(webview().onShouldStartLoadWithRequest({ url: 'http://acs.bank.example/3ds' })).toBe(
      false,
    );
    expect(webview().onShouldStartLoadWithRequest({ url: 'file:///etc/passwd' })).toBe(false);
  });

  it('hands the app of a bank to the system and asks the learner to come back', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openCheckout();
    act(() => {
      expect(webview().onShouldStartLoadWithRequest({ url: 'sberpay://pay?id=1' })).toBe(false);
    });
    expect(open).toHaveBeenCalledWith('sberpay://pay?id=1');
    expect(await screen.findByText('Подтверди оплату в приложении банка')).toBeOnTheScreen();

    await press('Я оплатил — проверить');
    expect(await screen.findByText('Платёж обрабатывается')).toBeOnTheScreen();
  });

  it('opens an intent of Android as the address of the app', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openCheckout();
    act(() => {
      webview().onShouldStartLoadWithRequest({ url: 'intent://pay/now#Intent;scheme=sberpay;end' });
    });
    expect(open).toHaveBeenCalledWith('sberpay://pay/now');
  });

  it('opens the page in the browser from the menu', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await openCheckout();
    await press('Меню оплаты');
    await press('Открыть в браузере');
    expect(open).toHaveBeenCalledWith(confirmationUrl);
  });

  it('asks before leaving, and the safe answer is the main one', async () => {
    await openCheckout();
    await press('Закрыть');
    expect(await screen.findByText('Выйти из оплаты?')).toBeOnTheScreen();
    await press('Остаться');
    expect(screen.queryByText('Выйти из оплаты?')).not.toBeOnTheScreen();
    expect(screen.getByTestId('webview')).toBeOnTheScreen();
  });

  it('shows the status when the learner is sent back to our page, and does not take it for a payment', async () => {
    await openCheckout();
    act(() => {
      expect(webview().onShouldStartLoadWithRequest({ url: RETURN_URL })).toBe(false);
    });
    expect(await screen.findByText('Платёж обрабатывается')).toBeOnTheScreen();
    expect(screen.queryByText('Готово, у тебя Премиум!')).not.toBeOnTheScreen();
  });
});

describe('what became of the payment', () => {
  async function comeBack() {
    await openCheckout();
    act(() => {
      webview().onShouldStartLoadWithRequest({ url: RETURN_URL });
    });
    await screen.findByText('Платёж обрабатывается');
  }

  it('shows Premium once the server says the payment went through', async () => {
    await comeBack();
    paymentStatus = 'succeeded';
    await press('Обновить статус');
    expect(await screen.findByText('Готово, у тебя Премиум!')).toBeOnTheScreen();
    expect(screen.getByText('Премиум активен')).toBeOnTheScreen();
    await press('Отлично!');
    expect(await screen.findByRole('tab', { name: 'Путь', selected: true })).toBeOnTheScreen();
  });

  it('says it kindly when the payment did not go through, and offers another try', async () => {
    paymentStatus = 'canceled';
    await comeBack().catch(() => undefined);
    expect(await screen.findByText('Не получилось оплатить')).toBeOnTheScreen();
    expect(
      screen.getByText('Деньги не списались. Попробуй ещё раз или выбери другой способ.'),
    ).toBeOnTheScreen();
    await press('Попробовать ещё');
    expect(await screen.findByRole('header', { name: 'Учись без ограничений' })).toBeOnTheScreen();
  });
});

describe('what the learner has', () => {
  it('shows the plan, the next charge and the card', async () => {
    subscription = ACTIVE;
    await openPremium();
    expect(await screen.findByRole('header', { name: 'У тебя Премиум' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Тариф: Год')).toBeOnTheScreen();
    expect(screen.getByLabelText('Следующее списание: 3 октября 2027')).toBeOnTheScreen();
    expect(screen.getByLabelText('Способ оплаты: Карта •• 4477')).toBeOnTheScreen();
  });

  it('cancels, then shows how long the access lasts, with a way back', async () => {
    subscription = ACTIVE;
    await openPremium({
      'POST /billing/cancel': () => {
        subscription = { ...ACTIVE, status: 'canceled', autoRenew: false };
        return json(subscription);
      },
      'POST /billing/resume': () => {
        subscription = ACTIVE;
        return json(ACTIVE);
      },
    });
    await press('Отменить подписку');
    expect(await screen.findByRole('header', { name: 'Подписка отменена' })).toBeOnTheScreen();
    expect(screen.getByText(/Премиум работает до 3 октября 2027/)).toBeOnTheScreen();
    await press('Возобновить подписку');
    expect(await screen.findByRole('header', { name: 'У тебя Премиум' })).toBeOnTheScreen();
  });
});

describe('the limits', () => {
  const limit = (code: string, message: string) => json({ code, message }, 403);

  it('turns a free learner away from a puzzle when the day is used up', async () => {
    mockApi(
      routes({
        'GET /puzzles/daily': () =>
          json({
            puzzleId: 'p',
            fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
            lastMove: 'e1e2',
            solver: 'w',
            title: 'Мат в 1 ход',
            solved: false,
          }),
        'GET /puzzles/stats': () =>
          json({ rating: 1000, solved: 0, failed: 0, streak: 0, bestStreak: 0 }),
        'GET /puzzles/themes': () => json({ themes: [] }),
        'POST /puzzles/next': () => limit('puzzle.limit', 'На сегодня задачи закончились.'),
      }),
    );
    render(<App store={makeStore()} />);
    await tab('Задачи');
    await press('Решить');
    expect(
      await screen.findByRole('header', { name: 'На сегодня задачи закончились' }),
    ).toBeOnTheScreen();
    await press('Что даёт Премиум');
    expect(await screen.findByRole('header', { name: 'Премиум' })).toBeOnTheScreen();
  });

  it('closes the analysis when the limit is reached', async () => {
    mockApi(
      routes({
        'POST /analysis/position': () => limit('analysis.limit', 'Анализы на сегодня закончились.'),
      }),
    );
    render(<App store={makeStore()} />);
    await tab('Анализ');
    await press('Анализировать');
    expect(
      await screen.findByRole('header', { name: 'Анализы на сегодня закончились' }),
    ).toBeOnTheScreen();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Анализировать' })).toBeDisabled(),
    );
  });

  it('says the repetition of mistakes is Premium’s', async () => {
    mockApi(
      routes({
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
            cards: { due: 2, total: 2 },
            wardrobe: { selected: 'none', items: [{ key: 'none', unlocked: true }] },
          }),
        'POST /cards/next': () => limit('premium.required', 'Это есть в Премиуме.'),
      }),
    );
    render(<App store={makeStore()} />);
    await tab('Профиль');
    await press('Повторять');
    expect(
      await screen.findByRole('header', { name: 'Повтор ошибок — в Премиуме' }),
    ).toBeOnTheScreen();
  });
});
