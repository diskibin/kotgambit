import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PROFILE } from '../../test/profile';
import { API_URL, renderApp, USER } from '../../test/renderApp';
import { createShareImage } from '../share/createShareImage';
import { shareImage } from '../share/shareImage';

vi.mock('../share/createShareImage', () => ({
  createShareImage: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
vi.mock('../share/shareImage', () => ({ shareImage: vi.fn(async () => undefined) }));

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  vi.mocked(createShareImage).mockClear();
  vi.mocked(shareImage).mockClear();
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/profile`, () => HttpResponse.json(PROFILE)),
    http.get(`${API_URL}/auth/identities`, () =>
      HttpResponse.json({ identities: [], hasPassword: true }),
    ),
    http.get(`${API_URL}/auth/oauth/providers`, () => HttpResponse.json({ providers: [] })),
  );
});
afterEach(() => server.resetHandlers());

describe('sharing from the profile', () => {
  it('shares the streak as a card without the name of the learner', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Поделиться серией занятий' }));

    await waitFor(() => expect(createShareImage).toHaveBeenCalledTimes(1));
    const { spec, mood } = vi.mocked(createShareImage).mock.calls[0]?.[0] ?? {};
    expect(mood).toBe('proud');
    expect(spec).toMatchObject({
      kicker: 'Серия занятий',
      headline: '3 дня подряд',
      caption: 'Занимаюсь шахматами каждый день',
    });
    // Neither the name nor the email of the learner is on the card
    expect(JSON.stringify(spec)).not.toMatch(/Дмитрий|cat@example/);

    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(shareImage).mock.calls[0]?.[0]).toMatchObject({
      fileName: 'kot-gambit.png',
      text: 'Учусь шахматам с котом Гамбитом',
    });
  });

  it('shares the level when there is no streak', async () => {
    server.use(
      http.get(`${API_URL}/profile`, () =>
        HttpResponse.json({ ...PROFILE, streak: { current: 0, best: 9 } }),
      ),
    );
    const user = userEvent.setup();
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Поделиться уровнем' }));
    await waitFor(() => expect(createShareImage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createShareImage).mock.calls[0]?.[0].spec).toMatchObject({
      kicker: 'Мой уровень',
      headline: 'Уровень 4',
      caption: 'Заработано 1240 XP',
    });
  });

  it('offers to share an achievement that is open, and only those', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getAllByRole('button', { name: /^Поделиться достижением/ })).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: 'Поделиться достижением «Серия 7 дней»' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Поделиться достижением «Первый мат»' }));
    await waitFor(() => expect(createShareImage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createShareImage).mock.calls[0]?.[0]).toMatchObject({
      mood: 'happy',
      spec: { kicker: 'Новое достижение', headline: 'Первый мат' },
    });
  });

  it('says so when the card could not be made, and lets the learner try again', async () => {
    vi.mocked(createShareImage).mockRejectedValueOnce(new Error('no canvas'));
    const user = userEvent.setup();
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Поделиться серией занятий' }));
    expect(
      await screen.findByText('Не получилось собрать картинку. Попробуй ещё раз.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Поделиться серией занятий' }));
    await waitFor(() => expect(shareImage).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Не получилось собрать картинку/)).not.toBeInTheDocument();
  });
});
