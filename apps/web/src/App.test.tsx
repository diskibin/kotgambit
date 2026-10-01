import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the product title from localization', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Кот Гамбит' })).toBeInTheDocument();
  });
});
