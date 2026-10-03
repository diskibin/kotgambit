import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { makeStore } from '../src/app/store';
import { streakSeen } from '../src/features/path/streak.slice';
import { HOME, PROGRESS, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

beforeEach(async () => {
  await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
    service: 'kotgambit.refresh-token',
  });
});

describe('the home screen', () => {
  it('shows the puzzle of the day under the chapters', async () => {
    mockApi({ ...SIGNED_IN, ...HOME });
    render(<App store={makeStore()} />);
    expect(
      await screen.findByRole('button', { name: 'Задача дня. Мат в 1 ход' }),
    ).toBeOnTheScreen();
  });

  it('celebrates a streak that grew since the last look and lets it go with "Ок"', async () => {
    mockApi({
      ...SIGNED_IN,
      ...HOME,
      'GET /progress/summary': () => json({ ...PROGRESS, streakDays: 3 }),
    });
    const store = makeStore();
    store.dispatch(streakSeen(2));
    render(<App store={store} />);
    expect(await screen.findByText('Серия продлена! 3 дня')).toBeOnTheScreen();
    expect(screen.getByText('Цель дня выполнена')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Ок' }));
    expect(screen.queryByText('Серия продлена! 3 дня')).not.toBeOnTheScreen();
  });

  it('keeps quiet the first time the streak is seen', async () => {
    mockApi({
      ...SIGNED_IN,
      ...HOME,
      'GET /progress/summary': () => json({ ...PROGRESS, streakDays: 3 }),
    });
    render(<App store={makeStore()} />);
    await screen.findByText('Доска и фигуры');
    expect(screen.queryByText(/Серия продлена/)).not.toBeOnTheScreen();
  });
});
