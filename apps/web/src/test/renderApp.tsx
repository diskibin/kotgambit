import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { App } from '../App';
import { makeStore } from '../app/store';

export const API_URL = 'http://localhost:3000';

export const USER = {
  id: '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11',
  email: 'cat@example.com',
  displayName: null,
  emailVerified: false,
  accessory: 'none',
};

export function renderApp(route = '/') {
  const store = makeStore();
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );
  return { store, ...view };
}
