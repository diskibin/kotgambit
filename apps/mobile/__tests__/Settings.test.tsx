import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

const PROFILE = {
  displayName: null,
  memberSince: '2026-09-02',
  level: { level: 1, xpInLevel: 0, xpForNext: 100 },
  xpTotal: 0,
  streak: { current: 0, best: 0 },
  puzzles: { rating: 1000, solved: 0 },
  games: { played: 0, wins: 0, draws: 0, losses: 0 },
  week: [],
  month: [],
  ratingHistory: [],
  achievements: [],
  themes: [],
  cards: { due: 0, total: 0 },
  wardrobe: {
    selected: 'none',
    items: [
      { key: 'none', unlocked: true },
      { key: 'scarf', unlocked: true },
      { key: 'glasses', unlocked: false },
      { key: 'crown', unlocked: false },
      { key: 'hat', unlocked: false },
      { key: 'medal', unlocked: false },
    ],
  },
};

let patches: unknown[];
let deleted: number;

beforeEach(async () => {
  patches = [];
  deleted = 0;
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
  mockApi({
    ...SIGNED_IN,
    ...HOME,
    'GET /profile': () => json(PROFILE),
    'GET /users/me/settings': () =>
      json({ dailyGoalMinutes: 10, displayName: null, reminders: false }),
    'PATCH /users/me/settings': async (request) => {
      const body = (await request.json()) as { dailyGoalMinutes: number };
      patches.push(body);
      return json({ dailyGoalMinutes: body.dailyGoalMinutes, displayName: null, reminders: false });
    },
    'GET /billing/subscription': () =>
      json({
        premium: false,
        status: 'none',
        plan: null,
        currentPeriodEnd: null,
        autoRenew: false,
        cardLast4: null,
      }),
    'DELETE /users/me': () => {
      deleted += 1;
      return empty(204);
    },
    'POST /auth/logout': () => empty(204),
  });
});

const tab = async (name: string) => fireEvent.press(await screen.findByRole('tab', { name }));
const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

async function openSettings() {
  render(<App store={makeStore()} />);
  await tab('Профиль');
  await press('Настройки профиля');
  await screen.findByRole('header', { name: 'Настройки' });
}

describe('the settings', () => {
  it('opens from the profile and goes back to it', async () => {
    await openSettings();
    await press('Назад');
    expect(await screen.findByRole('header', { name: 'Профиль' })).toBeOnTheScreen();
  });

  it('shows the account of the learner', async () => {
    await openSettings();
    expect(await screen.findByText('cat@example.com')).toBeOnTheScreen();
    expect(await screen.findByText('Бесплатный план')).toBeOnTheScreen();
  });

  it('chooses the theme and the board', async () => {
    await openSettings();
    fireEvent.press(await screen.findByRole('tab', { name: 'Тёмная' }));
    expect(screen.getByRole('tab', { name: 'Тёмная' })).toBeSelected();
    fireEvent.press(screen.getByRole('radio', { name: 'Дерево' }));
    expect(screen.getByRole('radio', { name: 'Дерево' })).toBeSelected();
  });

  it('offers four sets of pieces and chooses one, the board stays as it was', async () => {
    await openSettings();
    const group = await screen.findByLabelText('Набор фигур');
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.props.accessibilityLabel),
    ).toEqual(['Гамбит', 'Классика', 'Тёплые', 'Линии']);

    fireEvent.press(screen.getByRole('radio', { name: 'Дерево' }));
    fireEvent.press(within(group).getByRole('radio', { name: 'Тёплые' }));

    expect(within(group).getByRole('radio', { name: 'Тёплые' })).toBeSelected();
    expect(within(group).getByRole('radio', { name: 'Гамбит' })).not.toBeSelected();
    expect(screen.getByRole('radio', { name: 'Дерево' })).toBeSelected();
  });

  it('switches the vibration and the coordinates', async () => {
    await openSettings();
    const vibration = await screen.findByRole('switch', { name: 'Вибрация' });
    expect(vibration).toBeChecked();
    fireEvent(vibration, 'valueChange', false);
    expect(screen.getByRole('switch', { name: 'Вибрация' })).not.toBeChecked();
  });

  it('sends the goal of the day to the server', async () => {
    await openSettings();
    fireEvent.press(await screen.findByRole('tab', { name: '15 мин.' }));
    await waitFor(() => expect(patches).toEqual([{ dailyGoalMinutes: 15 }]));
  });

  it('deletes the account only after the learner types the word', async () => {
    await openSettings();
    await press('Удалить аккаунт');
    const confirm = await screen.findByRole('button', { name: 'Удалить навсегда' });
    expect(confirm).toBeDisabled();
    fireEvent.changeText(screen.getByLabelText('Напиши «УДАЛИТЬ», чтобы подтвердить'), 'УДАЛИТЬ');
    fireEvent.press(screen.getByRole('button', { name: 'Удалить навсегда' }));
    await waitFor(() => expect(deleted).toBe(1));
  });
});
