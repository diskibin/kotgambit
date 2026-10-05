import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL, renderApp, USER } from '../../test/renderApp';

const AUTH = { accessToken: 'token-1', expiresIn: 900, user: USER };
const CARD_ID = '3f8b9c1e-8a56-4b52-9d6a-0c1c6e1f7a11';
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const PROFILE = {
  displayName: 'Дмитрий',
  memberSince: '2026-09-02',
  level: { level: 4, xpInLevel: 240, xpForNext: 400 },
  xpTotal: 1240,
  streak: { current: 3, best: 9 },
  puzzles: { rating: 1040, solved: 58 },
  games: { played: 12, wins: 7, draws: 1, losses: 4 },
  week: [
    { day: '2026-09-27', done: false, today: false },
    { day: '2026-09-28', done: true, today: false },
    { day: '2026-09-29', done: true, today: false },
    { day: '2026-09-30', done: true, today: false },
    { day: '2026-10-01', done: false, today: false },
    { day: '2026-10-02', done: true, today: false },
    { day: '2026-10-03', done: true, today: true },
  ],
  month: [
    { day: '2026-10-01', done: true, today: false },
    { day: '2026-10-02', done: true, today: false },
    { day: '2026-10-03', done: false, today: true },
  ],
  ratingHistory: [
    { day: '2026-09-26', rating: 800 },
    { day: '2026-10-03', rating: 1040 },
  ],
  achievements: [
    { key: 'first-lesson', current: 1, target: 1, unlocked: true },
    { key: 'first-mate', current: 1, target: 1, unlocked: true },
    { key: 'streak-7', current: 4, target: 7, unlocked: false },
    { key: 'review-5', current: 3, target: 5, unlocked: false },
    { key: 'beat-bear', current: 0, target: 1, unlocked: false },
  ],
  themes: [
    { key: 'pin', title: 'Связка', accuracy: 31, attempts: 8 },
    { key: 'mateIn1', title: 'Мат в 1 ход', accuracy: 82, attempts: 12 },
  ],
  cards: { due: 2, total: 3 },
  wardrobe: {
    selected: 'none',
    items: [
      { key: 'none', unlocked: true },
      { key: 'scarf', unlocked: true },
      { key: 'glasses', unlocked: false },
      { key: 'crown', unlocked: false },
      { key: 'hat', unlocked: false },
      { key: 'medal', unlocked: false },
    ],
  },
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

let answers: string[];
let nextCalls: number;

beforeEach(() => {
  answers = [];
  nextCalls = 0;
  server.use(
    http.post(`${API_URL}/auth/refresh`, () => HttpResponse.json(AUTH)),
    http.get(`${API_URL}/users/me`, ({ request }) =>
      request.headers.get('Authorization') === 'Bearer token-1'
        ? HttpResponse.json(USER)
        : new HttpResponse(null, { status: 401 }),
    ),
    http.get(`${API_URL}/profile`, () => HttpResponse.json(PROFILE)),
    // Nothing is tied and no provider is on until a test says so
    http.get(`${API_URL}/auth/identities`, () =>
      HttpResponse.json({ identities: [], hasPassword: true }),
    ),
    http.get(`${API_URL}/auth/oauth/providers`, () => HttpResponse.json({ providers: [] })),
    http.post(`${API_URL}/cards/next`, () => {
      nextCalls += 1;
      return HttpResponse.json(
        nextCalls === 1
          ? {
              card: { id: CARD_ID, fen: START, solver: 'w', playedSan: 'f3', moveNumber: 1 },
              summary: { due: 1, total: 1 },
            }
          : { card: null, summary: { due: 0, total: 1 } },
      );
    }),
    http.post(`${API_URL}/cards/:id/answer`, async ({ request }) => {
      const { move } = (await request.json()) as { move: string };
      answers.push(move);
      return HttpResponse.json(
        move === 'e2e4'
          ? {
              result: 'correct',
              best: { uci: 'e2e4', san: 'e4' },
              nextInDays: 3,
              summary: { due: 0, total: 1 },
            }
          : move === 'a2a3'
            ? {
                result: 'wrong',
                best: { uci: 'e2e4', san: 'e4' },
                nextInDays: 1,
                summary: { due: 0, total: 1 },
              }
            : { result: 'illegal' },
      );
    }),
  );
});
afterEach(() => server.resetHandlers());

const square = (name: string) => screen.findByRole('button', { name: new RegExp(` ${name}(,|$)`) });

describe('the profile', () => {
  it('shows the level, the name and how long the learner has been learning', async () => {
    renderApp('/profile');
    expect(await screen.findByText('Дмитрий')).toBeInTheDocument();
    expect(screen.getByText('Ур. 4')).toBeInTheDocument();
    expect(screen.getByText('Учится с сентября 2026')).toBeInTheDocument();
    expect(screen.getByText('До уровня 5 · 240 / 400 XP')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Опыт на уровне 4' })).toHaveAttribute(
      'aria-valuenow',
      '240',
    );
  });

  it('shows the tiles with the streak, the XP, the puzzles and the games', async () => {
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getByText('3 дня')).toBeInTheDocument();
    expect(screen.getByText('лучшая — 9')).toBeInTheDocument();
    expect(screen.getByText('1240')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.getByText('решено · рейтинг 1040')).toBeInTheDocument();
    expect(screen.getByText('побед 7 · ничьих 1 · поражений 4')).toBeInTheDocument();
  });

  it('shows the week with the days of the goal', async () => {
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getByText('серия 3 · рекорд 9')).toBeInTheDocument();
    const week = screen.getByText('Эта неделя').closest('section') as HTMLElement;
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    expect(within(week).getByLabelText('сб: цель выполнена, сегодня')).toBeInTheDocument();
    expect(within(week).getByLabelText('чт: без цели')).toBeInTheDocument();
  });

  it('counts the achievements and shows how far the others are', async () => {
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getByText('2 из 5')).toBeInTheDocument();
    expect(screen.getByText('3 из 5')).toBeInTheDocument();
    expect(screen.getByText('Первый урок')).toBeInTheDocument();
    expect(screen.getByText('4 из 7')).toBeInTheDocument();
    expect(screen.getByText('Ещё не было')).toBeInTheDocument();
  });

  it('names the weakest theme and opens the puzzles of it', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getByText('Слабее всего «Связка». Потренируйся на ней.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Связка' })).toHaveAttribute(
      'aria-valuenow',
      '31',
    );
    await user.click(screen.getByRole('button', { name: 'Тренировать' }));
    await waitFor(() => expect(screen.queryByText('Дмитрий')).not.toBeInTheDocument());
  });

  it('offers to repeat the cards that are due', async () => {
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.getByText('К повторению: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторять' })).toBeInTheDocument();
  });

  it('says so when it cannot load and offers another try', async () => {
    server.use(http.get(`${API_URL}/profile`, () => new HttpResponse(null, { status: 500 })));
    renderApp('/profile');
    expect(
      await screen.findByText('Не получилось загрузить профиль. Попробуй ещё раз.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('the month and the rating', () => {
  it('shows the calendar of the month with the days of the goal', async () => {
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: 'Октябрь' })).toBeInTheDocument();
    expect(screen.getByLabelText('2: цель выполнена')).toBeInTheDocument();
    expect(screen.getByLabelText('3: без цели, сегодня')).toBeInTheDocument();
    expect(screen.getByText('Лучшая серия: 9 дней')).toBeInTheDocument();
  });

  it('shows the rating over the weeks with the change in words', async () => {
    renderApp('/profile');
    expect(await screen.findByText('+240 за 8 недель')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Рейтинг в задачах по неделям: с 800 до 1040' }),
    ).toBeInTheDocument();
  });

  it('asks for the first puzzles when there is no rating line yet', async () => {
    server.use(
      http.get(`${API_URL}/profile`, () => HttpResponse.json({ ...PROFILE, ratingHistory: [] })),
    );
    renderApp('/profile');
    expect(
      await screen.findByText('Решай задачи, и здесь появится, как растёт твой рейтинг.'),
    ).toBeInTheDocument();
  });
});

describe('the wardrobe', () => {
  it('counts what is open and shows the cat in what it wears', async () => {
    renderApp('/profile');
    expect(await screen.findByText('2 из 6')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Бабочка. Надето' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Шарф. за серию 3 дня' })).toBeEnabled();
  });

  it('keeps the closed items closed and says what opens them', async () => {
    renderApp('/profile');
    const crown = await screen.findByRole('radio', {
      name: 'Корона. пройти «Основы», ещё закрыто',
    });
    expect(crown).toBeDisabled();
  });

  it('puts an open item on the cat', async () => {
    const user = userEvent.setup();
    let sent: unknown;
    server.use(
      http.put(`${API_URL}/profile/accessory`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ ...PROFILE.wardrobe, selected: 'scarf' });
      }),
    );
    renderApp('/profile');
    await user.click(await screen.findByRole('radio', { name: 'Шарф. за серию 3 дня' }));
    await waitFor(() => expect(sent).toEqual({ accessory: 'scarf' }));
  });
});

describe('the cards', () => {
  it('asks for the move and does not name it', async () => {
    renderApp('/cards');
    expect(await screen.findByRole('heading', { name: 'Ход белых' })).toBeInTheDocument();
    expect(screen.getByText('Вспомни эту позицию')).toBeInTheDocument();
    expect(screen.getByText('В партии ты сыграл f3 на 1-м ходу.')).toBeInTheDocument();
    expect(screen.getByText('Осталось: 1')).toBeInTheDocument();
  });

  it('praises the right move, says when the card comes back and goes to the next one', async () => {
    const user = userEvent.setup();
    renderApp('/cards');
    await screen.findByRole('heading', { name: 'Ход белых' });
    await user.click(await square('e2'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка e4, возможный ход' }),
    );

    expect(await screen.findByText('Запомнил!')).toBeInTheDocument();
    expect(screen.getByText(/Лучше было e4\./)).toBeInTheDocument();
    expect(screen.getByText(/Вернётся через 3 дня\./)).toBeInTheDocument();
    expect(answers).toEqual(['e2e4']);

    await user.click(screen.getByRole('button', { name: 'Дальше' }));
    expect(await screen.findByText('Всё повторено')).toBeInTheDocument();
  });

  it('shows the better move and a soft word after a wrong one', async () => {
    const user = userEvent.setup();
    renderApp('/cards');
    await screen.findByRole('heading', { name: 'Ход белых' });
    await user.click(await square('a2'));
    await user.click(
      await screen.findByRole('button', { name: 'Пустая клетка a3, возможный ход' }),
    );

    expect(await screen.findByText('Запомним ещё раз')).toBeInTheDocument();
    expect(screen.getByText(/Лучше было e4\./)).toBeInTheDocument();
    expect(screen.getByText(/Вернётся через 1 день\./)).toBeInTheDocument();
  });

  it('says when there is nothing to repeat', async () => {
    server.use(
      http.post(`${API_URL}/cards/next`, () =>
        HttpResponse.json({ card: null, summary: { due: 0, total: 0 } }),
      ),
    );
    renderApp('/cards');
    expect(await screen.findByText('Всё повторено')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'К главам' })).toHaveLength(2);
  });

  it('offers another try when a card cannot be taken', async () => {
    server.use(http.post(`${API_URL}/cards/next`, () => new HttpResponse(null, { status: 500 })));
    renderApp('/cards');
    expect(
      await screen.findByText('Не получилось взять карточку. Попробуй ещё раз.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('the accounts for sign-in', () => {
  const identities = (tied: string[], hasPassword = true) =>
    server.use(
      http.get(`${API_URL}/auth/identities`, () =>
        HttpResponse.json({
          identities: tied.map((provider) => ({ provider, email: 'cat@example.com' })),
          hasPassword,
        }),
      ),
      http.get(`${API_URL}/auth/oauth/providers`, () =>
        HttpResponse.json({ providers: ['yandex', 'vk', 'google'] }),
      ),
    );

  it('shows which services are tied to the account', async () => {
    identities(['yandex', 'google']);
    renderApp('/profile');
    const section = await screen.findByRole('region', { name: 'Привязанные аккаунты' });

    expect(within(section).getAllByText('Привязан')).toHaveLength(2);
    expect(within(section).getByText('Не привязан')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Отвязать Яндекс' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Привязать VK' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Отвязать Google' })).toBeInTheDocument();
  });

  it('is not shown when no service is on and none is tied', async () => {
    renderApp('/profile');
    await screen.findByText('Дмитрий');
    expect(screen.queryByRole('region', { name: 'Привязанные аккаунты' })).not.toBeInTheDocument();
  });

  it('unlinks a service and shows it as free again', async () => {
    const user = userEvent.setup();
    let tied = ['yandex', 'google'];
    server.use(
      http.get(`${API_URL}/auth/identities`, () =>
        HttpResponse.json({
          identities: tied.map((provider) => ({ provider, email: null })),
          hasPassword: true,
        }),
      ),
      http.get(`${API_URL}/auth/oauth/providers`, () =>
        HttpResponse.json({ providers: ['yandex', 'vk', 'google'] }),
      ),
      http.delete(`${API_URL}/auth/identities/yandex`, () => {
        tied = ['google'];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Отвязать Яндекс' }));

    expect(await screen.findByRole('button', { name: 'Привязать Яндекс' })).toBeInTheDocument();
  });

  it('says why the last way in cannot be removed', async () => {
    const user = userEvent.setup();
    identities(['yandex'], false);
    server.use(
      http.delete(`${API_URL}/auth/identities/yandex`, () =>
        HttpResponse.json(
          { code: 'oauth.last_method', message: 'Это твой единственный способ входа.' },
          { status: 409 },
        ),
      ),
    );
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Отвязать Яндекс' }));

    expect(await screen.findByText('Это твой единственный способ входа.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отвязать Яндекс' })).toBeInTheDocument();
  });

  it('asks the server for the page of the service and goes there', async () => {
    const user = userEvent.setup();
    identities([]);
    let sent: unknown;
    server.use(
      http.post(`${API_URL}/auth/oauth/vk/link-start`, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ url: 'http://localhost:3000/auth/oauth/vk/start?intent=x' });
      }),
    );
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderApp('/profile');
    await user.click(await screen.findByRole('button', { name: 'Привязать VK' }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('http://localhost:3000/auth/oauth/vk/start?intent=x'),
    );
    expect(sent).toEqual({ client: 'web' });
    vi.unstubAllGlobals();
  });

  it('says what happened when the learner comes back from the service', async () => {
    identities(['yandex']);
    renderApp('/profile?linked=yandex');
    expect(
      await screen.findByText('Яндекс привязан. Теперь можно входить и так.'),
    ).toBeInTheDocument();
  });

  it('says calmly why the account was not tied', async () => {
    identities([]);
    renderApp('/profile?oauth_error=taken');
    expect(
      await screen.findByText('Этот аккаунт уже привязан к другому профилю.'),
    ).toBeInTheDocument();
  });
});
