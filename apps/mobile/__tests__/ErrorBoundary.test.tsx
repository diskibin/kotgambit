import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../src/features/system/ErrorBoundary';

let broken = true;

function Screen() {
  if (broken) throw new Error('broken screen');
  return <Text>fine</Text>;
}

describe('the error boundary', () => {
  beforeEach(() => {
    broken = true;
    // React logs a caught render error on purpose: it is the thing under test
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('says it in the voice of the cat and tries again on request', () => {
    render(
      <ErrorBoundary>
        <Screen />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('header', { name: 'Что-то пошло не так' })).toBeOnTheScreen();
    broken = false;
    fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
    expect(screen.getByText('fine')).toBeOnTheScreen();
  });
});
