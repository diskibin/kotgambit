import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { AUTH, HOME, USER } from '../src/test/fixtures';
import { empty, json, mockApi } from '../src/test/mockApi';

let patches: unknown[];
let signedUp = false;

beforeEach(async () => {
  patches = [];
  signedUp = false;
  await Keychain.resetGenericPassword();
  mockApi({
    ...HOME,
    'GET /users/me': (request) =>
      request.headers.get('Authorization') === 'Bearer token-1' ? json(USER) : empty(401),
    'POST /auth/refresh': () => empty(401),
    'POST /auth/register': () => {
      signedUp = true;
      return json(AUTH);
    },
    'PATCH /users/me/settings': async (request) => {
      const body = (await request.json()) as { dailyGoalMinutes: number };
      patches.push(body);
      return json({ dailyGoalMinutes: body.dailyGoalMinutes, displayName: null });
    },
    'GET /users/me/settings': () => json({ dailyGoalMinutes: 10, displayName: null }),
    'GET /lessons/basics-board': () => empty(404),
  });
});

const press = async (name: string | RegExp) =>
  fireEvent.press(await screen.findByRole('button', { name }));

describe('the first steps', () => {
  it('greets a visitor and shows the way to the sign-in', async () => {
    render(<App store={makeStore()} />);
    expect(await screen.findByText('Привет! Я Гамбит')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'У меня уже есть аккаунт' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeOnTheScreen();
  });

  it('goes through the four steps and hands the goal to the new account', async () => {
    render(<App store={makeStore()} />);
    await press('Дальше');

    expect(await screen.findByRole('radio', { name: /Знаю основы/ })).toBeSelected();
    fireEvent.press(screen.getByRole('radio', { name: /Я совсем новичок/ }));
    await press('Дальше');

    expect(await screen.findByRole('radio', { name: /Обычно · 10 минут/ })).toBeSelected();
    fireEvent.press(screen.getByRole('radio', { name: /Серьёзно · 15 минут/ }));
    await press('Дальше');

    expect(await screen.findByText('Доска и фигуры')).toBeOnTheScreen();
    expect(screen.getByText('5 шагов · около 5 минут')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar')).toHaveProp('accessibilityValue', {
      min: 1,
      max: 4,
      now: 4,
    });
    await press('Сначала создать аккаунт');

    expect(
      await screen.findByRole('tab', { name: 'Регистрация', selected: true }),
    ).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText('Email'), 'cat@example.com');
    fireEvent.changeText(screen.getByLabelText('Пароль'), 'gambit2026');
    fireEvent.changeText(screen.getByLabelText('Повтори пароль'), 'gambit2026');
    fireEvent.press(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => expect(signedUp).toBe(true));
    await waitFor(() => expect(patches).toEqual([{ dailyGoalMinutes: 15 }]));
  });

  it('goes back a step', async () => {
    render(<App store={makeStore()} />);
    await press('Дальше');
    await press('Назад');
    expect(await screen.findByText('Привет! Я Гамбит')).toBeOnTheScreen();
  });
});
