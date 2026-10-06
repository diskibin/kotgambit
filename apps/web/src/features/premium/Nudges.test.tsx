import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeStore } from '../../app/store';
import { API_URL } from '../../test/renderApp';
import { PremiumHint } from './PremiumHint';
import { PremiumNudge } from './PremiumNudge';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let events: { visitorId: string; name: string; detail?: string }[];

beforeEach(() => {
  events = [];
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.stubEnv('VITE_ANALYTICS', 'on');
  server.use(
    http.post(`${API_URL}/analytics/events`, async ({ request }) => {
      events.push((await request.json()) as (typeof events)[number]);
      return new HttpResponse(null, { status: 204 });
    }),
  );
});
afterEach(async () => {
  // A report that is still on its way must land before the next test starts counting
  await new Promise((resolve) => setTimeout(resolve, 50));
  vi.unstubAllEnvs();
  server.resetHandlers();
});

function mount(node: React.ReactNode) {
  return render(
    <Provider store={makeStore()}>
      <MemoryRouter initialEntries={['/here']}>
        <Routes>
          <Route path="/here" element={node} />
          <Route path="/premium" element={<p>Страница Премиума</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('the hint when a limit is reached', () => {
  it('says what Premium would change right here, the closest benefit first', () => {
    mount(<PremiumNudge kind="analysis" />);
    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toContain('Анализ позиций без ограничений');
    expect(items).toHaveLength(3);
  });

  it('has other benefits for puzzles and for the cards of mistakes', () => {
    const view = mount(<PremiumNudge kind="puzzles" />);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Задачи без дневного лимита');
    view.unmount();
    mount(<PremiumNudge kind="cards" />);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Карточки: ошибки возвращаются');
  });

  it('reports that it was seen, once, and that its button was pressed', async () => {
    const user = userEvent.setup();
    const view = mount(<PremiumNudge kind="puzzles" />);
    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ name: 'nudge_view', detail: 'puzzles-limit' });
    view.unmount();
    // Shown again in the same session: not counted again
    mount(<PremiumNudge kind="puzzles" />);

    await user.click(screen.getByRole('button', { name: 'Что даёт Премиум' }));
    expect(await screen.findByText('Страница Премиума')).toBeInTheDocument();
    await waitFor(() => expect(events).toHaveLength(2));
    expect(events.map((event) => [event.name, event.detail])).toEqual([
      ['nudge_view', 'puzzles-limit'],
      ['nudge_click', 'puzzles-limit'],
    ]);
  });
});

describe('the hint before the limit', () => {
  it('shows how many are left when one or two are, and opens Premium from its button', async () => {
    const user = userEvent.setup();
    mount(<PremiumHint kind="puzzles" left={2} />);
    expect(
      screen.getByText('Задач на сегодня осталось: 2. С Премиумом без дневного лимита.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ name: 'nudge_view', detail: 'puzzles-soft' });

    await user.click(screen.getByRole('button', { name: 'Что даёт Премиум' }));
    expect(await screen.findByText('Страница Премиума')).toBeInTheDocument();
    await waitFor(() => expect(events.at(-1)).toMatchObject({ name: 'nudge_click' }));
    expect(events.at(-1)?.detail).toBe('puzzles-soft');
  });

  it('says it about the analyses too', () => {
    mount(<PremiumHint kind="analysis" left={1} />);
    expect(screen.getByText(/Анализов на сегодня осталось: 1/)).toBeInTheDocument();
  });

  it('says nothing while there is plenty, when the limit is reached already, or without a limit', async () => {
    for (const left of [3, 10, 0, null]) {
      const view = mount(<PremiumHint kind="puzzles" left={left} />);
      expect(screen.queryByRole('complementary'), String(left)).not.toBeInTheDocument();
      view.unmount();
    }
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(events).toEqual([]);
  });
});
