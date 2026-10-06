import { tokenReceived } from '@kotgambit/api-client';
import { act, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { API_URL } from '../../test/renderApp';
import { Analytics } from './Analytics';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let events: { visitorId: string; name: string }[];

beforeEach(() => {
  events = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubEnv('VITE_ANALYTICS', 'on');
  server.use(
    http.post(`${API_URL}/analytics/events`, async ({ request }) => {
      events.push((await request.json()) as { visitorId: string; name: string });
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'doNotTrack');
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  server.resetHandlers();
});

function mount(route: string) {
  const store = makeStore();
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Analytics />
      </MemoryRouter>
    </Provider>,
  );
  return { store, ...view };
}

const names = () => events.map((event) => event.name);

describe('counting the visitors', () => {
  it('reports a visit with a random id that the browser keeps', async () => {
    mount('/');
    await waitFor(() => expect(names()).toEqual(['visit']));
    const id = events[0]?.visitorId;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(window.localStorage.getItem('kg.visitor')).toBe(id);
  });

  it('counts a visit once per session, however many pages are opened', async () => {
    const first = mount('/');
    await waitFor(() => expect(names()).toEqual(['visit']));
    first.unmount();
    mount('/learn');
    // Give a second report the time to go out, it must not
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names()).toEqual(['visit']);
  });

  it('reports the sign-in and the look at the premium page', async () => {
    const { store } = mount('/premium');
    await waitFor(() => expect(names()).toContain('premium_view'));
    act(() => {
      store.dispatch(tokenReceived('token-1'));
    });
    await waitFor(() => expect(names()).toContain('signed_in'));
    expect(new Set(events.map((event) => event.visitorId)).size).toBe(1);
  });

  it('does not count the owner on the admin page', async () => {
    mount('/admin');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names()).toEqual([]);
  });

  it('counts nobody who asked not to be tracked', async () => {
    // jsdom has no such property, a browser that has it answers '1' to a visitor who asked
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    mount('/');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(names()).toEqual([]);
    expect(window.localStorage.getItem('kg.visitor')).toBeNull();
  });
});
