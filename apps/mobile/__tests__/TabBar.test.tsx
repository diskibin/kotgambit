import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Keychain from 'react-native-keychain';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from '../App';
import { makeStore } from '../src/app/store';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { TabBar } from '../src/shared/ui/TabBar';
import { HOME, SIGNED_IN } from '../src/test/fixtures';
import { json, mockApi } from '../src/test/mockApi';

const NAMES = ['Путь', 'Задачи', 'Играть', 'Анализ', 'Профиль'];

describe('TabBar', () => {
  const setup = (onSelect = jest.fn(), active: 'path' | 'play' = 'path') => {
    render(
      <SafeAreaProvider>
        <ThemeProvider preference="light">
          <TabBar active={active} onSelect={onSelect} />
        </ThemeProvider>
      </SafeAreaProvider>,
    );
    return onSelect;
  };

  it('has the five places in the order of the design', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(NAMES.length);
    for (const name of NAMES) expect(screen.getByRole('tab', { name })).toBeOnTheScreen();
    expect(screen.getByLabelText('Основная навигация')).toBeOnTheScreen();
  });

  it('marks the active place as selected and no other', () => {
    setup(jest.fn(), 'play');
    expect(screen.getByRole('tab', { name: 'Играть', selected: true })).toBeOnTheScreen();
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
  });

  it('tells which place was chosen', () => {
    const onSelect = setup();
    fireEvent.press(screen.getByRole('tab', { name: 'Анализ' }));
    expect(onSelect).toHaveBeenCalledWith('analysis');
    fireEvent.press(screen.getByRole('tab', { name: 'Задачи' }));
    expect(onSelect).toHaveBeenLastCalledWith('tasks');
  });
});

describe('the bar in the app', () => {
  beforeEach(async () => {
    await Keychain.setGenericPassword('refresh-token', 'stored-refresh', {
      service: 'kotgambit.refresh-token',
    });
  });

  it('is under the chapters, with the path lit, and takes the learner to another place', async () => {
    mockApi({
      ...SIGNED_IN,
      ...HOME,
      'GET /bots': () => json({ bots: [] }),
      'GET /games/active': () => json({ game: null }),
    });
    render(<App store={makeStore()} />);
    expect(await screen.findByRole('tab', { name: 'Путь', selected: true })).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('tab', { name: 'Играть' }));
    expect(await screen.findByRole('tab', { name: 'Играть', selected: true })).toBeOnTheScreen();
    expect(await screen.findByRole('header', { name: 'Играть' })).toBeOnTheScreen();
  });

  it('is not on the path any more as text links: the header has only the cat and the day', async () => {
    mockApi({ ...SIGNED_IN, ...HOME });
    render(<App store={makeStore()} />);
    await screen.findByRole('tab', { name: 'Путь' });
    for (const name of ['Задачи', 'Играть', 'Анализ позиции', 'Профиль', 'Премиум', 'Выйти']) {
      expect(screen.queryByRole('button', { name })).not.toBeOnTheScreen();
    }
  });
});
