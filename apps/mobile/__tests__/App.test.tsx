import { render, screen } from '@testing-library/react-native';
import App from '../App';

test('renders the sandbox with the board and the cat', () => {
  render(<App />);
  expect(screen.getByText('Кот Гамбит')).toBeOnTheScreen();
  expect(screen.getByLabelText('Белый конь g1')).toBeOnTheScreen();
});
